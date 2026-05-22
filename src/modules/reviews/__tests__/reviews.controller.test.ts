import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateReview,
  mockUpdateMyReview,
  mockDeleteMyReview,
  mockGetReviewEligibility,
  mockListAdminReviews,
  mockModerateReview,
  mockCreateReviewSchemaParse,
  mockUpdateReviewSchemaParse,
  mockModerateReviewSchemaParse,
  mockListAdminReviewsQuerySchemaParse,
} = vi.hoisted(() => ({
  mockCreateReview: vi.fn(),
  mockUpdateMyReview: vi.fn(),
  mockDeleteMyReview: vi.fn(),
  mockGetReviewEligibility: vi.fn(),
  mockListAdminReviews: vi.fn(),
  mockModerateReview: vi.fn(),
  mockCreateReviewSchemaParse: vi.fn(),
  mockUpdateReviewSchemaParse: vi.fn(),
  mockModerateReviewSchemaParse: vi.fn(),
  mockListAdminReviewsQuerySchemaParse: vi.fn(),
}));

vi.mock('../reviews.service', () => ({
  ReviewsService: class ReviewsService {
    createReview = mockCreateReview;
    updateMyReview = mockUpdateMyReview;
    deleteMyReview = mockDeleteMyReview;
    getReviewEligibility = mockGetReviewEligibility;
    listAdminReviews = mockListAdminReviews;
    moderateReview = mockModerateReview;
  },
}));

vi.mock('../reviews.schemas', async () => {
  const actual = await vi.importActual<typeof import('../reviews.schemas')>('../reviews.schemas');
  return {
    ...actual,
    createReviewSchema: { parse: mockCreateReviewSchemaParse },
    updateReviewSchema: { parse: mockUpdateReviewSchemaParse },
    moderateReviewSchema: { parse: mockModerateReviewSchemaParse },
    listAdminReviewsQuerySchema: { parse: mockListAdminReviewsQuerySchemaParse },
  };
});

import {
  adminListReviewsController,
  adminModerateReviewController,
  createReviewController,
  deleteMyReviewController,
  reviewEligibilityController,
} from '../reviews.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('reviews.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateReviewSchemaParse.mockImplementation((body: unknown) => body);
    mockUpdateReviewSchemaParse.mockImplementation((body: unknown) => body);
    mockModerateReviewSchemaParse.mockImplementation((body: unknown) => body);
    mockListAdminReviewsQuerySchemaParse.mockImplementation((query: unknown) => query);
  });

  it('createReviewController returns 401 without authenticated user', async () => {
    const req = { user: undefined, body: {}, params: { productId: 'p1' } };
    const res = createResponse();

    await createReviewController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockCreateReview).not.toHaveBeenCalled();
  });

  it('createReviewController maps REVIEW_ALREADY_EXISTS to 409', async () => {
    const req = { user: { id: 'cust-1' }, body: { rating: 5 }, params: { productId: 'p1' } };
    const res = createResponse();
    mockCreateReview.mockRejectedValue(new Error('REVIEW_ALREADY_EXISTS'));

    await createReviewController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'REVIEW_ALREADY_EXISTS' }),
      }),
    );
  });

  it('deleteMyReviewController returns 204 on success', async () => {
    const req = { user: { id: 'cust-1' }, params: { productId: 'p1' } };
    const res = createResponse();
    mockDeleteMyReview.mockResolvedValue(undefined);

    await deleteMyReviewController(req as any, res as any);

    expect(mockDeleteMyReview).toHaveBeenCalledWith('cust-1', 'p1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  it('reviewEligibilityController returns current customer eligibility', async () => {
    const req = { user: { id: 'cust-1' }, params: { productId: 'p1' } };
    const res = createResponse();
    mockGetReviewEligibility.mockResolvedValue({ canReview: false, reason: 'PURCHASE_REQUIRED' });

    await reviewEligibilityController(req as any, res as any);

    expect(mockGetReviewEligibility).toHaveBeenCalledWith('cust-1', 'p1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('adminListReviewsController returns paginated result', async () => {
    const req = { query: { page: '1', limit: '10' } };
    const res = createResponse();
    mockListAdminReviews.mockResolvedValue({ items: [{ id: 'r1' }], total: 1, page: 1, limit: 10 });

    await adminListReviewsController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meta: expect.objectContaining({ total: 1, page: 1, limit: 10 }),
      }),
    );
  });

  it('adminModerateReviewController returns 200 with moderated review', async () => {
    const req = { user: { id: 'admin-1' }, params: { id: 'r1' }, body: { status: 'APPROVED' } };
    const res = createResponse();
    mockModerateReview.mockResolvedValue({ id: 'r1', status: 'APPROVED' });

    await adminModerateReviewController(req as any, res as any);

    expect(mockModerateReview).toHaveBeenCalledWith('r1', { status: 'APPROVED' }, 'admin-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
