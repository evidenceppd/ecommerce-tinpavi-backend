# Phase 14 Baseline Audit

## Scope
- Endpoints profiled: catalog, orders, categories, customers, supporting feeds
- Slow threshold: 100ms
- Samples per query: 3 measured runs after 1 warm-up run

## Local MySQL Slow Log Setup

Use these commands on local MySQL before running the audit:

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.1;
SET GLOBAL log_output = 'FILE';
SHOW VARIABLES LIKE 'slow_query_log_file';
```

Optional reset before a clean capture:

```sql
FLUSH SLOW LOGS;
```

## Baseline Artifacts
- JSON metrics: logs/db-query-audit-baseline.json
- Prisma structured logs: enabled with DB_PROFILE=true

## Top Slow Queries (Baseline)

Populate from the generated JSON report in descending avg latency:

| Rank | Query | Endpoint | Avg ms | p95 ms | Query Count | Risk |
|------|-------|----------|--------|--------|-------------|------|
| 1 | catalog_public_list_default | GET /products | 6.48 | 7.51 | 4 | P2 |
| 2 | catalog_admin_with_category_filter | GET /admin/products?categoryId=* | 4.91 | 5.08 | 5 | P1 |
| 3 | customers_admin_list_with_counts | GET /admin/customers | 4.76 | 6.55 | 5 | P1 |
| 4 | orders_admin_list | GET /admin/orders | 4.10 | 4.45 | 5 | P1 |
| 5 | categories_tree_with_products | GET /categories | 3.99 | 4.23 | 4 | P2 |

## N+1 Candidates

| Endpoint | Evidence | Priority | Target |
|----------|----------|----------|--------|
| GET /admin/products?categoryId=* | estimatedQueries=5 for 20 rows | P1 | eager load + indexing |
| GET /admin/orders | estimatedQueries=5 for 20 rows | P1 | eager load + join rewrite |
| GET /admin/customers | estimatedQueries=5 for 20 rows | P1 | aggregate rewrite |
| GET /categories | estimatedQueries=4 for 20 rows | P2 | include tuning |

## Hotspot Matrix

| Endpoint | Avg Latency | Query Count | N+1 Risk | Priority | Optimization Target |
|----------|-------------|-------------|----------|----------|---------------------|
| GET /admin/products?categoryId=* | 4.91ms | 5 | High | P1 | Strategic index + eager load |
| GET /admin/orders | 4.10ms | 5 | High | P1 | include/select rewrite |
| GET /admin/customers | 4.76ms | 5 | High | P1 | grouped count + pagination |
| GET /categories | 3.99ms | 4 | Medium | P2 | include/select tuning |
| GET /products | 6.48ms | 4 | Medium | P2 | index + bounded includes |

## Slow Query Threshold Status

- No query exceeded 100ms in local baseline dataset.
- Slow query log should still remain enabled for realistic traffic replay to capture production-like outliers.

## Run Commands

```bash
cd backend-tinpavi
DB_PROFILE=true DB_SLOW_QUERY_MS=100 npx tsx src/scripts/db-query-audit.ts
npm run build
```
