import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockOrderFindMany,
  mockOrderCount,
  mockCustomerCount,
  mockReviewCount,
  mockProductFindMany,
  mockReviewFindMany,
  mockPageViewGroupBy,
  mockOrderItemGroupBy,
  mockCartCount,
} = vi.hoisted(() => ({
  mockOrderFindMany: vi.fn(),
  mockOrderCount: vi.fn(),
  mockCustomerCount: vi.fn(),
  mockReviewCount: vi.fn(),
  mockProductFindMany: vi.fn(),
  mockReviewFindMany: vi.fn(),
  mockPageViewGroupBy: vi.fn(),
  mockOrderItemGroupBy: vi.fn(),
  mockCartCount: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    order: {
      findMany: mockOrderFindMany,
      count: mockOrderCount,
    },
    customer: {
      count: mockCustomerCount,
    },
    review: {
      count: mockReviewCount,
      findMany: mockReviewFindMany,
    },
    product: {
      findMany: mockProductFindMany,
    },
    pageView: {
      groupBy: mockPageViewGroupBy,
    },
    orderItem: {
      groupBy: mockOrderItemGroupBy,
    },
    cart: {
      count: mockCartCount,
    },
  },
}));

import { AdminRepository } from '../admin.repository';

describe('AdminRepository', () => {
  let repository: AdminRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AdminRepository();
  });

  it('getDashboardOverview computes metrics and maps recent orders totalAmount to number', async () => {
    mockOrderFindMany
      .mockResolvedValueOnce([{ totalAmount: 100.5 }, { totalAmount: 99.5 }])
      .mockResolvedValueOnce([
        {
          id: 'ord-1',
          status: 'PAID',
          totalAmount: 200,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          customer: { id: 'c-1', name: 'Customer', email: 'c@example.com' },
        },
      ]);
    mockOrderCount.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
    mockCustomerCount.mockResolvedValue(7);
    mockReviewCount.mockResolvedValue(3);
    mockProductFindMany
      .mockResolvedValueOnce([
        { id: 'p-1', quantity_stock: 5 },
        { id: 'p-2', quantity_stock: 6 },
      ])
      .mockResolvedValueOnce([{ id: 'p-1', title: 'Produto', code: 'ABC12345', slug: 'produto' }])
      .mockResolvedValueOnce([{ id: 'p-1', title: 'Produto', code: 'ABC12345' }]);
    mockReviewFindMany.mockResolvedValue([
      {
        id: 'r-1',
        rating: 5,
        comment: 'ok',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        customer: { id: 'c-1', name: 'Customer', email: 'c@example.com' },
        product: { id: 'p-1', title: 'Produto', code: 'ABC12345' },
      },
    ]);
    mockPageViewGroupBy.mockResolvedValue([{ page: '/produto/produto', _count: { page: 8 } }]);
    mockOrderItemGroupBy.mockResolvedValue([{ productId: 'p-1', _sum: { quantity: 4 } }]);
    mockCartCount.mockResolvedValue(2);

    const result = await repository.getDashboardOverview(5);

    expect(result.metrics).toMatchObject({
      totalRevenue: 200,
      totalOrders: 10,
      pendingPaymentOrders: 2,
      totalCustomers: 7,
      pendingReviews: 3,
      lowStockCount: 1,
    });
    expect(result.recentOrders[0]?.totalAmount).toBe(200);
    expect(result.pendingReviewQueue).toHaveLength(1);
    expect(result.analytics.abandonedCartsCount).toBe(2);
    expect(mockCartCount).toHaveBeenCalledWith({
      where: {
        updatedAt: { lt: expect.any(Date) },
        items: { some: {} },
      },
    });
    expect(result.analytics.mostVisitedProducts[0]?.count).toBe(8);
    expect(result.analytics.bestSellingProducts[0]?.count).toBe(4);
  });

  it('getSalesOrders maps numeric fields to numbers and keeps order by createdAt asc', async () => {
    mockOrderFindMany.mockResolvedValue([
      {
        id: 'ord-1',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        totalAmount: 150,
        discountAmount: 10,
        shippingCost: 20,
        status: 'PAID',
      },
    ]);

    const dateFrom = new Date('2026-01-01T00:00:00.000Z');
    const dateTo = new Date('2026-01-31T23:59:59.999Z');
    const result = await repository.getSalesOrders(dateFrom, dateTo);

    expect(mockOrderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PAID', 'DELIVERED'] },
          createdAt: { gte: dateFrom, lte: dateTo },
        }),
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(result[0]).toMatchObject({ totalAmount: 150, discountAmount: 10, shippingCost: 20 });
  });

  it('getLowStockProducts filters by threshold after mapping product payload', async () => {
    mockProductFindMany.mockResolvedValue([
      {
        id: 'p-1',
        title: 'A',
        code: 'AAAA1111',
        quantity_stock: 3,
        reviews: 0,
        sales: 0,
        pricing: 10,
        pix_pricing: 9,
        category: { id: 'cat-1', title: 'Cat' },
      },
      {
        id: 'p-2',
        title: 'B',
        code: 'BBBB2222',
        quantity_stock: 9,
        reviews: 0,
        sales: 0,
        pricing: 20,
        pix_pricing: 18,
        category: { id: 'cat-1', title: 'Cat' },
      },
    ]);

    const result = await repository.getLowStockProducts(5, false);

    expect(mockProductFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { updatedAt: 'desc' },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('p-1');
  });

  it('getPendingReviewQueuePreview delegates query with limit', async () => {
    mockReviewFindMany.mockResolvedValue([{ id: 'r-1' }]);

    const result = await repository.getPendingReviewQueuePreview(3);

    expect(mockReviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result).toEqual([{ id: 'r-1' }]);
  });
});
