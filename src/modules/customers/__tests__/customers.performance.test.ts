/**
 * customers.performance.test.ts
 *
 * Performance regression guards for CustomersRepository.
 * Enforces bounded query patterns and no N+1 for customer listings.
 *
 * Run:
 *   npx vitest run src/modules/customers/__tests__/customers.performance.test.ts
 */

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

describe('CustomersRepository — performance regression guards', () => {
  let repo: CustomersRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new CustomersRepository();
    mockCustomerFindMany.mockResolvedValue([]);
    mockCustomerCount.mockResolvedValue(0);
  });

  it('issues exactly 2 prisma calls (findMany + count) for customer listing', async () => {
    await repo.listAdminCustomers({ page: 1, limit: 20 });

    expect(mockCustomerFindMany).toHaveBeenCalledTimes(1);
    expect(mockCustomerCount).toHaveBeenCalledTimes(1);
  });

  it('enforces hard pagination cap of 100', async () => {
    await repo.listAdminCustomers({ page: 1, limit: 9999 });

    const args = mockCustomerFindMany.mock.calls[0]?.[0] as { take: number };
    expect(args.take).toBeLessThanOrEqual(100);
  });
});
