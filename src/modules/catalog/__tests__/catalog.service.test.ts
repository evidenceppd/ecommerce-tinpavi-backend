import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/infra/prisma', () => ({ prisma: {} }));
vi.mock('../catalog.repository');
vi.mock('@/modules/categories/categories.repository');

import { CatalogService } from '../catalog.service';
import { CatalogRepository } from '../catalog.repository';
import { CategoriesRepository } from '@/modules/categories/categories.repository';
import { cache } from '@/shared/infra/memory-cache';

const mockFindByCode = vi.mocked(CatalogRepository.prototype.findByCode);
const mockFindById = vi.mocked(CatalogRepository.prototype.findById);
const mockFindPublicList = vi.mocked(CatalogRepository.prototype.findPublicList);
const mockFindAdminList = vi.mocked(CatalogRepository.prototype.findAdminList);
const mockCodeExists = vi.mocked(CatalogRepository.prototype.codeExists);
const mockRepoCreate = vi.mocked(CatalogRepository.prototype.create);
const mockRepoUpdate = vi.mocked(CatalogRepository.prototype.update);
const mockDelete = vi.mocked(CatalogRepository.prototype.delete);
const mockCountSoldByProductIds = vi.mocked(CatalogRepository.prototype.countSoldByProductIds);
const mockCountApprovedVerifiedReviewsByProductIds = vi.mocked(CatalogRepository.prototype.countApprovedVerifiedReviewsByProductIds);
const mockCategoryFindById = vi.mocked(CategoriesRepository.prototype.findById);

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    category_id: 'cat-1',
    code: 'A1B2C3D4',
    title: 'Test Product',
    reviews: 0,
    sales: 0,
    benefits: 'benefits',
    icons: 'icons',
    pricing: 99.9,
    pix_pricing: 89.9,
    quantity_stock: 10,
    carousel_image: ['http://localhost:3000/img.jpg'],
    specifications: { volume: '30ml' },
    description: 'desc',
    applications: 'app',
    where_use: ['face'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.delByPrefix('catalog:');
    cache.delByPrefix('categories:');
    cache.delByPrefix('seo:');
    mockCountSoldByProductIds.mockResolvedValue(new Map());
    mockCountApprovedVerifiedReviewsByProductIds.mockResolvedValue(new Map());
    service = new CatalogService();
  });

  it('throws PRODUCT_NOT_FOUND when code does not match any product', async () => {
    mockFindByCode.mockResolvedValue(null);
    await expect(service.getPublicByCode('MISSING')).rejects.toThrow('PRODUCT_NOT_FOUND');
  });

  it('returns public product by code', async () => {
    const product = makeProduct();
    mockFindByCode.mockResolvedValue(product as never);

    const result = await service.getPublicByCode('A1B2C3D4');

    expect(result).toEqual(product);
  });

  it('reuses cached product by code for identical request', async () => {
    const product = makeProduct();
    mockFindByCode.mockResolvedValue(product as never);

    await service.getPublicByCode('A1B2C3D4');
    await service.getPublicByCode('A1B2C3D4');

    expect(mockFindByCode).toHaveBeenCalledTimes(1);
  });

  it('returns paginated public list metadata unchanged', async () => {
    mockFindPublicList.mockResolvedValue({ items: [makeProduct()], total: 1 } as never);

    const result = await service.listPublic({ page: 2, limit: 12 } as any);

    expect(result).toEqual({ items: [expect.objectContaining({ id: 'prod-1' })], total: 1, page: 2, limit: 12 });
  });

  it('reuses cached public list for identical query', async () => {
    mockFindPublicList.mockResolvedValue({ items: [makeProduct()], total: 1 } as never);

    await service.listPublic({ page: 2, limit: 12 } as any);
    await service.listPublic({ page: 2, limit: 12 } as any);

    expect(mockFindPublicList).toHaveBeenCalledTimes(1);
  });

  it('returns paginated admin list metadata unchanged', async () => {
    mockFindAdminList.mockResolvedValue({ items: [makeProduct()], total: 2 } as never);

    const result = await service.listAdminProducts({ page: 1, limit: 10, threshold: 5 } as any);

    expect(result.total).toBe(2);
    expect(result.items[0]).toMatchObject({ id: 'prod-1' });
  });

  it('returns products with computed sales from order items', async () => {
    mockFindPublicList.mockResolvedValue({
      items: [makeProduct({ id: 'prod-1', sales: 999 })],
      total: 1,
    } as never);
    mockCountSoldByProductIds.mockResolvedValue(new Map([['prod-1', 4]]));

    const result = await service.listPublic({ page: 1, limit: 20 } as any);

    expect(mockCountSoldByProductIds).toHaveBeenCalledWith(['prod-1']);
    expect(result.items[0]).toMatchObject({ id: 'prod-1', sales: 4 });
  });

  it('returns products with computed verified review count', async () => {
    mockFindPublicList.mockResolvedValue({
      items: [makeProduct({ id: 'prod-1', reviews: 99 })],
      total: 1,
    } as never);
    mockCountApprovedVerifiedReviewsByProductIds.mockResolvedValue(new Map([['prod-1', 0]]));

    const result = await service.listPublic({ page: 1, limit: 20 } as any);

    expect(mockCountApprovedVerifiedReviewsByProductIds).toHaveBeenCalledWith(['prod-1']);
    expect(result.items[0]).toMatchObject({ id: 'prod-1', reviews: 0 });
  });

  it('throws PRODUCT_NOT_FOUND on adminGetById when product does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(service.adminGetById('missing')).rejects.toThrow('PRODUCT_NOT_FOUND');
  });

  it('throws CATEGORY_NOT_FOUND:id on create when category is invalid', async () => {
    mockCategoryFindById.mockResolvedValue(null);

    await expect(
      service.create({
        category_id: 'cat-x',
        title: 'Novo Produto',
        benefits: 'benefits',
        icons: 'icons',
        pricing: 20,
        pix_pricing: 18,
        applications: 'app',
      } as any),
    ).rejects.toThrow('CATEGORY_NOT_FOUND:cat-x');
  });

  it('throws CATEGORY_REQUIRED on create when no category is provided', async () => {
    await expect(
      service.create({
        title: 'Novo Produto',
        highlights: ['Alta durabilidade'],
        icons: 'icons',
        pricing: 20,
        pix_pricing: 18,
        applications: 'app',
      } as any),
    ).rejects.toThrow('CATEGORY_REQUIRED');
  });

  it('creates product with category_ids and derives benefits from highlights', async () => {
    mockCategoryFindById.mockImplementation(async (id: string) => ({ id } as never));
    mockCodeExists.mockResolvedValue(false);
    mockRepoCreate.mockResolvedValue(makeProduct() as never);

    await service.create({
      category_ids: ['cat-1', 'cat-2', 'cat-2'],
      code: 'ABCD1234',
      title: 'Novo Produto',
      highlights: ['Alta cobertura', 'Secagem rapida'],
      icons: 'icons',
      pricing: 20,
      pix_pricing: 18,
      applications: 'app',
    } as any);

    expect(mockRepoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: 'cat-1',
        category_ids: ['cat-1', 'cat-2'],
        highlights: ['Alta cobertura', 'Secagem rapida'],
        benefits: 'Alta cobertura\nSecagem rapida',
      }),
    );
  });

  it('creates product with provided code when code is unique', async () => {
    mockCategoryFindById.mockResolvedValue({ id: 'cat-1' } as never);
    mockCodeExists.mockResolvedValue(false);
    mockRepoCreate.mockResolvedValue(makeProduct() as never);

    const created = await service.create({
      category_id: 'cat-1',
      code: 'ABCD1234',
      title: 'Novo Produto',
      benefits: 'benefits',
      icons: 'icons',
      pricing: 20,
      pix_pricing: 18,
      applications: 'app',
    } as any);

    expect(mockRepoCreate).toHaveBeenCalledWith(expect.objectContaining({ code: 'ABCD1234' }));
    expect(created).toMatchObject({ id: 'prod-1' });
  });

  it('invalidates cached product keys after create', async () => {
    mockFindByCode.mockResolvedValue(makeProduct() as never);
    mockCategoryFindById.mockResolvedValue({ id: 'cat-1' } as never);
    mockCodeExists.mockResolvedValue(false);
    mockRepoCreate.mockResolvedValue(makeProduct() as never);

    await service.getPublicByCode('A1B2C3D4');
    await service.create({
      category_id: 'cat-1',
      code: 'ABCD1234',
      title: 'Novo Produto',
      benefits: 'benefits',
      icons: 'icons',
      pricing: 20,
      pix_pricing: 18,
      applications: 'app',
    } as any);
    await service.getPublicByCode('A1B2C3D4');

    expect(mockFindByCode).toHaveBeenCalledTimes(2);
  });

  it('throws PRODUCT_CODE_CONFLICT on update when code already exists', async () => {
    mockFindById.mockResolvedValue(makeProduct() as never);
    mockCodeExists.mockResolvedValue(true);

    await expect(service.update('prod-1', { code: 'DUPLICATE' } as any)).rejects.toThrow(
      'PRODUCT_CODE_CONFLICT',
    );
  });

  it('deletes product after existence check', async () => {
    mockFindById.mockResolvedValue(makeProduct() as never);
    mockDelete.mockResolvedValue(undefined as never);

    await service.delete('prod-1');

    expect(mockDelete).toHaveBeenCalledWith('prod-1');
  });

  it('updates product and validates category when category_id is provided', async () => {
    mockFindById.mockResolvedValue(makeProduct() as never);
    mockCategoryFindById.mockResolvedValue({ id: 'cat-2' } as never);
    mockRepoUpdate.mockResolvedValue(makeProduct({ category_id: 'cat-2' }) as never);

    const result = await service.update('prod-1', { category_id: 'cat-2', title: 'Atualizado' } as any);

    expect(mockCategoryFindById).toHaveBeenCalledWith('cat-2');
    expect(mockRepoUpdate).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({
        category_id: 'cat-2',
        category_ids: ['cat-2'],
      }),
    );
    expect(result).toMatchObject({ category_id: 'cat-2' });
  });

  it('updates product with category_ids and keeps first as primary category', async () => {
    mockFindById.mockResolvedValue(makeProduct() as never);
    mockCategoryFindById.mockImplementation(async (id: string) => ({ id } as never));
    mockRepoUpdate.mockResolvedValue(makeProduct({ category_id: 'cat-1' }) as never);

    await service.update('prod-1', { category_ids: ['cat-1', 'cat-3', 'cat-3'] } as any);

    expect(mockRepoUpdate).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({
        category_id: 'cat-1',
        category_ids: ['cat-1', 'cat-3'],
      }),
    );
  });

  it('updates highlights and derives benefits when benefits is omitted', async () => {
    mockFindById.mockResolvedValue(makeProduct() as never);
    mockRepoUpdate.mockResolvedValue(makeProduct() as never);

    await service.update('prod-1', { highlights: ['Item A', 'Item B'] } as any);

    expect(mockRepoUpdate).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({
        highlights: ['Item A', 'Item B'],
        benefits: 'Item A\nItem B',
      }),
    );
  });

  it('persists usage areas and regenerates where_use on update', async () => {
    mockFindById.mockResolvedValue(makeProduct() as never);
    mockRepoUpdate.mockResolvedValue(
      makeProduct({
        usage_areas: ['Rodovias'],
        where_use: [{ icon: 'road', description: 'Rodovias' }],
      }) as never,
    );

    await service.update('prod-1', { usage_areas: ['Rodovias'] } as any);

    expect(mockRepoUpdate).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({
        usage_areas: ['Rodovias'],
        where_use: [{ icon: 'road', description: 'Rodovias' }],
      }),
    );
  });

  it('lists normalized variants from product JSON payload', async () => {
    mockFindById.mockResolvedValue(
      makeProduct({
        variants: [
          { sku: 'AMR-G', stock: 5, priceAdjustment: 10, attributes: { cor: 'amarelo' }, imageUrl: '/uploads/v1.png' },
        ],
      }) as never,
    );

    const result = await service.listVariants('prod-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sku: 'AMR-G',
      stock: 5,
      priceAdjustment: 10,
      attributes: { cor: 'amarelo' },
      imageUrl: '/uploads/v1.png',
      isActive: true,
      position: 1,
    });
    expect(result[0]?.id).toBeTruthy();
  });

  it('rejects duplicate variant SKU on addVariant', async () => {
    mockFindById.mockResolvedValue(
      makeProduct({
        variants: [{ id: 'v1', sku: 'AMR-G', stock: 5, position: 1, isActive: true }],
      }) as never,
    );

    await expect(
      service.addVariant('prod-1', {
        sku: 'amr-g',
        stock: 3,
        attributes: { cor: 'amarelo', tamanho: 'G' },
      }),
    ).rejects.toThrow('VARIANT_SKU_CONFLICT');
  });

  it('updates a product variant by id', async () => {
    mockFindById
      .mockResolvedValueOnce(
        makeProduct({
          variants: [{ id: 'v1', sku: 'AMR-G', stock: 5, position: 1, isActive: true }],
        }) as never,
      )
      .mockResolvedValueOnce(
        makeProduct({
          variants: [{ id: 'v1', sku: 'AMR-G', stock: 5, position: 1, isActive: true }],
        }) as never,
      );
    mockRepoUpdate.mockResolvedValue(
      makeProduct({
        variants: [{ id: 'v1', sku: 'AMR-G', stock: 8, position: 1, isActive: true }],
      }) as never,
    );

    const result = await service.updateVariant('prod-1', 'v1', { stock: 8 });

    expect(mockRepoUpdate).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({
        variants: [
          expect.objectContaining({ id: 'v1', stock: 8 }),
        ],
      }),
    );
    expect(result).toMatchObject({ id: 'v1', stock: 8 });
  });

  it('deletes a product variant by id', async () => {
    mockFindById
      .mockResolvedValueOnce(
        makeProduct({
          variants: [
            { id: 'v1', sku: 'AMR-G', stock: 5, position: 1, isActive: true },
            { id: 'v2', sku: 'AMR-M', stock: 2, position: 2, isActive: true },
          ],
        }) as never,
      )
      .mockResolvedValueOnce(
        makeProduct({
          variants: [
            { id: 'v1', sku: 'AMR-G', stock: 5, position: 1, isActive: true },
            { id: 'v2', sku: 'AMR-M', stock: 2, position: 2, isActive: true },
          ],
        }) as never,
      );
    mockRepoUpdate.mockResolvedValue(
      makeProduct({
        variants: [{ id: 'v2', sku: 'AMR-M', stock: 2, position: 1, isActive: true }],
      }) as never,
    );

    await service.deleteVariant('prod-1', 'v1');

    expect(mockRepoUpdate).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({
        variants: [expect.objectContaining({ id: 'v2' })],
      }),
    );
  });

  it('throws VARIANT_NOT_FOUND when deleting unknown variant', async () => {
    mockFindById
      .mockResolvedValueOnce(
        makeProduct({
          variants: [{ id: 'v1', sku: 'AMR-G', stock: 5, position: 1, isActive: true }],
        }) as never,
      )
      .mockResolvedValueOnce(
        makeProduct({
          variants: [{ id: 'v1', sku: 'AMR-G', stock: 5, position: 1, isActive: true }],
        }) as never,
      );

    await expect(service.deleteVariant('prod-1', 'missing')).rejects.toThrow('VARIANT_NOT_FOUND');
  });
});
