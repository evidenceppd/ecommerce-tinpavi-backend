import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../admin.repository', () => ({
  AdminRepository: class AdminRepository {
    getDashboardOverview = vi.fn();
    getSalesOrders = vi.fn();
    getLowStockProducts = vi.fn();
    getPendingReviewQueuePreview = vi.fn();
  },
}));

import { AdminService } from '../admin.service';

describe('AdminService', () => {
  const repo = {
    getDashboardOverview: vi.fn(),
    getSalesOrders: vi.fn(),
    getLowStockProducts: vi.fn(),
    getPendingReviewQueuePreview: vi.fn(),
  };

  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService(repo as any);
  });

  it('uses default queuePreviewLimit in dashboard overview', async () => {
    repo.getDashboardOverview.mockResolvedValue({ metrics: true });

    const result = await service.getDashboardOverview();

    expect(repo.getDashboardOverview).toHaveBeenCalledWith(5);
    expect(result).toEqual({ metrics: true });
  });

  it('aggregates and sorts sales report buckets by day', async () => {
    repo.getSalesOrders.mockResolvedValue([
      {
        createdAt: new Date('2026-05-06T10:00:00.000Z'),
        totalAmount: 100,
        discountAmount: 10,
        shippingCost: 15,
      },
      {
        createdAt: new Date('2026-05-05T10:00:00.000Z'),
        totalAmount: 200,
        discountAmount: 20,
        shippingCost: 25,
      },
      {
        createdAt: new Date('2026-05-06T12:00:00.000Z'),
        totalAmount: 50,
        discountAmount: 0,
        shippingCost: 5,
      },
    ]);

    const result = await service.getSalesReport({
      dateFrom: new Date('2026-05-01T00:00:00.000Z'),
      dateTo: new Date('2026-05-31T23:59:59.000Z'),
    } as any);

    expect(result.totals).toEqual({
      ordersCount: 3,
      revenue: 350,
      discountAmount: 30,
      shippingAmount: 45,
    });
    expect(result.buckets).toEqual([
      {
        period: '2026-05-05',
        ordersCount: 1,
        revenue: 200,
        discountAmount: 20,
        shippingAmount: 25,
      },
      {
        period: '2026-05-06',
        ordersCount: 2,
        revenue: 150,
        discountAmount: 10,
        shippingAmount: 20,
      },
    ]);
  });

  it('paginates low stock report from full repository list', async () => {
    repo.getLowStockProducts.mockResolvedValue([
      { id: 'p1', totalStock: 1 },
      { id: 'p2', totalStock: 2 },
      { id: 'p3', totalStock: 3 },
    ]);

    const result = await service.getLowStockReport({
      threshold: 5,
      includeInactive: false,
      page: 2,
      limit: 1,
    } as any);

    expect(repo.getLowStockProducts).toHaveBeenCalledWith(5, false);
    expect(result.total).toBe(3);
    expect(result.items).toEqual([{ id: 'p2', totalStock: 2 }]);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(1);
  });

  it('delegates pending review queue preview', async () => {
    repo.getPendingReviewQueuePreview.mockResolvedValue([{ id: 'rev-1' }]);
    const result = await service.getPendingReviewQueuePreview(3);
    expect(repo.getPendingReviewQueuePreview).toHaveBeenCalledWith(3);
    expect(result).toEqual([{ id: 'rev-1' }]);
  });
});
