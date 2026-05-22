import { describe, expect, it } from 'vitest';
import {
  adminListProductsQuerySchema,
  createProductVariantSchema,
  createProductSchema,
  listProductsQuerySchema,
  updateProductVariantSchema,
  updateProductSchema,
} from '../catalog.schemas';

describe('catalog.schemas', () => {
  it('applies defaults for createProductSchema', () => {
    const parsed = createProductSchema.parse({
      category_id: 'ck0abc1230000000000000000',
      title: 'Produto Tecnico',
      benefits: 'Durabilidade alta',
      icons: 'waterproof',
      pricing: 100,
      pix_pricing: 95,
      applications: 'Piso interno',
    });

    expect(parsed.reviews).toBe(0);
    expect(parsed.sales).toBe(0);
    expect(parsed.category_ids).toEqual([]);
    expect(parsed.quantity_stock).toBe(0);
    expect(parsed.carousel_image).toEqual([]);
    expect(parsed.specifications).toEqual({});
    expect(parsed.highlights).toEqual([]);
    expect(parsed.where_use).toEqual([]);
  });

  it('accepts category_ids without category_id for createProductSchema', () => {
    const parsed = createProductSchema.parse({
      category_ids: ['ck0abc1230000000000000000'],
      title: 'Produto Tecnico',
      highlights: ['Alta durabilidade'],
      icons: 'waterproof',
      pricing: 100,
      pix_pricing: 95,
      applications: 'Piso interno',
    });

    expect(parsed.category_ids).toEqual(['ck0abc1230000000000000000']);
    expect(parsed.highlights).toEqual(['Alta durabilidade']);
  });

  it('rejects create payload without any category', () => {
    expect(() =>
      createProductSchema.parse({
        title: 'Produto Tecnico',
        highlights: ['Alta durabilidade'],
        icons: 'waterproof',
        pricing: 100,
        pix_pricing: 95,
        applications: 'Piso interno',
      }),
    ).toThrow('At least one category must be provided');
  });

  it('rejects non-hex code with invalid length', () => {
    expect(() =>
      createProductSchema.parse({
        category_id: 'ck0abc1230000000000000000',
        code: 'ZZZ',
        title: 'Produto',
        benefits: 'Beneficios',
        icons: 'icon',
        pricing: 10,
        pix_pricing: 9,
        applications: 'uso',
      }),
    ).toThrow('code must be 8 hex chars');
  });

  it('accepts partial update payload in updateProductSchema', () => {
    const parsed = updateProductSchema.parse({ pricing: 42 });
    expect(parsed).toEqual({ pricing: 42 });
  });

  it('coerces listProducts query and uses defaults', () => {
    const parsed = listProductsQuerySchema.parse({ page: '2', limit: '10' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.orderBy).toBe('createdAt');
  });

  it('coerces admin lowStockOnly and enforces limit cap', () => {
    const parsed = adminListProductsQuerySchema.parse({ lowStockOnly: 'true', threshold: '3' });
    expect(parsed.lowStockOnly).toBe(true);
    expect(parsed.threshold).toBe(3);
    expect(() => adminListProductsQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('accepts create product variant payload', () => {
    const parsed = createProductVariantSchema.parse({
      sku: 'AMR-G',
      stock: 5,
      priceAdjustment: 10,
      attributes: { cor: 'amarelo', tamanho: 'G' },
      imageUrl: '/uploads/variant.png',
      isActive: true,
      position: 1,
    });

    expect(parsed.stock).toBe(5);
    expect(parsed.sku).toBe('AMR-G');
  });

  it('rejects update product variant payload with no fields', () => {
    expect(() => updateProductVariantSchema.parse({})).toThrow(
      'At least one variant field must be provided',
    );
  });
});
