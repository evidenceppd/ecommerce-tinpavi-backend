import type { Review, ReviewStatus } from '@/generated/prisma/client';
import { prisma } from '@/shared/infra/prisma';

export class ReviewsRepository {
  async create(data: {
    customerId: string;
    productId: string;
    rating: number;
    comment?: string;
    status?: ReviewStatus;
    isVerifiedPurchase: boolean;
  }): Promise<Review> {
    return prisma.review.create({ data });
  }

  async findById(id: string): Promise<Review | null> {
    return prisma.review.findUnique({ where: { id } });
  }

  async findByCustomerAndProduct(customerId: string, productId: string): Promise<Review | null> {
    return prisma.review.findUnique({
      where: { customerId_productId: { customerId, productId } },
    });
  }

  async update(
    id: string,
    data: {
      rating?: number;
      comment?: string;
      status?: ReviewStatus;
      moderatedBy?: string;
      moderatedAt?: Date;
    },
  ): Promise<Review> {
    return prisma.review.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.review.delete({ where: { id } });
  }

  async listAdmin(filter: {
    status?: ReviewStatus;
    page: number;
    limit: number;
  }): Promise<{ items: Review[]; total: number }> {
    const { status, page, limit } = filter;
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { title: true } }, customer: { select: { name: true } } },
      }),
      prisma.review.count({ where }),
    ]);

    return { items, total };
  }

  async listByProduct(
    productId: string,
    options: { page: number; limit: number },
  ): Promise<{ items: Review[]; total: number }> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = { productId, status: 'APPROVED' as ReviewStatus, isVerifiedPurchase: true };
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } },
      }),
      prisma.review.count({ where }),
    ]);
    return { items, total };
  }

  async aggregateApproved(productId: string): Promise<{ count: number; avg: number }> {
    const agg = await prisma.review.aggregate({
      where: { productId, status: 'APPROVED', isVerifiedPurchase: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return { count: agg._count.rating, avg: agg._avg.rating ?? 0 };
  }
}
