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

describe('CatalogRepository.findPublicList', () => {
  let repository: CatalogRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new CatalogRepository();
    mockProductFindMany.mockResolvedValue([]);
    mockProductCount.mockResolvedValue(0);
  });

  it('caps limit to 100 and applies stock + category + search filters', async () => {
    await repository.findPublicList({
      category_id: 'cat-1',
      search: 'serum',
      orderBy: 'createdAt',
      page: 1,
      limit: 999,
    });

    const findManyArgs = mockProductFindMany.mock.calls[0]?.[0] as {
      take: number;
      where: Record<string, unknown>;
    };

    expect(findManyArgs.take).toBe(100);
    const serializedWhere = JSON.stringify(findManyArgs.where);
    expect(serializedWhere).toContain('"quantity_stock":{"gt":0}');
    expect(serializedWhere).toContain('"category_id":"cat-1"');
    expect(serializedWhere).toContain('"category_links"');
    expect(serializedWhere).toContain('"title"');
  });
});

describe('CatalogRepository.findAdminList', () => {
  let repository: CatalogRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new CatalogRepository();
    mockProductFindMany.mockResolvedValue([]);
    mockProductCount.mockResolvedValue(0);
  });

  it('applies category filter against primary and linked categories', async () => {
    await repository.findAdminList({
      category_id: 'cat-1',
      page: 1,
      limit: 20,
      lowStockOnly: false,
      threshold: 5,
    });

    const findManyArgs = mockProductFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };

    const serializedWhere = JSON.stringify(findManyArgs.where);
    expect(serializedWhere).toContain('"category_id":"cat-1"');
    expect(serializedWhere).toContain('"category_links"');
  });
});
