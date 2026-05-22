import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCustomerFindMany, mockCustomerCount } = vi.hoisted(() => ({
  mockCustomerFindMany: vi.fn(),
  mockCustomerCount: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    customer: {
      findMany: mockCustomerFindMany,
      count: mockCustomerCount,
    },
  },
}));

import { CustomersRepository } from '../customers.repository';

describe('CustomersRepository.listAdminCustomers', () => {
  let repository: CustomersRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new CustomersRepository();

    mockCustomerFindMany.mockResolvedValue([
      {
        id: 'cust-1',
        email: 'customer@example.com',
        name: 'Customer',
        phone: null,
        role: 'CUSTOMER',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        _count: {
          addresses: 2,
          orders: 3,
        },
      },
    ]);
    mockCustomerCount.mockResolvedValue(1);
  });

  it('caps page size at 100 and maps relation counts', async () => {
    const result = await repository.listAdminCustomers({ page: 1, limit: 500 });

    const args = mockCustomerFindMany.mock.calls[0]?.[0] as { take: number };
    expect(args.take).toBe(100);
    expect(result.items[0]).toMatchObject({ addressesCount: 2, ordersCount: 3 });
  });
});
