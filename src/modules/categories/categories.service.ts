import type { ProductCategory } from '@/generated/prisma/client';
import type { CreateCategoryDto, ListCategoriesQueryDto, UpdateCategoryDto } from './categories.schemas';
import { CategoriesRepository } from './categories.repository';
import { cache } from '@/shared/infra/memory-cache';
import {
  cachePrefixes,
  cacheTtl,
  categoriesAllKey,
  categoriesPaginatedKey,
  categoryByIdKey,
} from '@/shared/infra/cache-keys';

const repo = new CategoriesRepository();

export class CategoriesService {
  async listAll(): Promise<ProductCategory[]> {
    const key = categoriesAllKey();
    const cached = cache.safeGet<ProductCategory[]>(key);
    if (cached) return cached;

    const categories = await repo.findAll();
    cache.safeSet(key, categories, cacheTtl.categories);
    return categories;
  }

  async listPaginated(
    query: ListCategoriesQueryDto,
  ): Promise<{ items: ProductCategory[]; total: number }> {
    const key = categoriesPaginatedKey(query);
    const cached = cache.safeGet<{ items: ProductCategory[]; total: number }>(key);
    if (cached) return cached;

    const categories = await repo.findPaginated(query);
    cache.safeSet(key, categories, cacheTtl.categories);
    return categories;
  }

  async getById(id: string): Promise<ProductCategory> {
    const key = categoryByIdKey(id);
    const cached = cache.safeGet<ProductCategory>(key);
    if (cached) return cached;

    const cat = await repo.findById(id);
    if (!cat) throw new Error('CATEGORY_NOT_FOUND');
    cache.safeSet(key, cat, cacheTtl.categories);
    return cat;
  }

  async create(dto: CreateCategoryDto): Promise<ProductCategory> {
    const category = await repo.create(dto);
    cache.delByPrefix(cachePrefixes.categories);
    cache.delByPrefix(cachePrefixes.catalog);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<ProductCategory> {
    await this.getById(id);
    const category = await repo.update(id, dto);
    cache.delByPrefix(cachePrefixes.categories);
    cache.delByPrefix(cachePrefixes.catalog);
    return category;
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await repo.softDelete(id);
    cache.delByPrefix(cachePrefixes.categories);
    cache.delByPrefix(cachePrefixes.catalog);
  }
}
