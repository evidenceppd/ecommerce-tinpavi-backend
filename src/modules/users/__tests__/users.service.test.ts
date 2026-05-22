import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockListAll,
  mockFindById,
  mockFindByEmail,
  mockCreate,
  mockUpdateById,
  mockDeleteById,
} = vi.hoisted(() => ({
  mockListAll: vi.fn(),
  mockFindById: vi.fn(),
  mockFindByEmail: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdateById: vi.fn(),
  mockDeleteById: vi.fn(),
}));

vi.mock('../users.repository', () => ({
  UsersRepository: class UsersRepository {
    listAll = mockListAll;
    findById = mockFindById;
    findByEmail = mockFindByEmail;
    create = mockCreate;
    updateById = mockUpdateById;
    deleteById = mockDeleteById;
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'uuid-user-1'),
}));

import bcrypt from 'bcrypt';
import { UsersService } from '../users.service';

const mockBcrypt = vi.mocked(bcrypt);

function makeAdmin(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'ADMIN',
    isActive: true,
    firstLogin: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBcrypt.hash.mockResolvedValue('hashed-password' as never);
    service = new UsersService();
  });

  it('listUsers delegates to repository', async () => {
    mockListAll.mockResolvedValue([makeAdmin()]);

    const result = await service.listUsers();

    expect(mockListAll).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('getMe returns user when found', async () => {
    mockFindById.mockResolvedValue(makeAdmin());

    const result = await service.getMe('user-1');

    expect(result.email).toBe('admin@example.com');
  });

  it('getMe throws 404 when user is missing', async () => {
    mockFindById.mockResolvedValue(null);

    await expect(service.getMe('missing')).rejects.toMatchObject({ statusCode: 404, message: 'User not found' });
  });

  it('createUser blocks creating MASTER because it is seed-only', async () => {
    await expect(
      service.createUser(
        {
          email: 'master@example.com',
          name: 'Master',
          password: '12345678',
          role: 'MASTER',
          isActive: true,
          firstLogin: false,
        },
        'ADMIN',
      ),
    ).rejects.toMatchObject({ statusCode: 403, message: 'MASTER is a seed-only user role' });
  });

  it('createUser blocks editor from creating users', async () => {
    await expect(
      service.createUser(
        {
          email: 'admin@example.com',
          name: 'Admin',
          password: '12345678',
          role: 'ADMIN',
          isActive: true,
          firstLogin: false,
        },
        'EDITOR',
      ),
    ).rejects.toMatchObject({ statusCode: 403, message: 'EDITOR cannot create users' });
  });

  it('createUser hashes password, creates and returns persisted user', async () => {
    mockFindByEmail.mockResolvedValue(null);
    mockFindById.mockResolvedValue(makeAdmin({ id: 'uuid-user-1' }));

    const result = await service.createUser(
      {
        email: 'admin@example.com',
        name: 'Admin',
        password: '12345678',
        role: 'ADMIN',
        isActive: true,
        firstLogin: false,
      },
      'MASTER',
    );

    expect(mockBcrypt.hash).toHaveBeenCalledWith('12345678', 12);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'uuid-user-1',
        email: 'admin@example.com',
        password: 'hashed-password',
      }),
    );
    expect(result.id).toBe('uuid-user-1');
  });

  it('updateUser blocks self deactivation', async () => {
    mockFindById.mockResolvedValue(makeAdmin({ id: 'actor-1' }));

    await expect(service.updateUser('actor-1', { isActive: false }, 'actor-1', 'MASTER')).rejects.toMatchObject({
      statusCode: 400,
      message: 'You cannot deactivate your own account',
    });
  });

  it('updateUser rejects email conflict', async () => {
    mockFindById.mockResolvedValue(makeAdmin({ id: 'target-1', email: 'old@example.com' }));
    mockFindByEmail.mockResolvedValue(makeAdmin({ id: 'other-user', email: 'taken@example.com' }));

    await expect(
      service.updateUser('target-1', { email: 'taken@example.com' }, 'actor-1', 'MASTER'),
    ).rejects.toMatchObject({ statusCode: 409, message: 'Email already in use' });
  });

  it('updateMe hashes password and updates user', async () => {
    mockFindById
      .mockResolvedValueOnce(makeAdmin({ id: 'user-1', email: 'old@example.com' }))
      .mockResolvedValueOnce(makeAdmin({ id: 'user-1', email: 'new@example.com' }));
    mockFindByEmail.mockResolvedValue(null);

    const result = await service.updateMe('user-1', {
      email: 'new@example.com',
      password: 'new-password-123',
    });

    expect(mockBcrypt.hash).toHaveBeenCalledWith('new-password-123', 12);
    expect(mockUpdateById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ email: 'new@example.com', password: 'hashed-password' }),
    );
    expect(result.email).toBe('new@example.com');
  });

  it('deleteUser blocks deleting self', async () => {
    mockFindById.mockResolvedValue(makeAdmin({ id: 'actor-1', role: 'ADMIN' }));

    await expect(service.deleteUser('actor-1', 'actor-1', 'MASTER')).rejects.toMatchObject({
      statusCode: 400,
      message: 'You cannot delete your own account',
    });
  });

  it('deleteUser blocks deleting MASTER', async () => {
    mockFindById.mockResolvedValueOnce(makeAdmin({ id: 'master-1', role: 'MASTER' }));

    await expect(service.deleteUser('master-1', 'actor-1', 'MASTER')).rejects.toMatchObject({
      statusCode: 403,
      message: 'MASTER account cannot be deleted',
    });
  });

  it('deleteUser deletes allowed target', async () => {
    mockFindById.mockResolvedValue(makeAdmin({ id: 'editor-1', role: 'EDITOR' }));

    await service.deleteUser('editor-1', 'master-1', 'MASTER');

    expect(mockDeleteById).toHaveBeenCalledWith('editor-1');
  });
});
