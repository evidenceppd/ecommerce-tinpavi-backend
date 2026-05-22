import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRegister,
  mockLogin,
  mockVerifyAdminMfa,
  mockRefresh,
  mockLogout,
} = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockLogin: vi.fn(),
  mockVerifyAdminMfa: vi.fn(),
  mockRefresh: vi.fn(),
  mockLogout: vi.fn(),
}));

vi.mock('../auth.service', () => ({
  AuthService: class AuthService {
    register = mockRegister;
    login = mockLogin;
    verifyAdminMfa = mockVerifyAdminMfa;
    refresh = mockRefresh;
    logout = mockLogout;
  },
}));

import {
  loginController,
  logoutController,
  refreshController,
  registerController,
  verifyAdminMfaController,
} from '../auth.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
}

describe('auth.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registerController returns 201 on success', async () => {
    const req = { body: { email: 'new@example.com', password: '12345678' } };
    const res = createResponse();
    mockRegister.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });

    await registerController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('registerController maps conflict to 409/CONFLICT', async () => {
    const req = { body: { email: 'dup@example.com' } };
    const res = createResponse();
    mockRegister.mockRejectedValue(Object.assign(new Error('Email already in use'), { statusCode: 409 }));

    await registerController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'CONFLICT' }),
      }),
    );
  });

  it('loginController maps invalid credentials to 401/UNAUTHORIZED', async () => {
    const req = { body: { email: 'a@a.com', password: 'wrong' } };
    const res = createResponse();
    mockLogin.mockRejectedValue(Object.assign(new Error('Invalid credentials'), { statusCode: 401 }));

    await loginController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    );
  });

  it('refreshController returns 200 on success', async () => {
    const req = { body: { refreshToken: 'r1' } };
    const res = createResponse();
    mockRefresh.mockResolvedValue({ accessToken: 'access-2' });

    await refreshController(req as any, res as any);

    expect(mockRefresh).toHaveBeenCalledWith({ refreshToken: 'r1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('verifyAdminMfaController returns 200 on success', async () => {
    const req = { body: { challengeId: 'challenge-1', code: '123456' } };
    const res = createResponse();
    mockVerifyAdminMfa.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });

    await verifyAdminMfaController(req as any, res as any);

    expect(mockVerifyAdminMfa).toHaveBeenCalledWith({ challengeId: 'challenge-1', code: '123456' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('logoutController returns 204 and sends empty body', async () => {
    const req = { body: { refreshToken: 'r1' } };
    const res = createResponse();

    mockLogout.mockResolvedValue(undefined);

    await logoutController(req as any, res as any);

    expect(mockLogout).toHaveBeenCalledWith({ refreshToken: 'r1' });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
  });
});
