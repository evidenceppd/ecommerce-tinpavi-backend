import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockReviewCreate,
  mockReviewFindUnique,
  mockReviewUpdate,
  mockReviewDelete,
  mockReviewFindMany,
  mockReviewCount,
  mockReviewAggregate,
} = vi.hoisted(() => ({
  mockReviewCreate: vi.fn(),
  mockReviewFindUnique: vi.fn(),
  mockReviewUpdate: vi.fn(),
  mockReviewDelete: vi.fn(),
  mockReviewFindMany: vi.fn(),
  mockReviewCount: vi.fn(),
  mockReviewAggregate: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    review: {
      create: mockReviewCreate,
      findUnique: mockReviewFindUnique,
      update: mockReviewUpdate,
      delete: mockReviewDelete,
      findMany: mockReviewFindMany,
      count: mockReviewCount,
      aggregate: mockReviewAggregate,
    },
  },
}));

import { ReviewsRepository } from '../reviews.repository';

describe('ReviewsRepository', () => {
  let repository: ReviewsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ReviewsRepository();
  });

  it('create, findById and findByCustomerAndProduct delegate with expected where clauses', async () => {
    mockReviewCreate.mockResolvedValue({ id: 'r-1' });
    mockReviewFindUnique.mockResolvedValueOnce({ id: 'r-1' }).mockResolvedValueOnce({ id: 'r-2' });

    const created = await repository.create({
      customerId: 'c-1',
      productId: 'p-1',
      rating: 5,
      comment: 'bom',
      isVerifiedPurchase: true,
    });
    const byId = await repository.findById('r-1');
    const byCompound = await repository.findByCustomerAndProduct('c-1', 'p-1');

    expect(mockReviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: 'c-1', productId: 'p-1', rating: 5 }),
      }),
    );
    expect(mockReviewFindUnique).toHaveBeenNthCalledWith(1, { where: { id: 'r-1' } });
    expect(mockReviewFindUnique).toHaveBeenNthCalledWith(2, {
      where: { customerId_productId: { customerId: 'c-1', productId: 'p-1' } },
    });
    expect(created).toMatchObject({ id: 'r-1' });
    expect(byId).toMatchObject({ id: 'r-1' });
    expect(byCompound).toMatchObject({ id: 'r-2' });
  });

  it('update and delete delegate correctly', async () => {
    mockReviewUpdate.mockResolvedValue({ id: 'r-1', status: 'APPROVED' });
    mockReviewDelete.mockResolvedValue({ id: 'r-1' });

    const updated = await repository.update('r-1', { status: 'APPROVED', moderatedBy: 'admin-1' });
    await repository.delete('r-1');

    expect(mockReviewUpdate).toHaveBeenCalledWith({
      where: { id: 'r-1' },
      data: { status: 'APPROVED', moderatedBy: 'admin-1' },
    });
    expect(mockReviewDelete).toHaveBeenCalledWith({ where: { id: 'r-1' } });
    expect(updated).toMatchObject({ status: 'APPROVED' });
  });

  it('listAdmin applies pagination and optional status filter', async () => {
    mockReviewFindMany.mockResolvedValue([{ id: 'r-1' }]);
    mockReviewCount.mockResolvedValue(1);

    const result = await repository.listAdmin({ status: 'PENDING', page: 2, limit: 10 });

    expect(mockReviewFindMany).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    expect(mockReviewCount).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
    expect(result).toEqual({ items: [{ id: 'r-1' }], total: 1 });
  });

  it('aggregateApproved maps avg null to zero', async () => {
    mockReviewAggregate.mockResolvedValueOnce({ _count: { rating: 2 }, _avg: { rating: 4.5 } });
    mockReviewAggregate.mockResolvedValueOnce({ _count: { rating: 0 }, _avg: { rating: null } });

    const withAvg = await repository.aggregateApproved('p-1');
    const noAvg = await repository.aggregateApproved('p-2');

    expect(withAvg).toEqual({ count: 2, avg: 4.5 });
    expect(noAvg).toEqual({ count: 0, avg: 0 });
  });
});
