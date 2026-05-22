import { beforeEach, describe, expect, it, vi } from 'vitest';

type ReviewRecord = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
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
    name: string;
    slug: string;
  };
  productId: string;
  moderatedBy: string | null;
  moderatedAt: Date | null;
};

const {
  mockAggregateApproved,
  mockProductUpdate,
} = vi.hoisted(() => ({
  mockAggregateApproved: vi.fn(),
  mockProductUpdate: vi.fn(),
}));

const store = vi.hoisted(() => ({
  reviews: [] as ReviewRecord[],
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    product: {
      update: mockProductUpdate,
    },
  },
}));

vi.mock('../admin.repository', () => ({
  AdminRepository: class AdminRepository {
    getDashboardOverview = vi.fn(async (queuePreviewLimit: number) => ({
      metrics: {
        totalRevenue: 0,
        totalOrders: 0,
        pendingPaymentOrders: 0,
        totalCustomers: 0,
        pendingReviews: store.reviews.filter((review) => review.status === 'PENDING').length,
        lowStockCount: 0,
      },
      recentOrders: [],
      pendingReviewQueue: store.reviews
        .filter((review) => review.status === 'PENDING')
        .slice(0, queuePreviewLimit)
        .map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          customer: review.customer,
          product: review.product,
        })),
    }));

    getSalesOrders = vi.fn();
    getLowStockProducts = vi.fn();
    getPendingReviewQueuePreview = vi.fn();
  },
}));

vi.mock('@/modules/reviews/reviews.repository', () => ({
  ReviewsRepository: class ReviewsRepository {
    findById = vi.fn(async (id: string) => {
      const review = store.reviews.find((item) => item.id === id);
      return review ? { ...review } : null;
    });

    update = vi.fn(async (id: string, payload: Partial<ReviewRecord>) => {
      const index = store.reviews.findIndex((item) => item.id === id);
      if (index < 0) {
        throw new Error('REVIEW_NOT_FOUND');
      }

      const next = {
        ...store.reviews[index],
        ...payload,
      } as ReviewRecord;

      store.reviews[index] = next;
      return { ...next };
    });

    aggregateApproved = mockAggregateApproved;
    create = vi.fn();
    findByCustomerAndProduct = vi.fn();
    delete = vi.fn();
    listAdmin = vi.fn();
  },
}));

import { AdminService } from '../admin.service';
import { ReviewsService } from '@/modules/reviews/reviews.service';

describe('Admin review queue moderation roundtrip', () => {
  let adminService: AdminService;
  let reviewsService: ReviewsService;

  beforeEach(() => {
    vi.clearAllMocks();

    store.reviews = [
      {
        id: 'rev-1',
        status: 'PENDING',
        rating: 5,
        comment: 'Great product',
        createdAt: new Date('2026-05-06T12:00:00.000Z'),
        customer: {
          id: 'cust-1',
          name: 'Customer One',
          email: 'customer1@example.com',
        },
        product: {
          id: 'prod-1',
          name: 'Produto 1',
          slug: 'produto-1',
        },
        productId: 'prod-1',
        moderatedBy: null,
        moderatedAt: null,
      },
    ];

    mockAggregateApproved.mockResolvedValue({ count: 1, avg: 5 });
    mockProductUpdate.mockResolvedValue({ id: 'prod-1' });

    adminService = new AdminService();
    reviewsService = new ReviewsService();
  });

  it('removes pending review from dashboard queue after moderation', async () => {
    const before = await adminService.getDashboardOverview({ queuePreviewLimit: 5 });
    expect(before.pendingReviewQueue).toHaveLength(1);
    expect(before.pendingReviewQueue[0]?.id).toBe('rev-1');

    const moderated = await reviewsService.moderateReview('rev-1', { status: 'APPROVED' } as any, 'admin-1');

    expect(moderated.status).toBe('APPROVED');
    expect(moderated.moderatedBy).toBe('admin-1');

    const after = await adminService.getDashboardOverview({ queuePreviewLimit: 5 });
    expect(after.pendingReviewQueue).toHaveLength(0);

    expect(mockAggregateApproved).toHaveBeenCalledWith('prod-1');
    expect(mockProductUpdate).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { reviews: 1 },
    });
  });
});
