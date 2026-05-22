import type { DashboardQueryDto, LowStockReportQueryDto, SalesReportQueryDto } from './admin.schemas';
import { AdminRepository } from './admin.repository';

const repository = new AdminRepository();

type SalesReportBucket = {
  period: string;
  ordersCount: number;
  revenue: number;
  discountAmount: number;
  shippingAmount: number;
};

export class AdminService {
  constructor(private readonly repo: AdminRepository = repository) {}

  async getDashboardOverview(query?: DashboardQueryDto) {
    const queuePreviewLimit = query?.queuePreviewLimit ?? 5;
    return this.repo.getDashboardOverview(queuePreviewLimit, query?.dateFrom, query?.dateTo);
  }

  async getSalesReport(query: SalesReportQueryDto): Promise<{
    granularity: 'day';
    dateFrom: string;
    dateTo: string;
    totals: {
      ordersCount: number;
      revenue: number;
      discountAmount: number;
      shippingAmount: number;
    };
    buckets: SalesReportBucket[];
  }> {
    const orders = await this.repo.getSalesOrders(query.dateFrom, query.dateTo);
    const buckets = new Map<string, SalesReportBucket>();

    const brDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
    for (const order of orders) {
      const period = brDateFormat.format(order.createdAt);
      const current = buckets.get(period) ?? {
        period,
        ordersCount: 0,
        revenue: 0,
        discountAmount: 0,
        shippingAmount: 0,
      };

      current.ordersCount += 1;
      current.revenue += order.totalAmount;
      current.discountAmount += order.discountAmount;
      current.shippingAmount += order.shippingCost;
      buckets.set(period, current);
    }

    const sortedBuckets = Array.from(buckets.values()).sort((left, right) =>
      left.period.localeCompare(right.period),
    );

    return {
      granularity: 'day',
      dateFrom: query.dateFrom.toISOString(),
      dateTo: query.dateTo.toISOString(),
      totals: {
        ordersCount: orders.length,
        revenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
        discountAmount: orders.reduce((sum, order) => sum + order.discountAmount, 0),
        shippingAmount: orders.reduce((sum, order) => sum + order.shippingCost, 0),
      },
      buckets: sortedBuckets,
    };
  }

  async getLowStockReport(query: LowStockReportQueryDto): Promise<{
    items: Array<{
      id: string;
      title: string;
      code: string;
      quantity_stock: number;
      reviews: number;
      sales: number;
      pricing: number;
      pix_pricing: number;
      category: {
        id: string;
        title: string;
      };
    }>;
    total: number;
    page: number;
    limit: number;
    threshold: number;
    includeInactive: boolean;
  }> {
    const items = await this.repo.getLowStockProducts(query.threshold, query.includeInactive);
    const start = (query.page - 1) * query.limit;
    const paginatedItems = items.slice(start, start + query.limit);

    return {
      items: paginatedItems,
      total: items.length,
      page: query.page,
      limit: query.limit,
      threshold: query.threshold,
      includeInactive: query.includeInactive,
    };
  }

  async getPendingReviewQueuePreview(limit: number) {
    return this.repo.getPendingReviewQueuePreview(limit);
  }
}