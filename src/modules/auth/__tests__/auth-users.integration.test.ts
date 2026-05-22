import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';

const {
  mockAuthLogin,
  mockAuthRegister,
  mockAuthRefresh,
  mockAuthLogout,
  mockUsersGetMe,
  mockUsersListUsers,
  mockUsersCreateUser,
  mockUsersUpdateUser,
  mockUsersUpdateMe,
  mockUsersDeleteUser,
} = vi.hoisted(() => ({
  mockAuthLogin: vi.fn(),
  mockAuthRegister: vi.fn(),
  mockAuthRefresh: vi.fn(),
  mockAuthLogout: vi.fn(),
  mockUsersGetMe: vi.fn(),
  mockUsersListUsers: vi.fn(),
  mockUsersCreateUser: vi.fn(),
  mockUsersUpdateUser: vi.fn(),
  mockUsersUpdateMe: vi.fn(),
  mockUsersDeleteUser: vi.fn(),
}));

vi.mock('@/modules/auth/auth.service', () => ({
  AuthService: class AuthService {
    register = mockAuthRegister;
    login = mockAuthLogin;
    refresh = mockAuthRefresh;
    logout = mockAuthLogout;
  },
}));

vi.mock('@/modules/users/users.service', () => ({
  UsersService: class UsersService {
    listUsers = mockUsersListUsers;
    getMe = mockUsersGetMe;
    createUser = mockUsersCreateUser;
    updateUser = mockUsersUpdateUser;
    updateMe = mockUsersUpdateMe;
    deleteUser = mockUsersDeleteUser;
  },
}));

import { app } from '@/app';

let baseUrl = '';
let server: ReturnType<typeof app.listen>;

const JWT_SECRET = 'integration-test-secret';

function signAccessToken(payload: { sub: string; role: string; t: 'CUSTOMER' | 'USER' }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '5m' });
}

beforeAll(async () => {
  process.env['JWT_SECRET'] = JWT_SECRET;

  server = app.listen(0, '127.0.0.1');

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', (err) => reject(err));
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth + users HTTP integration', () => {
  it('POST /auth/login validates body and returns 400 on invalid payload', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email', password: '' }),
    });

    const body = (await response.json()) as {
      success: boolean;
      error?: { code?: string };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(mockAuthLogin).not.toHaveBeenCalled();
  });

  it('POST /auth/login returns token envelope on success and allows /users/me with USER subject token', async () => {
    const accessToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN', t: 'USER' });
    mockAuthLogin.mockResolvedValue({ accessToken, refreshToken: 'refresh-1' });
    mockUsersGetMe.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: '12345678' }),
    });

    const loginBody = (await loginResponse.json()) as {
      success: boolean;
      data: { accessToken: string; refreshToken: string };
    };

    expect(loginResponse.status).toBe(200);
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.accessToken).toBe(accessToken);

    const meResponse = await fetch(`${baseUrl}/users/me`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    const meBody = (await meResponse.json()) as {
      success: boolean;
      data: { id: string; role: string };
    };

    expect(meResponse.status).toBe(200);
    expect(meBody.success).toBe(true);
    expect(meBody.data.id).toBe('admin-1');
    expect(mockUsersGetMe).toHaveBeenCalledWith('admin-1');
  });

  it('GET /users/me returns 401 without token', async () => {
    const response = await fetch(`${baseUrl}/users/me`);
    const body = (await response.json()) as { success: boolean; error?: { code?: string } };

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  it('GET /users/me returns 401 when token subject is CUSTOMER', async () => {
    const customerToken = signAccessToken({ sub: 'cust-1', role: 'CUSTOMER', t: 'CUSTOMER' });

    const response = await fetch(`${baseUrl}/users/me`, {
      headers: { authorization: `Bearer ${customerToken}` },
    });

    const body = (await response.json()) as { success: boolean; error?: { code?: string } };

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
    expect(mockUsersGetMe).not.toHaveBeenCalled();
  });

  it('GET /users returns 403 when authenticated subject is USER but role is not admin', async () => {
    const nonAdminUserToken = signAccessToken({ sub: 'user-1', role: 'CUSTOMER', t: 'USER' });

    const response = await fetch(`${baseUrl}/users`, {
      headers: { authorization: `Bearer ${nonAdminUserToken}` },
    });

    const body = (await response.json()) as { success: boolean; error?: { code?: string } };

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('FORBIDDEN');
    expect(mockUsersListUsers).not.toHaveBeenCalled();
  });

  it('GET /users returns 200 for ADMIN user token', async () => {
    const adminToken = signAccessToken({ sub: 'admin-1', role: 'ADMIN', t: 'USER' });
    mockUsersListUsers.mockResolvedValue([{ id: 'admin-1' }, { id: 'user-2' }]);

    const response = await fetch(`${baseUrl}/users`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const body = (await response.json()) as { success: boolean; data: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(mockUsersListUsers).toHaveBeenCalledTimes(1);
  });
});
