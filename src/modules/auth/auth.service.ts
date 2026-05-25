import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomInt, randomUUID } from 'crypto';
import { prisma } from '@/shared/infra/prisma';
import { cache } from '@/shared/infra/memory-cache';
import { sendEmail } from '@/shared/infra/email';
import { AuthRepository } from './auth.repository';
import type { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto, VerifyAdminMfaDto, VerifyCustomerMfaDto } from './auth.schemas';

const BCRYPT_ROUNDS = 12;
const ACCESS_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] ?? '15m';
const REFRESH_EXPIRES_IN_S = 7 * 24 * 60 * 60; // 7d TTL
const REFRESH_EXPIRES_IN = '7d';
const REFRESH_CLEANUP_INTERVAL_S = (() => {
  const parsed = Number(process.env['REFRESH_TOKEN_CLEANUP_INTERVAL_S'] ?? 300);
  if (!Number.isFinite(parsed) || parsed <= 0) return 300;
  return parsed;
})();
type AuthSubjectType = 'CUSTOMER' | 'USER';
const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

let lastCleanupAtUser = 0;
let lastCleanupAtCustomer = 0;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface LoginResult extends TokenPair {
  mfaRequired?: false;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    firstLogin: boolean;
  };
}

interface AdminMfaRequiredResult {
  mfaRequired: true;
  challengeId: string;
  emailMasked: string;
  expiresInSeconds: number;
}

type AdminMfaChallenge = {
  subjectId: string;
  subjectType: AuthSubjectType;
  codeHash: string;
  attempts: number;
};

interface JwtAccessPayload {
  sub: string;
  role: string;
  t: AuthSubjectType;
}

interface JwtRefreshPayload {
  sub: string;
  jti: string;
  t?: AuthSubjectType;
}

function makeAppError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

function adminMfaCacheKey(challengeId: string): string {
  return `auth:admin-mfa:${challengeId}`;
}

function customerMfaCacheKey(challengeId: string): string {
  return `auth:customer-mfa:${challengeId}`;
}

function passwordResetCacheKey(token: string): string {
  return `auth:password-reset:${token}`;
}

function appUrl(path: string): string {
  const base = (process.env['APP_URL'] ?? process.env['FRONTEND_URL'] ?? 'http://localhost:5173').replace(/\/$/, '');
  return `${base}${path}`;
}

function buildPasswordResetEmailHtml(resetUrl: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,.10);">
          <tr><td style="background:#111827;padding:28px 30px;text-align:center;">
            <div style="font-size:32px;font-weight:900;letter-spacing:-1px;line-height:1;color:#ffffff;">TIN<span style="color:#f5c518;">PAVI</span></div>
            <div style="margin-top:10px;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#f5c518;">Recuperação de acesso</div>
          </td></tr>
          <tr><td style="padding:34px 30px 10px;">
            <h1 style="margin:0;font-size:24px;line-height:1.25;color:#0f172a;">Redefina sua senha</h1>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#52627a;">Recebemos uma solicitação para criar uma nova senha na sua conta Tinpavi.</p>
          </td></tr>
          <tr><td align="center" style="padding:22px 30px 26px;">
            <a href="${resetUrl}" style="display:inline-block;background:#f5c518;color:#111827;text-decoration:none;border-radius:10px;padding:15px 24px;font-size:15px;font-weight:900;">Criar nova senha</a>
          </td></tr>
          <tr><td style="padding:0 30px 30px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;font-size:14px;line-height:1.55;color:#475569;">
              Este link expira em <strong style="color:#0f172a;">30 minutos</strong>. Se você não solicitou a redefinição, ignore este e-mail.
            </div>
            <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">Se o botão não funcionar, copie e cole este link no navegador:<br><span style="word-break:break-all;">${resetUrl}</span></p>
          </td></tr>
          <tr><td style="border-top:1px solid #edf2f7;background:#fbfdff;padding:18px 30px;text-align:center;font-size:12px;color:#94a3b8;">Tinpavi - Segurança da conta</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function buildAdminMfaEmailHtml(code: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Código de acesso Tinpavi</title>
  </head>
  <body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,.10);">
            <tr>
              <td style="background:#0f172a;padding:26px 30px;text-align:center;">
                <div style="font-size:13px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#f5c518;">Painel administrativo</div>
                <div style="margin-top:10px;font-size:32px;font-weight:900;letter-spacing:-1px;line-height:1;color:#ffffff;">
                  TIN<span style="color:#f5c518;">PAVI</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 30px 8px;">
                <h1 style="margin:0;font-size:23px;line-height:1.25;color:#0f172a;">Seu código de verificação</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#52627a;">
                  Use o código abaixo para concluir o acesso ao painel administrativo da Tinpavi.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 30px 24px;">
                <div style="background:#fff8dc;border:1px solid #f5c518;border-radius:16px;padding:24px 18px;text-align:center;">
                  <div style="font-size:12px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#9a7600;">Código de acesso</div>
                  <div style="margin-top:10px;font-size:42px;line-height:1;font-weight:900;letter-spacing:0;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">${code}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;line-height:1.55;color:#475569;">
                      Este código expira em <strong style="color:#0f172a;">5 minutos</strong>. Se você não solicitou este acesso, ignore este e-mail.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #edf2f7;background:#fbfdff;padding:18px 30px;text-align:center;font-size:12px;color:#94a3b8;">
                Tinpavi - Segurança do painel administrativo
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export class AuthService {
  private repo = new AuthRepository();

  private shouldRunJanitor(subjectType: AuthSubjectType): boolean {
    const now = Date.now();
    const lastRun = subjectType === 'USER' ? lastCleanupAtUser : lastCleanupAtCustomer;
    const intervalMs = REFRESH_CLEANUP_INTERVAL_S * 1000;

    if (now - lastRun < intervalMs) return false;

    if (subjectType === 'USER') {
      lastCleanupAtUser = now;
    } else {
      lastCleanupAtCustomer = now;
    }
    return true;
  }

  private async runRefreshTokenJanitor(subjectType: AuthSubjectType): Promise<void> {
    if (!this.shouldRunJanitor(subjectType)) return;

    if (subjectType === 'USER') {
      await prisma.$executeRaw`
        DELETE FROM \`userrefreshtoken\`
        WHERE expiresAt < NOW()
      `;
      return;
    }

    await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  private signTokenPair(subjectId: string, role: string, subjectType: AuthSubjectType): TokenPair {
    const jti = randomUUID();
    const accessToken = jwt.sign(
      { sub: subjectId, role, t: subjectType } satisfies JwtAccessPayload,
      requireEnv('JWT_SECRET'),
      { expiresIn: ACCESS_EXPIRES_IN } as jwt.SignOptions,
    );
    const refreshToken = jwt.sign(
      { sub: subjectId, jti, t: subjectType } satisfies JwtRefreshPayload,
      requireEnv('JWT_REFRESH_SECRET'),
      { expiresIn: REFRESH_EXPIRES_IN } as jwt.SignOptions,
    );
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(jti: string, subjectType: AuthSubjectType, subjectId: string): Promise<void> {
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN_S * 1000);

    if (subjectType === 'USER') {
      await prisma.$executeRaw`
        INSERT INTO \`userrefreshtoken\` (jti, userId, expiresAt, createdAt)
        VALUES (${jti}, ${subjectId}, ${expiresAt}, NOW())
      `;
      await this.runRefreshTokenJanitor('USER');
      return;
    }

    await prisma.refreshToken.create({
      data: { jti, customerId: subjectId, expiresAt },
    });
    await this.runRefreshTokenJanitor('CUSTOMER');
  }

  private async createMfaChallenge(subjectId: string, subjectType: AuthSubjectType, email: string): Promise<AdminMfaRequiredResult> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challengeId = randomUUID();
    const isAdmin = subjectType === 'USER';
    cache.set<AdminMfaChallenge>(
      isAdmin ? adminMfaCacheKey(challengeId) : customerMfaCacheKey(challengeId),
      {
        subjectId,
        subjectType,
        codeHash: await bcrypt.hash(code, BCRYPT_ROUNDS),
        attempts: 0,
      },
      5 * 60,
    );

    await sendEmail({
      to: email,
      subject: isAdmin ? 'Codigo de acesso ao painel Tinpavi' : 'Codigo de acesso a sua conta Tinpavi',
      text: `Seu codigo de acesso ${isAdmin ? 'ao painel Tinpavi' : 'a sua conta Tinpavi'} e: ${code}\n\nEle expira em 5 minutos. Se voce nao solicitou este acesso, ignore este e-mail.`,
      html: buildAdminMfaEmailHtml(code),
    });

    return {
      mfaRequired: true,
      challengeId,
      emailMasked: maskEmail(email),
      expiresInSeconds: 5 * 60,
    };
  }

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) throw makeAppError('Email already in use', 409);

    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const customer = await this.repo.create({ name: dto.name, email: dto.email, password });
    const tokens = this.signTokenPair(customer.id, customer.role, 'CUSTOMER');
    const payload = jwt.decode(tokens.refreshToken) as JwtRefreshPayload;
    await this.storeRefreshToken(payload.jti, 'CUSTOMER', customer.id);
    return tokens;
  }

  async login(dto: LoginDto): Promise<LoginResult | AdminMfaRequiredResult> {
    const adminUser = await this.repo.findAdminUserByEmail(dto.email);
    if (adminUser) {
      const passwordOk = await bcrypt.compare(dto.password, adminUser.password);
      if (!passwordOk) throw makeAppError('Invalid credentials', 401);
      if (!adminUser.isActive) throw makeAppError('Invalid credentials', 401);

      return this.createMfaChallenge(adminUser.id, 'USER', adminUser.email);
    }

    const customer = await this.repo.findByEmail(dto.email);
    // Timing-safe: always compare even if customer is null (prevents user enumeration)
    const isValid = customer
      ? await bcrypt.compare(dto.password, customer.password)
      : await bcrypt.compare(dto.password, '$2b$12$invalidHashForTimingProtection');

    if (!customer || !isValid) throw makeAppError('Invalid credentials', 401);

    if (customer.mfaEnabled) {
      return this.createMfaChallenge(customer.id, 'CUSTOMER', customer.email);
    }

    const tokens = this.signTokenPair(customer.id, customer.role, 'CUSTOMER');
    const payload = jwt.decode(tokens.refreshToken) as JwtRefreshPayload;
    await this.storeRefreshToken(payload.jti, 'CUSTOMER', customer.id);
    return tokens;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const customer = await this.repo.findByEmail(dto.email);
    if (!customer) return;

    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    cache.set(passwordResetCacheKey(token), { customerId: customer.id }, PASSWORD_RESET_TTL_SECONDS);
    const resetUrl = appUrl(`/forgot-password?token=${encodeURIComponent(token)}`);

    await sendEmail({
      to: customer.email,
      subject: 'Redefinicao de senha Tinpavi',
      text: `Use este link para redefinir sua senha: ${resetUrl}\n\nEle expira em 30 minutos. Se voce nao solicitou, ignore este e-mail.`,
      html: buildPasswordResetEmailHtml(resetUrl),
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const key = passwordResetCacheKey(dto.token);
    const reset = cache.get<{ customerId: string }>(key);
    if (!reset) throw makeAppError('Invalid or expired reset token', 401);
    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.repo.updatePassword(reset.customerId, password);
    cache.del(key);
  }

  async verifyAdminMfa(dto: VerifyAdminMfaDto): Promise<LoginResult> {
    const key = adminMfaCacheKey(dto.challengeId);
    const challenge = cache.get<AdminMfaChallenge>(key);
    if (!challenge) throw makeAppError('Invalid or expired verification code', 401);

    if (challenge.attempts >= 5) {
      cache.del(key);
      throw makeAppError('Too many verification attempts', 429);
    }

    const codeOk = await bcrypt.compare(dto.code, challenge.codeHash);
    if (!codeOk) {
      cache.set<AdminMfaChallenge>(key, { ...challenge, attempts: challenge.attempts + 1 }, 5 * 60);
      throw makeAppError('Invalid or expired verification code', 401);
    }

    cache.del(key);
    if (challenge.subjectType !== 'USER') throw makeAppError('Invalid or expired verification code', 401);

    const adminUser = await this.repo.findAdminUserById(challenge.subjectId);
    if (!adminUser || !adminUser.isActive) throw makeAppError('Invalid credentials', 401);

    const tokens = this.signTokenPair(adminUser.id, adminUser.role, 'USER');
    const payload = jwt.decode(tokens.refreshToken) as JwtRefreshPayload;
    await this.storeRefreshToken(payload.jti, 'USER', adminUser.id);

    return {
      ...tokens,
      mfaRequired: false,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        firstLogin: Boolean(adminUser.firstLogin),
      },
    };
  }

  async verifyCustomerMfa(dto: VerifyCustomerMfaDto): Promise<TokenPair> {
    const key = customerMfaCacheKey(dto.challengeId);
    const challenge = cache.get<AdminMfaChallenge>(key);
    if (!challenge || challenge.subjectType !== 'CUSTOMER') throw makeAppError('Invalid or expired verification code', 401);

    if (challenge.attempts >= 5) {
      cache.del(key);
      throw makeAppError('Too many verification attempts', 429);
    }

    const codeOk = await bcrypt.compare(dto.code, challenge.codeHash);
    if (!codeOk) {
      cache.set<AdminMfaChallenge>(key, { ...challenge, attempts: challenge.attempts + 1 }, 5 * 60);
      throw makeAppError('Invalid or expired verification code', 401);
    }

    cache.del(key);
    const customer = await this.repo.findById(challenge.subjectId);
    if (!customer) throw makeAppError('Customer not found', 401);

    const tokens = this.signTokenPair(customer.id, customer.role, 'CUSTOMER');
    const payload = jwt.decode(tokens.refreshToken) as JwtRefreshPayload;
    await this.storeRefreshToken(payload.jti, 'CUSTOMER', customer.id);
    return tokens;
  }

  async refresh(dto: RefreshDto): Promise<{ accessToken: string }> {
    let payload: JwtRefreshPayload;
    try {
      payload = jwt.verify(dto.refreshToken, requireEnv('JWT_REFRESH_SECRET')) as JwtRefreshPayload;
    } catch {
      throw makeAppError('Invalid refresh token', 401);
    }

    const subjectType: AuthSubjectType = payload.t ?? 'CUSTOMER';

    if (subjectType === 'USER') {
      const storedRows = await prisma.$queryRaw<Array<{ jti: string; userId: string; expiresAt: Date }>>`
        SELECT jti, userId, expiresAt
        FROM \`userrefreshtoken\`
        WHERE jti = ${payload.jti}
        LIMIT 1
      `;
      const stored = storedRows[0];
      if (!stored || stored.expiresAt < new Date()) throw makeAppError('Refresh token revoked or expired', 401);

      const user = await this.repo.findAdminUserById(payload.sub);
      if (!user || !user.isActive) throw makeAppError('User not found', 401);

      const accessToken = jwt.sign(
        { sub: user.id, role: user.role, t: 'USER' } satisfies JwtAccessPayload,
        requireEnv('JWT_SECRET'),
        { expiresIn: ACCESS_EXPIRES_IN } as jwt.SignOptions,
      );
      return { accessToken };
    }

    const stored = await prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!stored || stored.expiresAt < new Date()) throw makeAppError('Refresh token revoked or expired', 401);

    const customer = await this.repo.findById(payload.sub);
    if (!customer) throw makeAppError('Customer not found', 401);

    const accessToken = jwt.sign(
      { sub: customer.id, role: customer.role, t: 'CUSTOMER' } satisfies JwtAccessPayload,
      requireEnv('JWT_SECRET'),
      { expiresIn: ACCESS_EXPIRES_IN } as jwt.SignOptions,
    );
    return { accessToken };
  }

  async logout(dto: RefreshDto): Promise<void> {
    try {
      const payload = jwt.verify(
        dto.refreshToken,
        requireEnv('JWT_REFRESH_SECRET'),
      ) as JwtRefreshPayload;
      if ((payload.t ?? 'CUSTOMER') === 'USER') {
        await prisma.$executeRaw`DELETE FROM \`userrefreshtoken\` WHERE jti = ${payload.jti}`;
      } else {
        await prisma.refreshToken.deleteMany({ where: { jti: payload.jti } });
      }
    } catch {
      // Token invalid or already expired — logout is idempotent
    }
  }
}
