import bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import { cache } from '@/shared/infra/memory-cache';
import { sendEmail } from '@/shared/infra/email';
import { UsersRepository, type AdminUserRecord } from './users.repository';
import type { ConfirmUserEmailDto, CreateUserDto, UpdateMeDto, UpdateUserDto } from './users.schemas';

const BCRYPT_ROUNDS = 12;
const CONFIRMATION_TTL_SECONDS = 10 * 60;

type AppError = Error & { statusCode: number };

function makeAppError(message: string, statusCode: number): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  return err;
}

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const visible = local.slice(0, 2);
  return `${visible}${local.length > 2 ? '***' : '*'}@${domain}`;
}

function confirmationCacheKey(userId: string): string {
  return `users:email-confirmation:${userId}`;
}

export class UsersService {
  private repo = new UsersRepository();

  listUsers(): Promise<AdminUserRecord[]> {
    return this.repo.listAll();
  }

  async getMe(userId: string): Promise<AdminUserRecord> {
    const user = await this.repo.findById(userId);
    if (!user) throw makeAppError('User not found', 404);
    return user;
  }

  async createUser(dto: CreateUserDto, actorRole: string): Promise<AdminUserRecord> {
    if (actorRole === 'EDITOR') {
      throw makeAppError('EDITOR cannot create users', 403);
    }

    if (dto.role === 'MASTER') {
      throw makeAppError('MASTER is a seed-only user role', 403);
    }

    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      throw makeAppError('Email already in use', 409);
    }

    const id = randomUUID();
    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await this.repo.create({
      id,
      email: dto.email,
      name: dto.name,
      role: dto.role,
      isActive: dto.isActive,
      firstLogin: dto.firstLogin,
      password,
    });

    const created = await this.repo.findById(id);
    if (!created) throw makeAppError('Failed to create user', 500);
    return created;
  }

  async sendEmailConfirmation(id: string): Promise<{ emailMasked: string }> {
    const user = await this.repo.findById(id);
    if (!user) throw makeAppError('User not found', 404);

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    cache.set(confirmationCacheKey(id), { codeHash, attempts: 0 }, CONFIRMATION_TTL_SECONDS);

    await sendEmail({
      to: user.email,
      subject: 'Codigo de acesso ao painel Tinpavi',
      text: `Seu codigo de validacao e: ${code}. Ele expira em 10 minutos.`,
      html: `
        <div style="margin:0;padding:32px 16px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:24px 28px;background:#111111">
                <div style="font-size:24px;font-weight:900;letter-spacing:.5px;color:#ffffff">
                  TIN<span style="color:#f5c518">PAVI</span>
                </div>
                <div style="margin-top:6px;font-size:13px;font-weight:700;text-transform:uppercase;color:#f5c518">
                  Acesso administrativo
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px">
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#111827">Codigo de validacao</h1>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4b5563">
                  Use o codigo abaixo para validar a conta criada no painel Tinpavi.
                </p>
                <div style="margin:0 0 22px;padding:18px 20px;border-radius:12px;background:#fff8db;border:1px solid #f5c518;text-align:center">
                  <div style="font-size:32px;line-height:1;font-weight:900;letter-spacing:10px;color:#111827">${code}</div>
                </div>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280">
                  Este codigo expira em <strong style="color:#111827">10 minutos</strong>. Se voce nao solicitou este acesso, ignore esta mensagem.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280">
                Tinpavi - Seguranca do painel administrativo
              </td>
            </tr>
          </table>
        </div>
      `,
    });

    return { emailMasked: maskEmail(user.email) };
  }

  async confirmEmail(id: string, dto: ConfirmUserEmailDto): Promise<AdminUserRecord> {
    const user = await this.repo.findById(id);
    if (!user) throw makeAppError('User not found', 404);

    const key = confirmationCacheKey(id);
    const challenge = cache.get<{ codeHash: string; attempts: number }>(key);
    if (!challenge) throw makeAppError('Invalid or expired verification code', 401);
    if (challenge.attempts >= 5) {
      cache.del(key);
      throw makeAppError('Too many verification attempts', 429);
    }

    const codeOk = await bcrypt.compare(dto.code, challenge.codeHash);
    if (!codeOk) {
      cache.set(key, { ...challenge, attempts: challenge.attempts + 1 }, CONFIRMATION_TTL_SECONDS);
      throw makeAppError('Invalid or expired verification code', 401);
    }

    cache.del(key);
    await this.repo.updateById(id, { isActive: true, firstLogin: true });
    const updated = await this.repo.findById(id);
    if (!updated) throw makeAppError('User not found', 404);
    return updated;
  }

  async updateUser(id: string, dto: UpdateUserDto, actorId: string, actorRole: string): Promise<AdminUserRecord> {
    const target = await this.repo.findById(id);
    if (!target) throw makeAppError('User not found', 404);

    if (target.role === 'MASTER' && actorRole !== 'MASTER') {
      throw makeAppError('Only MASTER can update MASTER users', 403);
    }

    if (dto.role === 'MASTER') {
      throw makeAppError('MASTER is a seed-only user role', 403);
    }

    if (actorId === id && dto.isActive === false) {
      throw makeAppError('You cannot deactivate your own account', 400);
    }

    if (dto.email && dto.email !== target.email) {
      const conflict = await this.repo.findByEmail(dto.email);
      if (conflict && conflict.id !== id) {
        throw makeAppError('Email already in use', 409);
      }
    }

    const password = dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : undefined;

    await this.repo.updateById(id, {
      email: dto.email,
      name: dto.name,
      role: dto.role,
      isActive: dto.isActive,
      firstLogin: dto.firstLogin,
      password,
    });

    const updated = await this.repo.findById(id);
    if (!updated) throw makeAppError('User not found', 404);
    return updated;
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<AdminUserRecord> {
    const existing = await this.repo.findById(userId);
    if (!existing) throw makeAppError('User not found', 404);

    if (dto.email && dto.email !== existing.email) {
      const conflict = await this.repo.findByEmail(dto.email);
      if (conflict && conflict.id !== userId) {
        throw makeAppError('Email already in use', 409);
      }
    }

    const password = dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : undefined;
    await this.repo.updateById(userId, {
      email: dto.email,
      name: dto.name,
      password,
      ...(dto.password ? { firstLogin: false } : {}),
    });

    const updated = await this.repo.findById(userId);
    if (!updated) throw makeAppError('User not found', 404);
    return updated;
  }

  async deleteUser(id: string, actorId: string, actorRole: string): Promise<void> {
    const target = await this.repo.findById(id);
    if (!target) throw makeAppError('User not found', 404);

    if (id === actorId) throw makeAppError('You cannot delete your own account', 400);
    if (target.role === 'MASTER') throw makeAppError('MASTER account cannot be deleted', 403);

    await this.repo.deleteById(id);
  }
}
