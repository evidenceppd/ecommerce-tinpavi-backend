import type { Review } from '@/generated/prisma/client';
import { prisma } from '@/shared/infra/prisma';
import { cache } from '@/shared/infra/memory-cache';
import { cachePrefixes } from '@/shared/infra/cache-keys';
import { ReviewsRepository } from './reviews.repository';
import type {
  CreateReviewDto,
  UpdateReviewDto,
  ModerateReviewDto,
  ListAdminReviewsQueryDto,
} from './reviews.schemas';

const repo = new ReviewsRepository();

export class ReviewsService {
  // ── Private helpers ──────────────────────────────────────────────────────

  private async recalcAggregates(productId: string): Promise<void> {
    const { count } = await repo.aggregateApproved(productId);
    await prisma.product.update({
      where: { id: productId },
      data: { reviews: count },
    });
    cache.delByPrefix(cachePrefixes.catalog);
  }

  // ── Public operations ──────────────────────────────────────────────────

  async listReviews(
    productId: string,
    page: number,
    limit: number,
  ): Promise<{ items: Review[]; total: number }> {
    return repo.listByProduct(productId, { page, limit });
  }

  async getReviewEligibility(
    customerId: string,
    productId: string,
  ): Promise<{ canReview: boolean; reason?: 'ALREADY_REVIEWED' | 'PURCHASE_REQUIRED' }> {
    const existing = await repo.findByCustomerAndProduct(customerId, productId);
    if (existing) return { canReview: false, reason: 'ALREADY_REVIEWED' };

    const purchaseItem = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          customerId,
          OR: [{ paymentStatus: 'PAID' }, { status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } }],
        },
      },
      select: { id: true },
    });

    return purchaseItem ? { canReview: true } : { canReview: false, reason: 'PURCHASE_REQUIRED' };
  }

  // ── Customer operations ──────────────────────────────────────────────────

  async createReview(dto: CreateReviewDto, customerId: string, productId: string): Promise<Review> {
    // REV-02: one review per customer per product
    const existing = await repo.findByCustomerAndProduct(customerId, productId);
    if (existing) throw new Error('REVIEW_ALREADY_EXISTS');

    // D-04: verified purchase snapshot at creation time
    const purchaseItem = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          customerId,
          OR: [{ paymentStatus: 'PAID' }, { status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } }],
        },
      },
    });
    if (!purchaseItem) throw new Error('PURCHASE_REQUIRED');

    const review = await repo.create({
      customerId,
      productId,
      rating: dto.rating,
      comment: dto.comment,
      status: 'APPROVED',
      isVerifiedPurchase: true,
    });

    await this.recalcAggregates(productId);
    return review;
  }

  // Customer edits remain published instantly and recalculate aggregate.
  async updateMyReview(customerId: string, productId: string, dto: UpdateReviewDto): Promise<Review> {
    const existing = await repo.findByCustomerAndProduct(customerId, productId);
    if (!existing) throw new Error('REVIEW_NOT_FOUND');
    return this.updateReview(existing.id, dto, customerId);
  }

  async updateReview(id: string, dto: UpdateReviewDto, customerId: string): Promise<Review> {
    const review = await repo.findById(id);
    if (!review || review.customerId !== customerId) throw new Error('REVIEW_NOT_FOUND');

    const updated = await repo.update(id, { ...dto, status: 'APPROVED' });
    await this.recalcAggregates(review.productId);

    return updated;
  }

  // D-02: deletion recalculates aggregate if review was APPROVED
  async deleteMyReview(customerId: string, productId: string): Promise<void> {
    const existing = await repo.findByCustomerAndProduct(customerId, productId);
    if (!existing) throw new Error('REVIEW_NOT_FOUND');
    return this.deleteReview(existing.id, customerId);
  }

  async deleteReview(id: string, customerId: string): Promise<void> {
    const review = await repo.findById(id);
    if (!review || review.customerId !== customerId) throw new Error('REVIEW_NOT_FOUND');

    const wasApproved = review.status === 'APPROVED';
    const { productId } = review;

    await repo.delete(id);

    if (wasApproved) {
      await this.recalcAggregates(productId);
    }
  }

  // ── Admin operations ─────────────────────────────────────────────────────

  // REV-03: admin moderation — recalculates aggregate on every status change
  async moderateReview(id: string, dto: ModerateReviewDto, adminId: string): Promise<Review> {
    const review = await repo.findById(id);
    if (!review) throw new Error('REVIEW_NOT_FOUND');

    const updated = await repo.update(id, {
      status: dto.status,
      moderatedBy: adminId,
      moderatedAt: new Date(),
    });

    // Recalculate so transitions APPROVED→REJECTED and PENDING→APPROVED are both correct
    await this.recalcAggregates(review.productId);

    return updated;
  }

  async deleteReviewAsAdmin(id: string): Promise<void> {
    const review = await repo.findById(id);
    if (!review) throw new Error('REVIEW_NOT_FOUND');

    const wasApproved = review.status === 'APPROVED';
    const { productId } = review;

    await repo.delete(id);

    if (wasApproved) {
      await this.recalcAggregates(productId);
    }
  }

  async listAdminReviews(
    query: ListAdminReviewsQueryDto,
  ): Promise<{ items: Review[]; total: number; page: number; limit: number }> {
    const result = await repo.listAdmin({
      status: query.status as import('@/generated/prisma/client').ReviewStatus | undefined,
      page: query.page,
      limit: query.limit,
    });
    return { ...result, page: query.page, limit: query.limit };
  }
}
