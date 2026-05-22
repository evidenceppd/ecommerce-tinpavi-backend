import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetPublicByCode } = vi.hoisted(() => ({
  mockGetPublicByCode: vi.fn(),
}));

vi.mock('@/config/seo', () => ({ BASE_URL: 'https://shop.test' }));

vi.mock('../catalog.service', () => ({
  CatalogService: class CatalogService {
    getPublicByCode = mockGetPublicByCode;
  },
}));

import { getProductController } from '../catalog.controller';

function createResponse() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
}

describe('catalog.controller canonical header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets canonical Link header on GET /products/:code', async () => {
    const req = { params: { code: 'A1B2C3D4' } };
    const res = createResponse();

    mockGetPublicByCode.mockResolvedValue({ id: 'p1', code: 'A1B2C3D4', title: 'Produto 1' });

    await getProductController(req as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '<https://shop.test/products/A1B2C3D4>; rel="canonical"',
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
