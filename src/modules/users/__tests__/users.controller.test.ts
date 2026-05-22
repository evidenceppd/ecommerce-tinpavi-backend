import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockListUsers,
  mockGetMe,
  mockCreateUser,
  mockUpdateUser,
  mockUpdateMe,
  mockDeleteUser,
} = vi.hoisted(() => ({
  mockListUsers: vi.fn(),
  mockGetMe: vi.fn(),
  mockCreateUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockUpdateMe: vi.fn(),
  mockDeleteUser: vi.fn(),
}));

vi.mock('../users.service', () => ({
  UsersService: class UsersService {
    listUsers = mockListUsers;
    getMe = mockGetMe;
    createUser = mockCreateUser;
    updateUser = mockUpdateUser;
    updateMe = mockUpdateMe;
    deleteUser = mockDeleteUser;
  },
}));

import {
  createUserController,
  deleteUserController,
  getMeUserController,
  listUsersController,
  updateMeUserController,
  updateUserController,
} from '../users.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
}

describe('users.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listUsersController returns 200 with data for authenticated admin actor', async () => {
    const req = { user: { id: 'actor-1', role: 'ADMIN' } };
    const res = createResponse();
    mockListUsers.mockResolvedValue([{ id: 'user-1' }]);

    await listUsersController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('getMeUserController returns 401 for non-USER subject', async () => {
    const req = { user: { id: 'actor-1', role: 'ADMIN', subjectType: 'CUSTOMER' } };
    const res = createResponse();

    await getMeUserController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    );
  });

  it('getMeUserController maps not found to NOT_FOUND', async () => {
    const req = { user: { id: 'user-404', role: 'ADMIN', subjectType: 'USER' } };
    const res = createResponse();
    mockGetMe.mockRejectedValue(Object.assign(new Error('User not found'), { statusCode: 404 }));

    await getMeUserController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      }),
    );
  });

  it('createUserController maps duplicate email to CONFLICT', async () => {
    const req = {
      user: { id: 'master-1', role: 'MASTER' },
      body: { email: 'admin@example.com', name: 'Admin', role: 'ADMIN', password: '12345678' },
    };
    const res = createResponse();
    mockCreateUser.mockRejectedValue(Object.assign(new Error('Email already in use'), { statusCode: 409 }));

    await createUserController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'CONFLICT' }),
      }),
    );
  });

  it('updateUserController maps permission errors to FORBIDDEN', async () => {
    const req = {
      params: { id: 'user-1' },
      user: { id: 'actor-1', role: 'ADMIN' },
      body: { role: 'MASTER' },
    };
    const res = createResponse();
    mockUpdateUser.mockRejectedValue(
      Object.assign(new Error('Only MASTER can assign MASTER role'), { statusCode: 403 }),
    );

    await updateUserController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    );
  });

  it('updateMeUserController returns 200 with updated data', async () => {
    const req = {
      user: { id: 'user-1', role: 'ADMIN', subjectType: 'USER' },
      body: { name: 'Updated Name' },
    };
    const res = createResponse();
    mockUpdateMe.mockResolvedValue({ id: 'user-1', name: 'Updated Name' });

    await updateMeUserController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('deleteUserController returns 204 on success', async () => {
    const req = {
      params: { id: 'user-2' },
      user: { id: 'master-1', role: 'MASTER' },
    };
    const res = createResponse();

    mockDeleteUser.mockResolvedValue(undefined);

    await deleteUserController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
  });
});
