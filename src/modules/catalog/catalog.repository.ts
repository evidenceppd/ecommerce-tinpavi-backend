import { Prisma } from '@/generated/prisma/client';
import type { Product } from '@/generated/prisma/client';
import { prisma } from '@/shared/infra/prisma';
import type { AdminListProductsQueryDto, ListProductsQueryDto } from './catalog.schemas';

const FULL_PRODUCT_INCLUDE = {
  category: true,
  category_links: {
    include: { category: true },
  },
  reviewsList: {
    where: { status: 'APPROVED' as const },
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      customerId: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ProductInclude;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizePagination(page: number, limit: number): { page: number; limit: number; skip: number } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
  const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : DEFAULT_LIMIT;
  const safeLimit = Math.min(Math.max(normalizedLimit, 1), MAX_LIMIT);
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}

export class CatalogRepository {
  async findAdminList(query: AdminListProductsQueryDto) {
    const { category_id, search, lowStockOnly, threshold } = query;
    const { skip, limit } = normalizePagination(query.page, query.limit);

    const andFilters: Prisma.ProductWhereInput[] = [];

    if (category_id) {
      andFilters.push({
        OR: [
          { category_id },
          { category_links: { some: { categoryId: category_id } } },
        ],
      });
    }

    if (lowStockOnly) {
      andFilters.push({ quantity_stock: { lte: threshold } });
    }

    if (search) {
      andFilters.push({
        OR: [
          { title: { contains: search } },
          { code: { contains: search } },
          { benefits: { contains: search } },
        ],
      });
    }

    const where: Prisma.ProductWhereInput = {
      is_active: true,
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          category_links: {
            include: { category: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  async findPublicList(query: ListProductsQueryDto): Promise<{ items: Product[]; total: number }> {
    const { category_id, search, orderBy } = query;
    const { skip, limit } = normalizePagination(query.page, query.limit);

    const andFilters: Prisma.ProductWhereInput[] = [];

    if (category_id) {
      andFilters.push({
        OR: [
          { category_id },
          { category_links: { some: { categoryId: category_id } } },
        ],
      });
    }

    if (search) {
      andFilters.push({
        OR: [{ title: { contains: search } }, { code: { contains: search } }],
      });
    }

    const where: Prisma.ProductWhereInput = {
      is_active: true,
      quantity_stock: { gt: 0 },
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const orderByClause: Prisma.ProductOrderByWithRelationInput =
      orderBy === 'pricing'
        ? { pricing: 'asc' }
        : orderBy === 'title'
          ? { title: 'asc' }
          : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByClause,
        include: {
          category: true,
          category_links: {
            include: { category: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({ where: { id }, include: FULL_PRODUCT_INCLUDE });
  }

  async findByCode(code: string): Promise<Product | null> {
    return prisma.product.findUnique({ where: { code }, include: FULL_PRODUCT_INCLUDE });
  }

  async countSoldByProductIds(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();

    const rows = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        order: {
          OR: [{ paymentStatus: 'PAID' }, { status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } }],
        },
      },
      _sum: { quantity: true },
    });

    return new Map(rows.map((row) => [row.productId, Number(row._sum.quantity ?? 0)]));
  }

  async countApprovedVerifiedReviewsByProductIds(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();

    const rows = await prisma.review.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        status: 'APPROVED',
        isVerifiedPurchase: true,
      },
      _count: { rating: true },
    });

    return new Map(rows.map((row) => [row.productId, Number(row._count.rating ?? 0)]));
  }

  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    const count = await prisma.product.count({
      where: { code, NOT: excludeId ? { id: excludeId } : undefined },
    });
    return count > 0;
  }

  async create(data: {
    category_id: string;
    category_ids: string[];
    code: string;
    title: string;
    slug?: string | null;
    brand?: string | null;
    reviews: number;
    sales: number;
    benefits: string;
    highlights?: Prisma.InputJsonValue;
    faqs?: Prisma.InputJsonValue;
    usage_areas?: Prisma.InputJsonValue;
    variants?: Prisma.InputJsonValue;
    icons: string;
    pricing: number;
    pix_pricing: number;
    compare_at_price?: number | null;
    weight_kg?: number | null;
    dimensions?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
    badge?: string | null;
    is_featured?: boolean;
    is_active?: boolean;
    quantity_stock: number;
    carousel_image: Prisma.InputJsonValue;
    specifications: Prisma.InputJsonValue;
    description: string;
    applications: string;
    where_use: Prisma.InputJsonValue;
  }): Promise<Product> {
    const { category_ids, ...productData } = data;
    const uniqueCategoryIds = Array.from(new Set(category_ids));

    return prisma.product.create({
      data: {
        ...productData,
        category_links: {
          create: uniqueCategoryIds.map((categoryId) => ({ categoryId })),
        },
      } as any,
      include: FULL_PRODUCT_INCLUDE,
    });
  }

  async update(
    id: string,
    data: Partial<{
      category_id: string;
      category_ids: string[];
      code: string;
      title: string;
      slug: string | null;
      brand: string | null;
      reviews: number;
      sales: number;
      benefits: string;
      highlights: Prisma.InputJsonValue;
      faqs: Prisma.InputJsonValue;
      usage_areas: Prisma.InputJsonValue;
      variants: Prisma.InputJsonValue;
      icons: string;
      pricing: number;
      pix_pricing: number;
      compare_at_price: number | null;
      weight_kg: number | null;
      dimensions: string | null;
      seo_title: string | null;
      seo_description: string | null;
      badge: string | null;
      is_featured: boolean;
      is_active: boolean;
      quantity_stock: number;
      carousel_image: Prisma.InputJsonValue;
      specifications: Prisma.InputJsonValue;
      description: string;
      applications: string;
      where_use: Prisma.InputJsonValue;
    }>,
  ): Promise<Product> {
    const { category_ids, ...productData } = data;
    const nextData: Record<string, unknown> = { ...productData };

    if (Array.isArray(category_ids) && category_ids.length > 0) {
      const uniqueCategoryIds = Array.from(new Set(category_ids));
      nextData['category_links'] = {
        deleteMany: {},
        create: uniqueCategoryIds.map((categoryId) => ({ categoryId })),
      };
    }

    return prisma.product.update({ where: { id }, data: nextData as any, include: FULL_PRODUCT_INCLUDE });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.product.update({ where: { id }, data: { is_active: false } });
  }
}
