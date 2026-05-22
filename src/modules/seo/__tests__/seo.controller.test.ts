import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateSitemap,
  mockGetRobotsTxt,
  mockGetProductSchema,
  mockGetCategorySchema,
} = vi.hoisted(() => ({
  mockGenerateSitemap: vi.fn(),
  mockGetRobotsTxt: vi.fn(),
  mockGetProductSchema: vi.fn(),
  mockGetCategorySchema: vi.fn(),
}));

vi.mock('../seo.service', () => ({
  SeoService: class SeoService {
    generateSitemap = mockGenerateSitemap;
    getRobotsTxt = mockGetRobotsTxt;
    getProductSchema = mockGetProductSchema;
    getCategorySchema = mockGetCategorySchema;
  },
}));

import {
  sitemapController,
  robotsTxtController,
  productSchemaController,
  categorySchemaController,
} from '../seo.controller';

function createResponse() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    send: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
}

describe('seo.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns XML sitemap with application/xml content-type', async () => {
    const res = createResponse();
    mockGenerateSitemap.mockResolvedValue('<xml>ok</xml>');

    await sitemapController({} as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml; charset=utf-8');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('<xml>ok</xml>');
  });

  it('returns 500 when sitemap generation throws', async () => {
    const res = createResponse();
    mockGenerateSitemap.mockRejectedValue(new Error('boom'));

    await sitemapController({} as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Internal server error');
  });

  it('returns robots.txt as text/plain', () => {
    const res = createResponse();
    mockGetRobotsTxt.mockReturnValue('User-agent: *\nAllow: /');

    robotsTxtController({} as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('User-agent: *\nAllow: /');
  });

  it('returns product schema JSON-LD payload', async () => {
    const res = createResponse();
    mockGetProductSchema.mockResolvedValue([{ '@type': 'Product' }]);

    await productSchemaController({ params: { slug: 'p1' } } as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/ld+json');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ '@type': 'Product' }]);
  });

  it('maps PRODUCT_NOT_FOUND to 404 in product schema handler', async () => {
    const res = createResponse();
    mockGetProductSchema.mockRejectedValue(new Error('PRODUCT_NOT_FOUND'));

    await productSchemaController({ params: { slug: 'missing' } } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Product not found' });
  });

  it('returns category schema JSON-LD payload', async () => {
    const res = createResponse();
    mockGetCategorySchema.mockResolvedValue({ '@type': 'BreadcrumbList' });

    await categorySchemaController({ params: { slug: 'c1' } } as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/ld+json');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ '@type': 'BreadcrumbList' });
  });

  it('maps CATEGORY_NOT_FOUND to 404 in category schema handler', async () => {
    const res = createResponse();
    mockGetCategorySchema.mockRejectedValue(new Error('CATEGORY_NOT_FOUND'));

    await categorySchemaController({ params: { slug: 'missing' } } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Category not found' });
  });
});
