# Phase 15 Cache Invalidation Map

## Cache Namespaces

- catalog:
  - catalog:list|category=...|search=...|orderBy=...|page=...|limit=...
  - catalog:product:{code}
- categories:
  - categories:all
  - categories:list|search=...|page=...|limit=...
  - categories:id:{id}
- seo:
  - seo:redirects

## Write to Invalidation Mapping

- Catalog writes
  - create product -> delByPrefix(catalog:)
  - update product -> delByPrefix(catalog:)
  - delete product -> delByPrefix(catalog:)
- Category writes
  - create category -> delByPrefix(categories:) and delByPrefix(catalog:)
  - update category -> delByPrefix(categories:) and delByPrefix(catalog:)
  - delete category -> delByPrefix(categories:) and delByPrefix(catalog:)
- Redirect writes
  - create redirect -> delByPrefix(seo:)
  - update redirect -> delByPrefix(seo:)
  - delete redirect -> delByPrefix(seo:)

## Notes

- Prefix invalidation keeps the strategy simple while remaining deterministic.
- In-memory cache is fail-open; read path always falls back to repository queries if cache misses or errors.
- This mapping is the source of truth for future migration to Redis keyspace prefixes.
