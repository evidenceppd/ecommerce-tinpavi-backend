import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRepoCreate,
  mockRepoFindById,
  mockRepoFindByCustomerAndProduct,
  mockRepoUpdate,
  mockRepoDelete,
  mockRepoListAdmin,
  mockRepoAggregateApproved,
  mockOrderItemFindFirst,
  mockProductUpdate,
} = vi.hoisted(() => ({
  mockRepoCreate: vi.fn(),
  mockRepoFindById: vi.fn(),
  mockRepoFindByCustomerAndProduct: vi.fn(),
  mockRepoUpdate: vi.fn(),
  mockRepoDelete: vi.fn(),
  mockRepoListAdmin: vi.fn(),
  mockRepoAggregateApproved: vi.fn(),
  mockOrderItemFindFirst: vi.fn(),
  mockProductUpdate: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    orderItem: { findFirst: mockOrderItemFindFirst },
    product: { update: mockProductUpdate },
  },
}));

vi.mock('../reviews.repository', () => ({
  ReviewsRepository: class ReviewsRepository {
    create = mockRepoCreate;
    findById = mockRepoFindById;
    findByCustomerAndProduct = mockRepoFindByCustomerAndProduct;
    update = mockRepoUpdate;
    delete = mockRepoDelete;
    listAdmin = mockRepoListAdmin;
    aggregateApproved = mockRepoAggregateApproved;
  },
}));

import { ReviewsService } from '../reviews.service';

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rev-1',
    customerId: 'cust-1',
    productId: 'prod-1',
    rating: 5,
    comment: 'Great',
    status: 'PENDING',
    moderatedBy: null,
    moderatedAt: null,
    isVerifiedPurchase: false,
    createdAt: new Date('2026-05-06T10:00:00.000Z'),
    updatedAt: new Date('2026-05-06T10:00:00.000Z'),
    ...overrides,
  };
}

describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewsService();
    mockRepoAggregateApproved.mockResolvedValue({ count: 2, avg: 4.5 });
    mockProductUpdate.mockResolvedValue({ id: 'prod-1' });
  });

  it('throws REVIEW_ALREADY_EXISTS when customer already reviewed product', async () => {
    mockRepoFindByCustomerAndProduct.mockResolvedValue(makeReview());
    await expect(service.createReview({ rating: 5 } as any, 'cust-1', 'prod-1')).rejects.toThrow(
      'REVIEW_ALREADY_EXISTS',
    );
  });

  it('creates review as approved with verified purchase snapshot', async () => {
    mockRepoFindByCustomerAndProduct.mockResolvedValue(null);
    mockOrderItemFindFirst.mockResolvedValue({ id: 'item-1' });
    mockRepoCreate.mockResolvedValue(makeReview({ isVerifiedPurchase: true }));

    const result = await service.createReview({ rating: 5, comment: 'Great' } as any, 'cust-1', 'prod-1');

    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        productId: 'prod-1',
        rating: 5,
        comment: 'Great',
        status: 'APPROVED',
        isVerifiedPurchase: true,
      }),
    );
    expect(mockRepoAggregateApproved).toHaveBeenCalledWith('prod-1');
    expect(result).toMatchObject({ id: 'rev-1' });
  });

  it('requires a confirmed purchase before creating review', async () => {
    mockRepoFindByCustomerAndProduct.mockResolvedValue(null);
    mockOrderItemFindFirst.mockResolvedValue(null);

    await expect(service.createReview({ rating: 4 } as any, 'cust-1', 'prod-1')).rejects.toThrow(
      'PURCHASE_REQUIRED',
    );

    expect(mockRepoCreate).not.toHaveBeenCalled();
  });

  it('throws REVIEW_NOT_FOUND when updateMyReview cannot find customer review', async () => {
    mockRepoFindByCustomerAndProduct.mockResolvedValue(null);
    await expect(service.updateMyReview('cust-1', 'prod-1', { rating: 3 } as any)).rejects.toThrow(
      'REVIEW_NOT_FOUND',
    );
  });

  it('publishes customer review edits immediately and recalculates aggregates', async () => {
    mockRepoFindById.mockResolvedValue(makeReview({ status: 'PENDING' }));
    mockRepoUpdate.mockResolvedValue(makeReview({ status: 'APPROVED', rating: 3 }));

    await service.updateReview('rev-1', { rating: 3 } as any, 'cust-1');

    expect(mockRepoUpdate).toHaveBeenCalledWith('rev-1', { rating: 3, status: 'APPROVED' });
    expect(mockRepoAggregateApproved).toHaveBeenCalledWith('prod-1');
    expect(mockProductUpdate).toHaveBeenCalled();
  });

  it('throws REVIEW_NOT_FOUND when review does not exist on update', async () => {
    mockRepoFindById.mockResolvedValue(null);
    await expect(service.updateReview('rev-404', { rating: 3 } as any, 'cust-1')).rejects.toThrow(
      'REVIEW_NOT_FOUND',
    );
  });

  it('keeps approved review published and recalculates aggregates on update', async () => {
    mockRepoFindById.mockResolvedValue(makeReview({ status: 'APPROVED' }));
    mockRepoUpdate.mockResolvedValue(makeReview({ status: 'APPROVED', rating: 4 }));

    const result = await service.updateReview('rev-1', { rating: 4 } as any, 'cust-1');

    expect(mockRepoUpdate).toHaveBeenCalledWith('rev-1', { rating: 4, status: 'APPROVED' });
    expect(mockRepoAggregateApproved).toHaveBeenCalledWith('prod-1');
    expect(mockProductUpdate).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { reviews: 2 },
    });
    expect(result).toMatchObject({ id: 'rev-1', status: 'APPROVED' });
  });

  it('deletes approved review and recalculates aggregates', async () => {
    mockRepoFindById.mockResolvedValue(makeReview({ status: 'APPROVED' }));
    mockRepoDelete.mockResolvedValue(undefined);

    await service.deleteReview('rev-1', 'cust-1');

    expect(mockRepoDelete).toHaveBeenCalledWith('rev-1');
    expect(mockRepoAggregateApproved).toHaveBeenCalledWith('prod-1');
    expect(mockProductUpdate).toHaveBeenCalled();
  });

  it('throws REVIEW_NOT_FOUND when deleteMyReview cannot find customer review', async () => {
    mockRepoFindByCustomerAndProduct.mockResolvedValue(null);
    await expect(service.deleteMyReview('cust-1', 'prod-1')).rejects.toThrow('REVIEW_NOT_FOUND');
  });

  it('deletes non-approved review without recalculating aggregates', async () => {
    mockRepoFindById.mockResolvedValue(makeReview({ status: 'PENDING' }));
    mockRepoDelete.mockResolvedValue(undefined);

    await service.deleteReview('rev-1', 'cust-1');

    expect(mockRepoDelete).toHaveBeenCalledWith('rev-1');
    expect(mockRepoAggregateApproved).not.toHaveBeenCalled();
    expect(mockProductUpdate).not.toHaveBeenCalled();
  });

  it('throws REVIEW_NOT_FOUND when admin moderates unknown review', async () => {
    mockRepoFindById.mockResolvedValue(null);
    await expect(service.moderateReview('rev-404', { status: 'APPROVED' } as any, 'admin-1')).rejects.toThrow(
      'REVIEW_NOT_FOUND',
    );
  });

  it('moderates review and recalculates aggregates', async () => {
    mockRepoFindById.mockResolvedValue(makeReview({ productId: 'prod-1' }));
    mockRepoUpdate.mockResolvedValue(makeReview({ status: 'APPROVED', moderatedBy: 'admin-1' }));

    const result = await service.moderateReview('rev-1', { status: 'APPROVED' } as any, 'admin-1');

    expect(mockRepoUpdate).toHaveBeenCalledWith(
      'rev-1',
      expect.objectContaining({
        status: 'APPROVED',
        moderatedBy: 'admin-1',
        moderatedAt: expect.any(Date),
      }),
    );
    expect(mockRepoAggregateApproved).toHaveBeenCalledWith('prod-1');
    expect(result).toMatchObject({ id: 'rev-1', status: 'APPROVED' });
  });

  it('returns paginated admin review list with query metadata', async () => {
    mockRepoListAdmin.mockResolvedValue({ items: [makeReview()], total: 1 });

    const result = await service.listAdminReviews({ page: 2, limit: 20, status: 'PENDING' } as any);

    expect(mockRepoListAdmin).toHaveBeenCalledWith({ status: 'PENDING', page: 2, limit: 20 });
    expect(result).toEqual({ items: [expect.objectContaining({ id: 'rev-1' })], total: 1, page: 2, limit: 20 });
  });
});
