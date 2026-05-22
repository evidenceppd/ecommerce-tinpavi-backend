import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRefreshToken = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
}));

const mockPrismaRaw = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: { refreshToken: mockRefreshToken, ...mockPrismaRaw },
}));
vi.mock('../auth.repository');
vi.mock('bcrypt');
vi.mock('jsonwebtoken');
vi.mock('crypto', () => ({ randomUUID: vi.fn(() => 'mock-uuid'), randomInt: vi.fn(() => 123456) }));

import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '@/shared/infra/prisma';

const MockAuthRepository = vi.mocked(AuthRepository);
const mockBcrypt = vi.mocked(bcrypt);
const mockJwt = vi.mocked(jwt);
const mockPrisma = vi.mocked(prisma);

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust-1',
    email: 'user@example.com',
    name: 'Test User',
    password: '$2b$12$hashedpassword',
    phone: '11999999999',
    role: 'CUSTOMER',
    updatedAt: new Date('2026-05-01T10:00:00Z'),
    ...overrides,
  };
}

function makeAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin User',
    password: '$2b$12$hashedpassword',
    role: 'ADMIN',
    firstLogin: false,
    isActive: true,
    updatedAt: new Date('2026-05-01T10:00:00Z'),
    ...overrides,
  };
}

describe('AuthService.register', () => {
  let service: AuthService;
  let repoMock: {
    findByEmail: ReturnType<typeof vi.fn>;
    findAdminUserByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['JWT_SECRET'] = 'test-secret';
    process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret';

    repoMock = { findByEmail: vi.fn(), findAdminUserByEmail: vi.fn(), create: vi.fn() };
    MockAuthRepository.mockImplementation(function (this: AuthRepository) {
      return repoMock as unknown as AuthRepository;
    } as unknown as typeof AuthRepository);

    mockBcrypt.hash.mockResolvedValue('hashed-password' as never);
    mockJwt.sign.mockReturnValue('mock-token' as never);
    mockJwt.decode.mockReturnValue({ jti: 'mock-uuid', sub: 'cust-1' } as never);
    mockRefreshToken.create.mockResolvedValue({} as never);
    mockRefreshToken.deleteMany.mockResolvedValue({ count: 0 } as never);

    service = new AuthService();
  });

  it('throws 409 when email is already registered', async () => {
    repoMock.findByEmail.mockResolvedValue(makeCustomer());
    await expect(
      service.register({ name: 'Test', email: 'user@example.com', password: 'pass' }),
    ).rejects.toMatchObject({ message: 'Email already in use', statusCode: 409 });
  });

  it('returns a token pair on successful registration', async () => {
    repoMock.findByEmail.mockResolvedValue(null);
    repoMock.create.mockResolvedValue(makeCustomer());
    const result = await service.register({ name: 'Test', email: 'user@example.com', password: 'pass' });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('hashes the password with bcrypt before storing', async () => {
    repoMock.findByEmail.mockResolvedValue(null);
    repoMock.create.mockResolvedValue(makeCustomer());
    await service.register({ name: 'Test', email: 'user@example.com', password: 'mypassword' });
    expect(mockBcrypt.hash).toHaveBeenCalledWith('mypassword', 12);
  });

  it('stores the refresh token in the database after registration', async () => {
    repoMock.findByEmail.mockResolvedValue(null);
    repoMock.create.mockResolvedValue(makeCustomer());
    await service.register({ name: 'Test', email: 'user@example.com', password: 'pass' });
    expect(mockRefreshToken.create).toHaveBeenCalledWith({
      data: { jti: 'mock-uuid', customerId: 'cust-1', expiresAt: expect.any(Date) },
    });
  });
});

describe('AuthService.login', () => {
  let service: AuthService;
  let repoMock: {
    findByEmail: ReturnType<typeof vi.fn>;
    findAdminUserByEmail: ReturnType<typeof vi.fn>;
    findAdminUserById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['JWT_SECRET'] = 'test-secret';
    process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret';

    repoMock = { findByEmail: vi.fn(), findAdminUserByEmail: vi.fn(), findAdminUserById: vi.fn() };
    MockAuthRepository.mockImplementation(function (this: AuthRepository) {
      return repoMock as unknown as AuthRepository;
    } as unknown as typeof AuthRepository);

    mockJwt.sign.mockReturnValue('mock-token' as never);
    mockJwt.decode.mockReturnValue({ jti: 'mock-uuid', sub: 'cust-1' } as never);
    mockRefreshToken.create.mockResolvedValue({} as never);
    mockRefreshToken.deleteMany.mockResolvedValue({ count: 0 } as never);

    service = new AuthService();
  });

  it('throws 401 when customer does not exist', async () => {
    repoMock.findAdminUserByEmail.mockResolvedValue(null);
    repoMock.findByEmail.mockResolvedValue(null);
    mockBcrypt.compare.mockResolvedValue(false as never);
    await expect(
      service.login({ email: 'ghost@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when password does not match', async () => {
    repoMock.findAdminUserByEmail.mockResolvedValue(null);
    repoMock.findByEmail.mockResolvedValue(makeCustomer());
    mockBcrypt.compare.mockResolvedValue(false as never);
    await expect(
      service.login({ email: 'user@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('returns a token pair on valid credentials', async () => {
    repoMock.findAdminUserByEmail.mockResolvedValue(null);
    repoMock.findByEmail.mockResolvedValue(makeCustomer());
    mockBcrypt.compare.mockResolvedValue(true as never);
    const result = await service.login({ email: 'user@example.com', password: 'correct' });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('always calls bcrypt.compare to prevent user enumeration timing attacks', async () => {
    repoMock.findAdminUserByEmail.mockResolvedValue(null);
    repoMock.findByEmail.mockResolvedValue(null);
    mockBcrypt.compare.mockResolvedValue(false as never);
    await expect(service.login({ email: 'nobody@example.com', password: 'x' })).rejects.toThrow();
    expect(mockBcrypt.compare).toHaveBeenCalled();
  });

  it('returns an MFA challenge for active admin user from User table', async () => {
    repoMock.findAdminUserByEmail.mockResolvedValue(makeAdminUser());
    mockBcrypt.compare.mockResolvedValue(true as never);

    const result = await service.login({ email: 'admin@example.com', password: 'correct' });

    expect(result).toMatchObject({
      mfaRequired: true,
      challengeId: 'mock-uuid',
      emailMasked: 'ad***@example.com',
      expiresInSeconds: 300,
    });
  });

  it('allows admin MFA challenge when firstLogin is true and user is active', async () => {
    repoMock.findAdminUserByEmail.mockResolvedValue(makeAdminUser({ firstLogin: true }));
    mockBcrypt.compare.mockResolvedValue(true as never);

    const result = await service.login({ email: 'admin@example.com', password: 'correct' });

    expect(result).toMatchObject({ mfaRequired: true, challengeId: 'mock-uuid' });
  });

  it('returns a token pair after valid admin MFA code', async () => {
    repoMock.findAdminUserByEmail.mockResolvedValue(makeAdminUser());
    repoMock.findAdminUserById.mockResolvedValue(makeAdminUser());
    mockBcrypt.compare.mockResolvedValue(true as never);

    const challenge = await service.login({ email: 'admin@example.com', password: 'correct' });
    if (!('mfaRequired' in challenge) || !challenge.mfaRequired) throw new Error('expected mfa challenge');

    mockJwt.decode.mockReturnValue({ jti: 'admin-refresh-jti', sub: 'user-1' } as never);
    const result = await service.verifyAdminMfa({ challengeId: challenge.challengeId, code: '123456' });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user).toMatchObject({ email: 'admin@example.com', role: 'ADMIN', firstLogin: false });
  });
});

describe('AuthService.refresh', () => {
  let service: AuthService;
  let repoMock: { findById: ReturnType<typeof vi.fn>; findAdminUserById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['JWT_SECRET'] = 'test-secret';
    process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret';

    repoMock = { findById: vi.fn(), findAdminUserById: vi.fn() };
    MockAuthRepository.mockImplementation(function (this: AuthRepository) {
      return repoMock as unknown as AuthRepository;
    } as unknown as typeof AuthRepository);

    mockJwt.sign.mockReturnValue('new-access-token' as never);
    service = new AuthService();
  });

  it('throws 401 when refresh token is invalid', async () => {
    mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
    await expect(service.refresh({ refreshToken: 'bad-token' })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when refresh token is revoked (not in database)', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'cust-1', jti: 'some-jti' } as never);
    mockRefreshToken.findUnique.mockResolvedValue(null);
    await expect(service.refresh({ refreshToken: 'revoked-token' })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when customer no longer exists', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'deleted-cust', jti: 'valid-jti' } as never);
    mockRefreshToken.findUnique.mockResolvedValue({ jti: 'valid-jti', customerId: 'deleted-cust', expiresAt: new Date(Date.now() + 10000) } as never);
    repoMock.findById.mockResolvedValue(null);
    await expect(service.refresh({ refreshToken: 'orphan-token' })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('returns a new accessToken on valid refresh', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'cust-1', jti: 'valid-jti' } as never);
    mockRefreshToken.findUnique.mockResolvedValue({ jti: 'valid-jti', customerId: 'cust-1', expiresAt: new Date(Date.now() + 10000) } as never);
    repoMock.findById.mockResolvedValue(makeCustomer());
    const result = await service.refresh({ refreshToken: 'valid-refresh-token' });
    expect(result).toHaveProperty('accessToken', 'new-access-token');
  });

  it('returns a new accessToken for USER refresh token', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', jti: 'valid-user-jti', t: 'USER' } as never);
    mockPrismaRaw.$queryRaw.mockResolvedValue([{ jti: 'valid-user-jti', userId: 'user-1', expiresAt: new Date(Date.now() + 10000) }] as never);
    repoMock.findAdminUserById.mockResolvedValue(makeAdminUser());

    const result = await service.refresh({ refreshToken: 'valid-user-refresh-token' });
    expect(result).toHaveProperty('accessToken', 'new-access-token');
  });
});

describe('AuthService.logout', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret';
    MockAuthRepository.mockImplementation(function (this: AuthRepository) {
      return {} as AuthRepository;
    } as unknown as typeof AuthRepository);
    service = new AuthService();
  });

  it('deletes the refresh token from database on valid token', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'cust-1', jti: 'some-jti' } as never);
    mockRefreshToken.deleteMany.mockResolvedValue({ count: 1 } as never);
    await service.logout({ refreshToken: 'valid-token' });
    expect(mockRefreshToken.deleteMany).toHaveBeenCalledWith({ where: { jti: 'some-jti' } });
  });

  it('does not throw when refresh token is invalid (idempotent logout)', async () => {
    mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
    await expect(service.logout({ refreshToken: 'garbage' })).resolves.toBeUndefined();
    expect(mockRefreshToken.deleteMany).not.toHaveBeenCalled();
  });
});
