import { randomBytes, randomUUID } from 'node:crypto';

import type { Product } from '@/generated/prisma/client';
import type {
  AdminListProductsQueryDto,
  CreateProductVariantDto,
  CreateProductDto,
  UpdateProductDto,
  UpdateProductVariantDto,
  ListProductsQueryDto,
} from './catalog.schemas';
import { CatalogRepository } from './catalog.repository';
import { CategoriesRepository } from '@/modules/categories/categories.repository';
import { cache } from '@/shared/infra/memory-cache';
import {
  cachePrefixes,
  cacheTtl,
  catalogListKey,
  catalogProductByCodeKey,
} from '@/shared/infra/cache-keys';

const repo = new CatalogRepository();
const categoriesRepo = new CategoriesRepository();

type ProductWithComputedStats<T> = T & { sales: number; reviews: number };

export type ProductVariantRecord = {
  id: string;
  sku?: string;
  stock: number;
  priceAdjustment?: number;
  attributes?: Record<string, string>;
  imageUrl?: string;
  isActive: boolean;
  position: number;
};

function generateHexCode(lengthInBytes = 4): string {
  return randomBytes(lengthInBytes).toString('hex').toUpperCase();
}

function iconForUsageArea(description: string): string {
  const normalized = description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('obra')) return 'hard-hat';
  if (normalized.includes('condominio')) return 'building';
  if (normalized.includes('estacionamento')) return 'parking';
  if (normalized.includes('empresa') || normalized.includes('industrial')) return 'factory';
  if (normalized.includes('evento')) return 'calendar';
  return 'road';
}

function usageAreasToWhereUse(usageAreas: string[] = []) {
  return usageAreas.map((description) => ({
    icon: iconForUsageArea(description),
    description,
  }));
}

function normalizeCategoryIds(categoryIds: string[] = [], categoryId?: string): string[] {
  const merged = categoryIds.length > 0 ? categoryIds : categoryId ? [categoryId] : [];
  const unique = Array.from(new Set(merged.map((item) => item.trim()).filter(Boolean)));
  return unique;
}

function normalizeHighlights(highlights?: string[], benefits?: string): string[] {
  if (Array.isArray(highlights) && highlights.length > 0) {
    return Array.from(new Set(highlights.map((item) => item.trim()).filter(Boolean)));
  }

  if (typeof benefits === 'string' && benefits.trim().length > 0) {
    return Array.from(
      new Set(
        benefits
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  return [];
}

function highlightsToBenefits(highlights: string[]): string {
  return highlights.join('\n');
}

function sanitizeVariantAttributes(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const entries = Object.entries(value)
    .map(([key, raw]) => {
      const normalizedKey = key.trim();
      const normalizedValue = typeof raw === 'string' ? raw.trim() : '';
      return [normalizedKey, normalizedValue] as const;
    })
    .filter(([key, normalizedValue]) => key.length > 0 && normalizedValue.length > 0);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function sanitizeVariantSku(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function sanitizeVariantImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeVariantList(rawVariants: unknown): ProductVariantRecord[] {
  if (!Array.isArray(rawVariants)) return [];

  const usedIds = new Set<string>();
  const normalized: ProductVariantRecord[] = [];

  for (const [index, entry] of rawVariants.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;

    const item = entry as Record<string, unknown>;
    const fallbackId = `variant-${index + 1}`;
    let id = typeof item.id === 'string' && item.id.trim().length > 0 ? item.id.trim() : fallbackId;

    while (usedIds.has(id)) {
      id = `${id}-${randomBytes(2).toString('hex')}`;
    }

    usedIds.add(id);

    const stockValue = toFiniteNumber(item.stock);
    const stock = stockValue === undefined ? 0 : Math.max(0, Math.trunc(stockValue));

    const priceAdjustmentValue = toFiniteNumber(item.priceAdjustment);
    const positionValue = toFiniteNumber(item.position);

    const record: ProductVariantRecord = {
      id,
      stock,
      isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
      position: positionValue === undefined ? index + 1 : Math.max(1, Math.trunc(positionValue)),
    };

    const sku = sanitizeVariantSku(item.sku);
    if (sku) record.sku = sku;

    if (priceAdjustmentValue !== undefined) {
      record.priceAdjustment = priceAdjustmentValue;
    }

    const attributes = sanitizeVariantAttributes(item.attributes);
    if (attributes) record.attributes = attributes;

    const imageUrl = sanitizeVariantImageUrl(item.imageUrl);
    if (imageUrl) record.imageUrl = imageUrl;

    normalized.push(record);
  }

  return normalized
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({ ...item, position: index + 1 }));
}

function assertVariantSkuUniqueness(variants: ProductVariantRecord[]): void {
  const seen = new Map<string, string>();

  for (const variant of variants) {
    if (!variant.sku) continue;

    const key = variant.sku.toLowerCase();
    if (seen.has(key)) {
      throw new Error('VARIANT_SKU_CONFLICT');
    }
    seen.set(key, variant.id);
  }
}

function assertVariantStockValidity(variants: ProductVariantRecord[]): void {
  for (const variant of variants) {
    if (!Number.isInteger(variant.stock) || variant.stock < 0) {
      throw new Error('VARIANT_STOCK_INVALID');
    }
  }
}

export class CatalogService {
  private async withComputedStats<T extends { id: string }>(
    products: T[],
  ): Promise<Array<ProductWithComputedStats<T>>> {
    const productIds = products.map((product) => product.id);
    const [salesByProductId, reviewsByProductId] = await Promise.all([
      repo.countSoldByProductIds(productIds),
      repo.countApprovedVerifiedReviewsByProductIds(productIds),
    ]);
    return products.map((product) => ({
      ...product,
      sales: salesByProductId?.get(product.id) ?? 0,
      reviews: reviewsByProductId?.get(product.id) ?? 0,
    }));
  }

  private async withComputedStat<T extends { id: string }>(product: T): Promise<ProductWithComputedStats<T>> {
    const [item] = await this.withComputedStats([product]);
    return item;
  }

  async listPublic(
    query: ListProductsQueryDto,
  ): Promise<{ items: Product[]; total: number; page: number; limit: number }> {
    const key = catalogListKey(query);
    const cached = cache.safeGet<{ items: Product[]; total: number }>(key);

    if (cached) {
      return { items: cached.items, total: cached.total, page: query.page, limit: query.limit };
    }

    const fresh = await repo.findPublicList(query);
    const freshWithStats = { ...fresh, items: await this.withComputedStats(fresh.items) };
    const ttl = query.search ? cacheTtl.productSearch : cacheTtl.products;
    cache.safeSet(key, freshWithStats, ttl);
    return { items: freshWithStats.items, total: freshWithStats.total, page: query.page, limit: query.limit };
  }

  async getPublicByCode(code: string): Promise<Product> {
    const key = catalogProductByCodeKey(code);
    const cached = cache.safeGet<Product>(key);
    if (cached) return cached;

    const product = await repo.findByCode(code);
    if (!product) throw new Error('PRODUCT_NOT_FOUND');
    const productWithStats = await this.withComputedStat(product);
    cache.safeSet(key, productWithStats, cacheTtl.products);
    return productWithStats;
  }

  async listAdminProducts(query: AdminListProductsQueryDto) {
    const { items, total } = await repo.findAdminList(query);
    const itemsWithStats = await this.withComputedStats(items);
    return {
      items: itemsWithStats,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async adminGetById(id: string): Promise<Product> {
    const product = await repo.findById(id);
    if (!product) throw new Error('PRODUCT_NOT_FOUND');
    return this.withComputedStat(product);
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const categoryIds = normalizeCategoryIds(dto.category_ids, dto.category_id);
    if (categoryIds.length === 0) {
      throw new Error('CATEGORY_REQUIRED');
    }
    await this.validateCategories(categoryIds);

    const highlights = normalizeHighlights(dto.highlights, dto.benefits);
    const benefits = dto.benefits?.trim() || highlightsToBenefits(highlights);
    const variants = normalizeVariantList(dto.variants);
    assertVariantSkuUniqueness(variants);
    assertVariantStockValidity(variants);

    let code = dto.code ?? generateHexCode(4);
    while (await repo.codeExists(code)) {
      code = generateHexCode(4);
    }

    const product = await repo.create({
      category_id: categoryIds[0],
      category_ids: categoryIds,
      code,
      title: dto.title,
      slug: dto.slug ?? null,
      brand: dto.brand ?? null,
      reviews: dto.reviews ?? 0,
      sales: dto.sales ?? 0,
      benefits,
      highlights,
      faqs: dto.faqs,
      usage_areas: dto.usage_areas,
      variants,
      icons: dto.icons,
      pricing: dto.pricing,
      pix_pricing: dto.pix_pricing,
      compare_at_price: dto.compare_at_price ?? null,
      weight_kg: dto.weight_kg ?? null,
      dimensions: dto.dimensions ?? null,
      seo_title: dto.seo_title ?? null,
      seo_description: dto.seo_description ?? null,
      badge: dto.badge ?? null,
      is_featured: dto.is_featured ?? false,
      is_active: dto.is_active ?? true,
      quantity_stock: dto.quantity_stock ?? 0,
      carousel_image: dto.carousel_image,
      specifications: dto.specifications,
      description: dto.description ?? '',
      applications: dto.applications,
      where_use: usageAreasToWhereUse(dto.usage_areas),
    });

    cache.delByPrefix(cachePrefixes.catalog);

    return this.withComputedStat(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.adminGetById(id);

    if (dto.code && (await repo.codeExists(dto.code, id))) {
      throw new Error('PRODUCT_CODE_CONFLICT');
    }

    const data: UpdateProductDto = {
      ...dto,
      ...(dto.usage_areas !== undefined
        ? {
            usage_areas: dto.usage_areas,
            where_use: usageAreasToWhereUse(dto.usage_areas),
          }
        : {}),
    };

    if (dto.category_ids && dto.category_ids.length > 0) {
      const categoryIds = normalizeCategoryIds(dto.category_ids, dto.category_id);
      await this.validateCategories(categoryIds);
      data.category_ids = categoryIds;
      data.category_id = categoryIds[0];
    } else if (dto.category_id) {
      await this.validateCategory(dto.category_id);
      data.category_ids = [dto.category_id];
    }

    if (dto.highlights !== undefined || dto.benefits !== undefined) {
      const highlights = normalizeHighlights(dto.highlights, dto.benefits);
      data.highlights = highlights;
      data.benefits = dto.benefits?.trim() || highlightsToBenefits(highlights);
    }

    if (dto.variants !== undefined) {
      const variants = normalizeVariantList(dto.variants);
      assertVariantSkuUniqueness(variants);
      assertVariantStockValidity(variants);
      data.variants = variants;
    }

    const updated = await repo.update(id, data);
    cache.delByPrefix(cachePrefixes.catalog);
    return this.withComputedStat(updated);
  }

  async delete(id: string): Promise<void> {
    await this.adminGetById(id);
    await repo.softDelete(id);
    cache.delByPrefix(cachePrefixes.catalog);
  }

  async listVariants(productId: string): Promise<ProductVariantRecord[]> {
    const product = await this.adminGetById(productId);
    return normalizeVariantList(product.variants);
  }

  async addVariant(productId: string, dto: CreateProductVariantDto): Promise<ProductVariantRecord> {
    const product = await this.adminGetById(productId);
    const variants = normalizeVariantList(product.variants);

    const newVariant = normalizeVariantList([
      {
        ...dto,
        id: randomUUID(),
        position: dto.position ?? variants.length + 1,
      },
    ])[0];

    if (!newVariant) {
      throw new Error('VARIANT_INVALID');
    }

    const nextVariants = normalizeVariantList([...variants, newVariant]);
    assertVariantSkuUniqueness(nextVariants);
    assertVariantStockValidity(nextVariants);

    const updated = await repo.update(productId, { variants: nextVariants as any });
    cache.delByPrefix(cachePrefixes.catalog);

    const persisted = normalizeVariantList(updated.variants).find((item) => item.id === newVariant.id);
    if (!persisted) {
      throw new Error('VARIANT_NOT_FOUND');
    }

    return persisted;
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
  ): Promise<ProductVariantRecord> {
    await this.adminGetById(productId);
    const variants = await this.listVariants(productId);
    const currentIndex = variants.findIndex((item) => item.id === variantId);

    if (currentIndex < 0) {
      throw new Error('VARIANT_NOT_FOUND');
    }

    const current = variants[currentIndex];
    const nextVariant: ProductVariantRecord = {
      ...current,
      ...(dto.stock !== undefined ? { stock: Math.max(0, Math.trunc(dto.stock)) } : {}),
      ...(dto.priceAdjustment !== undefined ? { priceAdjustment: dto.priceAdjustment } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.position !== undefined ? { position: Math.max(1, Math.trunc(dto.position)) } : {}),
    };

    if (dto.sku !== undefined) {
      const sku = sanitizeVariantSku(dto.sku);
      if (sku) nextVariant.sku = sku;
      else delete nextVariant.sku;
    }

    if (dto.attributes !== undefined) {
      const attributes = sanitizeVariantAttributes(dto.attributes);
      if (attributes) nextVariant.attributes = attributes;
      else delete nextVariant.attributes;
    }

    if (dto.imageUrl !== undefined) {
      const imageUrl = sanitizeVariantImageUrl(dto.imageUrl);
      if (imageUrl) nextVariant.imageUrl = imageUrl;
      else delete nextVariant.imageUrl;
    }

    const nextVariants = normalizeVariantList([
      ...variants.slice(0, currentIndex),
      nextVariant,
      ...variants.slice(currentIndex + 1),
    ]);

    assertVariantSkuUniqueness(nextVariants);
    assertVariantStockValidity(nextVariants);

    const updated = await repo.update(productId, { variants: nextVariants as any });
    cache.delByPrefix(cachePrefixes.catalog);

    const persisted = normalizeVariantList(updated.variants).find((item) => item.id === variantId);
    if (!persisted) {
      throw new Error('VARIANT_NOT_FOUND');
    }

    return persisted;
  }

  async deleteVariant(productId: string, variantId: string): Promise<void> {
    await this.adminGetById(productId);
    const variants = await this.listVariants(productId);
    const nextVariants = variants.filter((item) => item.id !== variantId);

    if (nextVariants.length === variants.length) {
      throw new Error('VARIANT_NOT_FOUND');
    }

    await repo.update(productId, { variants: normalizeVariantList(nextVariants) as any });
    cache.delByPrefix(cachePrefixes.catalog);
  }

  private async validateCategory(categoryId: string): Promise<void> {
    const cat = await categoriesRepo.findById(categoryId);
    if (!cat) throw new Error(`CATEGORY_NOT_FOUND:${categoryId}`);
  }

  private async validateCategories(categoryIds: string[]): Promise<void> {
    await Promise.all(categoryIds.map((categoryId) => this.validateCategory(categoryId)));
  }
}
