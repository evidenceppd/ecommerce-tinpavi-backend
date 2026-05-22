import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryRaw, mockCustomerFindUnique, mockCustomerCreate } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockCustomerFindUnique: vi.fn(),
  mockCustomerCreate: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    customer: {
      findUnique: mockCustomerFindUnique,
      create: mockCustomerCreate,
    },
  },
}));

import { AuthRepository } from '../auth.repository';

describe('AuthRepository', () => {
  let repository: AuthRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AuthRepository();
  });

  it('findAdminUserByEmail returns first admin row or null', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'u-1', email: 'admin@example.com' }]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const found = await repository.findAdminUserByEmail('admin@example.com');
    const missing = await repository.findAdminUserByEmail('ghost@example.com');

    expect(found).toEqual({ id: 'u-1', email: 'admin@example.com' });
    expect(missing).toBeNull();
  });

  it('findAdminUserById returns first admin row or null', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'u-1' }]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const found = await repository.findAdminUserById('u-1');
    const missing = await repository.findAdminUserById('u-404');

    expect(found).toEqual({ id: 'u-1' });
    expect(missing).toBeNull();
  });

  it('findByEmail delegates to prisma.customer.findUnique', async () => {
    mockCustomerFindUnique.mockResolvedValue({ id: 'c-1', email: 'c@example.com' });

    const result = await repository.findByEmail('c@example.com');

    expect(mockCustomerFindUnique).toHaveBeenCalledWith({ where: { email: 'c@example.com' } });
    expect(result).toMatchObject({ id: 'c-1' });
  });

  it('findById delegates to prisma.customer.findUnique', async () => {
    mockCustomerFindUnique.mockResolvedValue({ id: 'c-1' });

    const result = await repository.findById('c-1');

    expect(mockCustomerFindUnique).toHaveBeenCalledWith({ where: { id: 'c-1' } });
    expect(result).toMatchObject({ id: 'c-1' });
  });

  it('create delegates to prisma.customer.create', async () => {
    mockCustomerCreate.mockResolvedValue({ id: 'c-1', email: 'c@example.com' });

    const result = await repository.create({
      name: 'Customer',
      email: 'c@example.com',
      password: 'hashed',
    });

    expect(mockCustomerCreate).toHaveBeenCalledWith({
      data: {
        name: 'Customer',
        email: 'c@example.com',
        password: 'hashed',
      },
    });
    expect(result).toMatchObject({ id: 'c-1' });
  });
});
