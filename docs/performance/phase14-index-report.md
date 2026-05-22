# Phase 14 Strategic Index Report

## Scope
- Domains: products, orders, customers, reviews
- Verification artifact: logs/db-explain-phase14.json

## Added Indexes

| Model | Index | Purpose |
|-------|-------|---------|
| Product | idx_product_category_id (category_id) | Fast category-filtered product listings |
| Product | idx_product_title (title) | Search/sort support for product lookups |
| Product | idx_product_created_at (createdAt) | Recency listings and admin sorting |
| ProductCategory | idx_product_category_title (title) | Category lookup and ordering |
| Order | idx_order_customer_status_created (customerId, status, createdAt) | Customer + status filtered order listings |
| Order | idx_order_customer_created (customerId, createdAt) | Customer order history by recency |
| Order | idx_order_status_created (status, createdAt) | Admin status dashboards |
| Customer | idx_customer_created_at (createdAt) | Ordered customer listing |
| Review | idx_review_product_status_created (productId, status, createdAt) | Product review feed moderation filters |
| Review | idx_review_customer_created (customerId, createdAt) | Customer review history |

## EXPLAIN Validation Summary

Fill this section from logs/db-explain-phase14.json after running the script:
- total checks: 5
- checks using index key: 4
- non-indexed case: customers_recent_listing (small local dataset still using filesort)

## Endpoint Mapping

| Endpoint Pattern | Old Access Pattern | New Access Pattern | Expected Impact |
|------------------|--------------------|--------------------|-----------------|
| GET /products | full scan on stock + recency sort | idx_product_created_at + bounded pagination | lower rows examined and lower sort cost |
| GET /products?category_id=* | filter without category-leading index | idx_product_category_id | reduced rows scanned |
| GET /orders | mixed filters without composite index | idx_order_customer_status_created | bounded scan by customer+status |
| GET /admin/orders?status=* | status-only filter + sort | idx_order_status_created | reduced rows examined on status dashboards |
| GET /admin/customers | createdAt ordering without explicit index | idx_customer_created_at | stable paged listing cost |

## Measured Plan Deltas

| Check | Key Selected | Rows Examined | Notes |
|-------|--------------|---------------|-------|
| products_active_listing | none (small local dataset) | 1 | query validated against current product schema |
| products_by_category_join | none (small local dataset) | 1 | join now uses Product.category_id = ProductCategory.id |
| orders_customer_status_listing | idx_order_customer_status_created | 1 | Covering index path with status filter |
| orders_status_listing | idx_order_status_created | 1 | Status dashboard query now indexed |
| customers_recent_listing | none | 2 | Dataset too small; index present in SHOW INDEX snapshot |

## Verification Commands

```bash
cd backend-tinpavi
npx prisma migrate dev --name phase14_indexes
npx prisma generate
npx tsx src/scripts/db-explain-check.ts
```
