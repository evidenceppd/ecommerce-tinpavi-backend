import type { Address, Customer } from '@/generated/prisma/client';
import bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { cache } from '@/shared/infra/memory-cache';
import { sendEmail } from '@/shared/infra/email';
import { CustomersRepository } from './customers.repository';
import type {
  AdminCreateCustomerDto,
  AdminListCustomersQueryDto,
  AdminUpdateCustomerDto,
  ChangePasswordDto,
  CreateAddressDto,
  UpdateAddressDto,
  UpdateProfileDto,
  VerifyMfaSetupDto,
} from './customers.schemas';

const BCRYPT_ROUNDS = 12;

type CustomerProfile = Omit<Customer, 'password'> & {
  address: string | null;
  defaultAddress: Address | null;
};

function makeAppError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function formatAddress(address: Address | null): string | null {
  if (!address) return null;
  const streetNumber = [address.street, address.number].filter(Boolean).join(', ');
  const districtCityState = [
    address.district,
    [address.city, address.state].filter(Boolean).join(' - '),
  ].filter(Boolean).join(', ');
  return [streetNumber, address.complement, districtCityState, address.zipCode]
    .filter(Boolean)
    .join(' - ');
}

function buildProfile(customer: Customer, addresses: Address[]): CustomerProfile {
  const { password: _, ...profile } = customer;
  const defaultAddress = addresses[0] ?? null;
  return {
    ...profile,
    address: formatAddress(defaultAddress),
    defaultAddress,
  };
}

function customerMfaSetupCacheKey(customerId: string): string {
  return `customer:mfa-setup:${customerId}`;
}

function buildMfaSetupEmailHtml(code: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ativar verificação em duas etapas</title>
  </head>
  <body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,.10);">
            <tr>
              <td style="background:#0f172a;padding:26px 30px;text-align:center;">
                <div style="font-size:13px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#f5c518;">Segurança da conta</div>
                <div style="margin-top:10px;font-size:32px;font-weight:900;letter-spacing:0;line-height:1;color:#ffffff;">
                  TIN<span style="color:#f5c518;">PAVI</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 30px 8px;">
                <h1 style="margin:0;font-size:23px;line-height:1.25;color:#0f172a;">Ative a verificação em duas etapas</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#52627a;">
                  Use o código abaixo para confirmar a ativação da verificação em duas etapas na sua conta Tinpavi.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 30px 24px;">
                <div style="background:#fff8dc;border:1px solid #f5c518;border-radius:16px;padding:24px 18px;text-align:center;">
                  <div style="font-size:12px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#9a7600;">Código de ativação</div>
                  <div style="margin-top:10px;font-size:42px;line-height:1;font-weight:900;letter-spacing:0;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">${code}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;line-height:1.55;color:#475569;">
                      Este código expira em <strong style="color:#0f172a;">5 minutos</strong>. Se você não solicitou esta alteração, ignore este e-mail.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #edf2f7;background:#fbfdff;padding:18px 30px;text-align:center;font-size:12px;color:#94a3b8;">
                Tinpavi - Segurança da conta
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export class CustomersService {
  private repo = new CustomersRepository();

  async getProfile(customerId: string): Promise<CustomerProfile> {
    const [customer, addresses] = await Promise.all([
      this.repo.findById(customerId),
      this.repo.findAddressesByCustomerId(customerId),
    ]);
    if (!customer) throw makeAppError('Customer not found', 404);
    return buildProfile(customer, addresses);
  }

  async updateProfile(
    customerId: string,
    dto: UpdateProfileDto,
  ): Promise<CustomerProfile> {
    const existing = await this.repo.findById(customerId);
    if (!existing) throw makeAppError('Customer not found', 404);
    const updated = await this.repo.updateProfile(customerId, dto);
    const addresses = await this.repo.findAddressesByCustomerId(customerId);
    return buildProfile(updated, addresses);
  }

  async changePassword(customerId: string, dto: ChangePasswordDto): Promise<void> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw makeAppError('Customer not found', 404);
    const passwordOk = await bcrypt.compare(dto.currentPassword, customer.password);
    if (!passwordOk) throw makeAppError('Senha atual incorreta', 401);
    await this.repo.updatePassword(customerId, await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS));
  }

  async requestMfaSetup(customerId: string): Promise<{ emailMasked: string; expiresInSeconds: number }> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw makeAppError('Customer not found', 404);
    if (customer.mfaEnabled) throw makeAppError('Verificacao em duas etapas ja esta ativa', 409);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    cache.set(customerMfaSetupCacheKey(customerId), await bcrypt.hash(code, BCRYPT_ROUNDS), 5 * 60);

    await sendEmail({
      to: customer.email,
      subject: 'Codigo para ativar verificacao em duas etapas',
      text: `Seu codigo para ativar a verificacao em duas etapas e: ${code}\n\nEle expira em 5 minutos. Se voce nao solicitou esta alteracao, ignore este e-mail.`,
      html: buildMfaSetupEmailHtml(code),
    });

    const [local = '', domain = ''] = customer.email.split('@');
    return {
      emailMasked: `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`,
      expiresInSeconds: 5 * 60,
    };
  }

  async verifyMfaSetup(customerId: string, dto: VerifyMfaSetupDto): Promise<CustomerProfile> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw makeAppError('Customer not found', 404);
    const codeHash = cache.get<string>(customerMfaSetupCacheKey(customerId));
    if (!codeHash) throw makeAppError('Codigo invalido ou expirado', 401);
    const codeOk = await bcrypt.compare(dto.code, codeHash);
    if (!codeOk) throw makeAppError('Codigo invalido ou expirado', 401);

    cache.del(customerMfaSetupCacheKey(customerId));
    const updated = await this.repo.setMfaEnabled(customerId, true);
    const addresses = await this.repo.findAddressesByCustomerId(customerId);
    return buildProfile(updated, addresses);
  }

  async disableMfa(customerId: string): Promise<CustomerProfile> {
    const existing = await this.repo.findById(customerId);
    if (!existing) throw makeAppError('Customer not found', 404);
    cache.del(customerMfaSetupCacheKey(customerId));
    const updated = await this.repo.setMfaEnabled(customerId, false);
    const addresses = await this.repo.findAddressesByCustomerId(customerId);
    return buildProfile(updated, addresses);
  }

  async createAddress(customerId: string, dto: CreateAddressDto): Promise<Address> {
    return this.repo.createAddress(customerId, dto);
  }

  async listAddresses(customerId: string): Promise<Address[]> {
    return this.repo.findAddressesByCustomerId(customerId);
  }

  async deleteAddress(customerId: string, addressId: string): Promise<void> {
    const address = await this.repo.findAddressById(addressId, customerId);
    if (!address) throw makeAppError('Address not found', 404);
    await this.repo.deleteAddress(addressId, customerId);
  }

  async updateAddress(customerId: string, addressId: string, dto: UpdateAddressDto): Promise<Address> {
    const address = await this.repo.findAddressById(addressId, customerId);
    if (!address) throw makeAppError('Address not found', 404);
    return this.repo.updateAddress(addressId, customerId, dto);
  }

  async getOrderHistory(customerId: string) {
    return this.repo.listOrderHistoryByCustomer(customerId);
  }

  async listAdminCustomers(query: AdminListCustomersQueryDto) {
    return this.repo.listAdminCustomers(query);
  }

  async getAdminCustomer(customerId: string) {
    const customer = await this.repo.findAdminById(customerId);
    if (!customer) throw makeAppError('Customer not found', 404);
    return customer;
  }

  async updateCustomerAsAdmin(customerId: string, dto: AdminUpdateCustomerDto) {
    const existing = await this.getAdminCustomer(customerId);

    if (dto.email && dto.email !== existing.email) {
      const conflict = await this.repo.findByEmail(dto.email);
      if (conflict && conflict.id !== customerId) {
        throw makeAppError('Email already in use', 409);
      }
    }

    const updateData: Omit<AdminUpdateCustomerDto, 'password'> & { password?: string } = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      document: dto.document,
      role: dto.role,
    };

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    return this.repo.updateCustomerAsAdmin(customerId, updateData);
  }

  async createCustomerAsAdmin(dto: AdminCreateCustomerDto) {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      throw makeAppError('Email already in use', 409);
    }

    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.repo.createCustomerAsAdmin({
      name: dto.name,
      email: dto.email,
      password,
      phone: dto.phone,
      company: dto.company,
      document: dto.document,
      role: dto.role,
    });
  }

  async deleteCustomerAsAdmin(customerId: string, actorId: string) {
    if (customerId === actorId) {
      throw makeAppError('You cannot delete your own account', 400);
    }

    const existing = await this.getAdminCustomer(customerId);
    if (existing.role === 'MASTER') {
      throw makeAppError('MASTER account cannot be deleted', 403);
    }

    try {
      await this.repo.deleteCustomerAsAdmin(customerId);
    } catch {
      throw makeAppError('Customer cannot be deleted because related records exist', 409);
    }
  }
}
