import { prisma } from '@/shared/infra/prisma';

type DashboardMetrics = {
  totalRevenue: number;
  totalOrders: number;
  pendingPaymentOrders: number;
  totalCustomers: number;
  pendingReviews: number;
  totalReviews: number;
  lowStockCount: number;
};

type DashboardProductMetric = {
  id: string;
  title: string;
  code: string;
  count: number;
};

type RecentOrderPreview = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  items: Array<{
    quantity: number;
    product: {
      title: string;
      code: string;
    };
  }>;
  customer: {
    id: string;
    name: string;
    email: string;
  };
};

type PendingReviewPreview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  product: {
    id: string;
    title: string;
    code: string;
  };
};

type SalesOrderRow = {
  id: string;
  createdAt: Date;
  totalAmount: number;
  discountAmount: number;
  shippingCost: number;
  status: string;
};

type LowStockItem = {
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
};

const DASHBOARD_LOW_STOCK_THRESHOLD = 5;

export class AdminRepository {
  async getDashboardOverview(queuePreviewLimit: number, dateFrom?: Date, dateTo?: Date): Promise<{
    metrics: DashboardMetrics;
    recentOrders: RecentOrderPreview[];
    pendingReviewQueue: PendingReviewPreview[];
    analytics: {
      mostVisitedProducts: DashboardProductMetric[];
      bestSellingProducts: DashboardProductMetric[];
      abandonedCartsCount: number;
    };
  }> {
    const abandonedSince = new Date(Date.now() - 60 * 60 * 1000);
    const dateFilter = dateFrom && dateTo ? { gte: dateFrom, lte: dateTo } : undefined;

    const [paidAndDeliveredOrders, totalOrders, pendingPaymentOrders, totalCustomers, pendingReviews, totalReviews, products, recentOrders, pendingReviewQueue, topProductPageRows, soldProductRows, abandonedCartsCount] =
      await Promise.all([
        prisma.order.findMany({
          where: { status: { in: ['PAID', 'DELIVERED'] }, ...(dateFilter && { createdAt: dateFilter }) },
          select: { totalAmount: true },
        }),
        prisma.order.count({ where: dateFilter ? { createdAt: dateFilter } : undefined }),
        prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
        prisma.customer.count(),
        prisma.review.count({ where: { status: 'PENDING' } }),
        prisma.review.count({ where: dateFilter ? { createdAt: dateFilter } : undefined }),
        prisma.product.findMany({
          select: {
            id: true,
            quantity_stock: true,
          },
        }),
        prisma.order.findMany({
          take: queuePreviewLimit,
          orderBy: { createdAt: 'desc' },
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            items: {
              select: {
                quantity: true,
                product: {
                  select: {
                    title: true,
                    code: true,
                  },
                },
              },
            },
          },
        }),
        prisma.review.findMany({
          where: { status: 'PENDING' },
          take: queuePreviewLimit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            product: {
              select: {
                id: true,
                title: true,
                code: true,
              },
            },
          },
        }),
        prisma.pageView.groupBy({
          by: ['page'],
          where: { page: { startsWith: '/produto/' }, ...(dateFilter && { createdAt: dateFilter }) },
          _count: { page: true },
          orderBy: { _count: { page: 'desc' } },
          take: 10,
        }),
        prisma.orderItem.groupBy({
          by: ['productId'],
          where: {
            order: {
              status: { in: ['PAID', 'DELIVERED'] },
              ...(dateFilter && { createdAt: dateFilter }),
            },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        }),
        prisma.cart.count({
          where: {
            updatedAt: { lt: abandonedSince, ...(dateFilter && { gte: dateFilter.gte }) },
            items: { some: {} },
          },
        }),
      ]);

    const totalRevenue = paidAndDeliveredOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );

    const lowStockCount = products.filter(
      (product) => product.quantity_stock <= DASHBOARD_LOW_STOCK_THRESHOLD,
    ).length;

    const visitedCodes = topProductPageRows
      .map((row) => decodeURIComponent(row.page.replace(/^\/produto\//, '').replace(/\/$/, '')))
      .filter(Boolean);
    const [visitedProducts, soldProducts] = await Promise.all([
      visitedCodes.length > 0
        ? prisma.product.findMany({
            where: { OR: [{ code: { in: visitedCodes } }, { slug: { in: visitedCodes } }] },
            select: { id: true, title: true, code: true, slug: true },
          })
        : Promise.resolve([]),
      soldProductRows.length > 0
        ? prisma.product.findMany({
            where: { id: { in: soldProductRows.map((row) => row.productId) } },
            select: { id: true, title: true, code: true },
          })
        : Promise.resolve([]),
    ]);
    const visitedByCodeOrSlug = new Map<string, { id: string; title: string; code: string; slug?: string | null }>();
    for (const product of visitedProducts) {
      visitedByCodeOrSlug.set(product.code, product);
      if (product.slug) visitedByCodeOrSlug.set(product.slug, product);
    }
    const soldById = new Map(soldProducts.map((product) => [product.id, product]));

    return {
      metrics: {
        totalRevenue,
        totalOrders,
        pendingPaymentOrders,
        totalCustomers,
        pendingReviews,
        totalReviews,
        lowStockCount,
      },
      recentOrders: recentOrders.map((order) => ({
        ...order,
        status: order.status,
        totalAmount: Number(order.totalAmount),
      })),
      pendingReviewQueue,
      analytics: {
        mostVisitedProducts: topProductPageRows
          .map((row) => {
            const codeOrSlug = decodeURIComponent(row.page.replace(/^\/produto\//, '').replace(/\/$/, ''));
            const product = visitedByCodeOrSlug.get(codeOrSlug);
            if (!product) return null;
            return { id: product.id, title: product.title, code: product.code, count: row._count.page };
          })
          .filter((item): item is DashboardProductMetric => Boolean(item))
          .slice(0, 5),
        bestSellingProducts: soldProductRows
          .map((row) => {
            const product = soldById.get(row.productId);
            if (!product) return null;
            return { id: product.id, title: product.title, code: product.code, count: row._sum.quantity ?? 0 };
          })
          .filter((item): item is DashboardProductMetric => Boolean(item)),
        abandonedCartsCount,
      },
    };
  }

  async getSalesOrders(dateFrom: Date, dateTo: Date): Promise<SalesOrderRow[]> {
    return prisma.order.findMany({
      where: {
        status: { in: ['PAID', 'DELIVERED'] },
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        discountAmount: true,
        shippingCost: true,
        status: true,
      },
    }).then((orders) =>
      orders.map((order) => ({
        ...order,
        totalAmount: Number(order.totalAmount),
        discountAmount: Number(order.discountAmount),
        shippingCost: Number(order.shippingCost),
      })),
    );
  }

  async getLowStockProducts(threshold: number, includeInactive: boolean): Promise<LowStockItem[]> {
    const products = await prisma.product.findMany({
      where: includeInactive ? undefined : {},
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        code: true,
        quantity_stock: true,
        reviews: true,
        sales: true,
        pricing: true,
        pix_pricing: true,
        category: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return products
      .map((product) => {
        return {
          id: product.id,
          title: product.title,
          code: product.code,
          quantity_stock: product.quantity_stock,
          reviews: product.reviews,
          sales: product.sales,
          pricing: product.pricing,
          pix_pricing: product.pix_pricing,
          category: product.category,
        };
      })
      .filter((product) => product.quantity_stock <= threshold);
  }

  async getPendingReviewQueuePreview(limit: number): Promise<PendingReviewPreview[]> {
    return prisma.review.findMany({
      where: { status: 'PENDING' },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            code: true,
          },
        },
      },
    });
  }
}
