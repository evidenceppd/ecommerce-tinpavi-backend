import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetById } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
}));

vi.mock('@/config/seo', () => ({ BASE_URL: 'https://shop.test' }));

vi.mock('../categories.service', () => ({
  CategoriesService: class CategoriesService {
    getById = mockGetById;
  },
}));

import { getCategoryController } from '../categories.controller';

function createResponse() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
}

describe('categories.controller canonical header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets canonical Link header on GET /categories/:id', async () => {
    const req = { params: { id: 'cat-1' } };
    const res = createResponse();

    mockGetById.mockResolvedValue({ id: 'cat-1', title: 'Categoria 1' });

    await getCategoryController(req as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '<https://shop.test/categories/cat-1>; rel="canonical"',
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
