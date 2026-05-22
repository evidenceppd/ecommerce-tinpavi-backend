import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryRaw, mockExecuteRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

import { UsersRepository } from '../users.repository';

describe('UsersRepository', () => {
  let repository: UsersRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UsersRepository();
  });

  it('listAll returns rows from raw query', async () => {
    const rows = [
      {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
        isActive: true,
        firstLogin: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    mockQueryRaw.mockResolvedValue(rows);

    const result = await repository.listAll();

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(rows);
  });

  it('findById returns first row or null', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'user-1' }]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const found = await repository.findById('user-1');
    const missing = await repository.findById('missing');

    expect(found).toEqual({ id: 'user-1' });
    expect(missing).toBeNull();
  });

  it('findByEmail returns first row or null', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'user-1', email: 'admin@example.com' }]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const found = await repository.findByEmail('admin@example.com');
    const missing = await repository.findByEmail('ghost@example.com');

    expect(found).toEqual({ id: 'user-1', email: 'admin@example.com' });
    expect(missing).toBeNull();
  });

  it('create executes insert statement', async () => {
    mockExecuteRaw.mockResolvedValue(1);

    await repository.create({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
      firstLogin: false,
      password: 'hashed',
    });

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockExecuteRaw.mock.calls[0]).toContain('user-1');
    expect(mockExecuteRaw.mock.calls[0]).toContain('admin@example.com');
  });

  it('updateById executes update statement with nullable fields', async () => {
    mockExecuteRaw.mockResolvedValue(1);

    await repository.updateById('user-1', {
      email: 'updated@example.com',
      name: 'Updated',
      role: 'EDITOR',
      isActive: false,
      firstLogin: true,
      password: 'new-hash',
    });

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockExecuteRaw.mock.calls[0]).toContain('user-1');
    expect(mockExecuteRaw.mock.calls[0]).toContain('updated@example.com');
    expect(mockExecuteRaw.mock.calls[0]).toContain('EDITOR');
    expect(mockExecuteRaw.mock.calls[0]).toContain(false);
    expect(mockExecuteRaw.mock.calls[0]).toContain(true);
  });

  it('deleteById executes delete statement', async () => {
    mockExecuteRaw.mockResolvedValue(1);

    await repository.deleteById('user-1');

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockExecuteRaw.mock.calls[0]).toContain('user-1');
  });
});
