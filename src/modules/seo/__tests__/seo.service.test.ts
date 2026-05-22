import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCacheGet,
  mockCacheSet,
  mockProductFindMany,
  mockProductCategoryFindMany,
  mockProductFindUnique,
  mockProductCategoryFindUnique,
} = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockProductFindMany: vi.fn(),
  mockProductCategoryFindMany: vi.fn(),
  mockProductFindUnique: vi.fn(),
  mockProductCategoryFindUnique: vi.fn(),
}));

vi.mock('@/shared/infra/memory-cache', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
    del: vi.fn(),
    setNX: vi.fn(),
  },
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    product: {
      findMany: mockProductFindMany,
      findUnique: mockProductFindUnique,
    },
    productCategory: {
      findMany: mockProductCategoryFindMany,
      findUnique: mockProductCategoryFindUnique,
    },
  },
}));

import { SeoService } from '../seo.service';

describe('SeoService', () => {
  let service: SeoService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SeoService();
    delete process.env['ROBOTS_TXT_RULES'];
  });

  afterEach(() => {
    delete process.env['ROBOTS_TXT_RULES'];
  });

  it('returns cached sitemap when available', async () => {
    mockCacheGet.mockReturnValue('<xml>cached</xml>');

    const result = await service.generateSitemap();

    expect(result).toBe('<xml>cached</xml>');
    expect(mockProductFindMany).not.toHaveBeenCalled();
    expect(mockProductCategoryFindMany).not.toHaveBeenCalled();
  });

  it('generates sitemap from db and stores cache when cache is empty', async () => {
    mockCacheGet.mockReturnValue(null);
    mockProductFindMany.mockResolvedValue([
      { code: 'A1B2C3D4', updatedAt: new Date('2026-05-01T12:00:00.000Z') },
    ]);
    mockProductCategoryFindMany.mockResolvedValue([
      { id: 'cat-1', updatedAt: new Date('2026-05-02T12:00:00.000Z') },
    ]);

    const xml = await service.generateSitemap();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>http://localhost:3000/sobre</loc>');
    expect(xml).toContain('<loc>http://localhost:3000/categories/cat-1</loc>');
    expect(xml).toContain('<loc>http://localhost:3000/products/A1B2C3D4</loc>');
    expect(mockCacheSet).toHaveBeenCalledWith('seo:sitemap', xml, 3600);
  });

  it('returns robots.txt from env when configured', () => {
    process.env['ROBOTS_TXT_RULES'] = 'User-agent: *\nDisallow: /admin';

    const result = service.getRobotsTxt();

    expect(result).toBe('User-agent: *\nDisallow: /admin');
  });

  it('returns default robots.txt when env is absent', () => {
    const result = service.getRobotsTxt();
    expect(result).toContain('User-agent: *');
    expect(result).toContain('Sitemap: http://localhost:3000/sitemap.xml');
  });

  it('throws PRODUCT_NOT_FOUND when product schema target does not exist', async () => {
    mockProductFindUnique.mockResolvedValue(null);
    await expect(service.getProductSchema('missing')).rejects.toThrow('PRODUCT_NOT_FOUND');
  });

  it('builds product and breadcrumb schema with stock and reviews', async () => {
    mockProductFindUnique.mockResolvedValue({
      code: 'A1B2C3D4',
      title: 'Produto 1',
      description: 'Descricao',
      pricing: 199.9,
      quantity_stock: 10,
      reviews: 2,
      carousel_image: ['http://localhost:3000/uploads/prod-1.jpg'],
      category: {
        id: 'cat-1',
        title: 'Categoria 1',
      },
    });

    const result = await service.getProductSchema('A1B2C3D4');
    const [productSchema, breadcrumbSchema] = result as any[];

    expect(productSchema.name).toBe('Produto 1');
    expect(productSchema.image).toBe('http://localhost:3000/uploads/prod-1.jpg');
    expect(productSchema.offers.availability).toBe('https://schema.org/InStock');
    expect(productSchema.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 2,
      reviewCount: 2,
    });
    expect(breadcrumbSchema.itemListElement.at(-1)).toEqual(
      expect.objectContaining({
        name: 'Produto 1',
        item: 'http://localhost:3000/products/A1B2C3D4',
      }),
    );
  });

  it('throws CATEGORY_NOT_FOUND when category schema target does not exist', async () => {
    mockProductCategoryFindUnique.mockResolvedValue(null);
    await expect(service.getCategorySchema('missing')).rejects.toThrow('CATEGORY_NOT_FOUND');
  });

  it('builds category breadcrumb schema', async () => {
    mockProductCategoryFindUnique.mockResolvedValue({
      id: 'cat-1',
      title: 'Filha',
    });

    const schema = (await service.getCategorySchema('cat-1')) as any;

    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ position: 1, name: 'Home', item: 'http://localhost:3000' }),
        expect.objectContaining({ position: 2, name: 'Filha', item: 'http://localhost:3000/categories/cat-1' }),
      ]),
    );
  });
});
