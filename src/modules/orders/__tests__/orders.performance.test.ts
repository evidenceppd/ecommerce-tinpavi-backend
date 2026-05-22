/**
 * orders.performance.test.ts
 *
 * Performance regression guards for OrdersRepository.
 * Enforces bounded query patterns and no N+1 for order listings.
 *
 * Run:
 *   npx vitest run src/modules/orders/__tests__/orders.performance.test.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockOrderFindMany, mockOrderCount } = vi.hoisted(() => ({
  mockOrderFindMany: vi.fn(),
  mockOrderCount: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    order: {
      findMany: mockOrderFindMany,
      count: mockOrderCount,
    },
  },
}));

import { OrdersRepository } from '../orders.repository';

describe('OrdersRepository — performance regression guards', () => {
  let repo: OrdersRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new OrdersRepository();
    mockOrderFindMany.mockResolvedValue([]);
    mockOrderCount.mockResolvedValue(0);
  });

  it('issues exactly 2 prisma calls (findMany + count) for order listing', async () => {
    await repo.listAdmin({ page: 1, limit: 20 });

    expect(mockOrderFindMany).toHaveBeenCalledTimes(1);
    expect(mockOrderCount).toHaveBeenCalledTimes(1);
  });

  it('enforces hard pagination cap of 100', async () => {
    await repo.listAdmin({ page: 1, limit: 9999 });

    const args = mockOrderFindMany.mock.calls[0]?.[0] as { take: number };
    expect(args.take).toBeLessThanOrEqual(100);
  });

  it('includes order items inline in findMany (no per-order item lookups)', async () => {
    await repo.listAdmin({ page: 1, limit: 20 });

    const args = mockOrderFindMany.mock.calls[0]?.[0] as {
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    };

    const hasItems =
      args.include?.['items'] !== undefined ||
      args.include?.['orderItems'] !== undefined ||
      args.select?.['items'] !== undefined ||
      args.select?.['orderItems'] !== undefined;
    expect(hasItems).toBe(true);
  });
});
