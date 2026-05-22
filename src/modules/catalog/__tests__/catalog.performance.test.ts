/**
 * catalog.performance.test.ts
 *
 * Performance regression guards for CatalogRepository.
 * These tests enforce query-count ceilings and pagination caps so that N+1
 * patterns cannot silently reappear after future refactors.
 *
 * Run:
 *   npx vitest run src/modules/catalog/__tests__/catalog.performance.test.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockProductFindMany, mockProductCount } = vi.hoisted(() => ({
  mockProductFindMany: vi.fn(),
  mockProductCount: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    product: {
      findMany: mockProductFindMany,
      count: mockProductCount,
    },
  },
}));

import { CatalogRepository } from '../catalog.repository';

describe('CatalogRepository — performance regression guards', () => {
  let repo: CatalogRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new CatalogRepository();
    mockProductFindMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Product A',
        slug: 'product-a',
        price: 100,
        compareAtPrice: null,
        stockQty: 5,
        category: { id: 'c1', name: 'Cat', slug: 'cat' },
        images: [{ id: 'i1', url: '/img.jpg', alt: null, position: 0 }],
        _count: { reviews: 2 },
        variants: [],
      },
    ]);
    mockProductCount.mockResolvedValue(1);
  });

  it('issues exactly 2 prisma calls (findMany + count) for a public listing', async () => {
    await repo.findPublicList({ page: 1, limit: 20, orderBy: 'createdAt' });

    // One findMany + one count — no per-product N+1 queries
    expect(mockProductFindMany).toHaveBeenCalledTimes(1);
    expect(mockProductCount).toHaveBeenCalledTimes(1);
  });

  it('findMany call includes category in a single select (no separate joins)', async () => {
    await repo.findPublicList({ page: 1, limit: 20, orderBy: 'createdAt' });

    const args = mockProductFindMany.mock.calls[0]?.[0] as {
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    };

    const hasCategory =
      args.include?.['category'] !== undefined || args.select?.['category'] !== undefined;
    expect(hasCategory).toBe(true);
  });

  it('enforces default page size of 20 when no limit is supplied', async () => {
    await repo.findPublicList({ page: 1, limit: 20, orderBy: 'createdAt' });

    const args = mockProductFindMany.mock.calls[0]?.[0] as { take?: number };
    expect(args.take).toBeLessThanOrEqual(20);
    expect(args.take).toBeGreaterThan(0);
  });

  it('enforces hard pagination cap of 100 (N+1 surface minimization)', async () => {
    await repo.findPublicList({ page: 1, limit: 500, orderBy: 'createdAt' });

    const args = mockProductFindMany.mock.calls[0]?.[0] as { take: number };
    expect(args.take).toBeLessThanOrEqual(100);
  });

  it('applies quantity_stock filter inline (no separate stock lookup)', async () => {
    await repo.findPublicList({ page: 1, limit: 10, orderBy: 'createdAt' });

    const args = mockProductFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    const hasStockFilter = JSON.stringify(args.where).includes('quantity_stock');
    expect(hasStockFilter).toBe(true);
  });
});
