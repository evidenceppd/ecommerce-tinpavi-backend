import type { ListProductsQueryDto } from '@/modules/catalog/catalog.schemas';
import type { ListCategoriesQueryDto } from '@/modules/categories/categories.schemas';

const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export const cachePrefixes = {
  catalog: 'catalog:',
  categories: 'categories:',
  seo: 'seo:',
} as const;

export const cacheTtl = {
  products: 60 * 10,
  productSearch: 60 * 5,
  categories: 60 * 60,
  seoRedirects: 60 * 5,
} as const;

export function catalogListKey(query: ListProductsQueryDto): string {
  return [
    `${cachePrefixes.catalog}list`,
    `category=${normalize(query.category_id)}`,
    `search=${normalize(query.search)}`,
    `orderBy=${normalize(query.orderBy)}`,
    `page=${query.page}`,
    `limit=${query.limit}`,
  ].join('|');
}

export function catalogProductByCodeKey(code: string): string {
  return `${cachePrefixes.catalog}product:${normalize(code)}`;
}

export function categoriesAllKey(): string {
  return `${cachePrefixes.categories}all`;
}

export function categoriesPaginatedKey(query: ListCategoriesQueryDto): string {
  return [
    `${cachePrefixes.categories}list`,
    `search=${normalize(query.search)}`,
    `page=${query.page}`,
    `limit=${query.limit}`,
  ].join('|');
}

export function categoryByIdKey(id: string): string {
  return `${cachePrefixes.categories}id:${normalize(id)}`;
}

export function seoRedirectsKey(): string {
  return `${cachePrefixes.seo}redirects`;
}
