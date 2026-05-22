# Phase 14 — Database Performance: Before / After Comparison Report

**Date:** 2026-05-07
**Milestone:** v1.1 Performance & Scalability
**Phase:** 14 — Database Performance Optimization

---

## Summary

Phase 14 delivered strategic indexing, N+1 elimination, connection pool configuration,
query profiling infrastructure, and automated regression guards across the three highest-traffic
domain modules: catalog, orders, and customers.

---

## Baseline (v1.0 — pre-Phase 14)

| Endpoint | Queries / Request | Pagination cap | Notes |
|---|---|---|---|
| `GET /products` (public) | 2 + N (legacy joins) | None enforced | N+1 risk on category/review loading |
| `GET /admin/products` | 2 + N | None enforced | N+1 risk on category expansion |
| `GET /admin/orders` | 2 + N (customer join) | None enforced | N+1 on customer fields |
| `GET /admin/customers` | 2 + N | None enforced | N+1 on address counts |
| DB connection pool | Default (no cap) | — | No limit; unbounded under load |
| Indexes (critical paths) | 0 composite indexes | — | Full table scans on common filters |
| Slow query detection | None | — | No observability |

---

## Optimized (v1.1 Phase 14)

| Endpoint | Queries / Request | Pagination cap | Notes |
|---|---|---|---|
| `GET /products` (public) | **2** (findMany + count) | **100 max** | Inline include: category + approved reviews |
| `GET /admin/products` | **2** | **100 max** | ADMIN_PRODUCT_LIST_INCLUDE (no per-row joins) |
| `GET /admin/orders` | **2** | **100 max** | ADMIN_ORDER_INCLUDE constant (items, customer) |
| `GET /admin/customers` | **2** | **100 max** | `_count: { orders, addresses }` inline |
| DB connection pool | **Configurable** (default: max=5) | — | `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_ACQUIRE_TIMEOUT_MS` |
| Indexes | **7 composite indexes** | — | See migration `add_strategic_indexes` |
| Slow query detection | **Enabled** (DB_PROFILE=true) | >100ms threshold | Structured JSON events, `performance.middleware.ts` |

---

## Indexes Added (Migration: `add_strategic_indexes`)

| Table | Index | Columns | Rationale |
|---|---|---|---|
| `Product` | `idx_product_category_id` | `(category_id)` | Category-filtered list acceleration |
| `Product` | `idx_product_created_at` | `(createdAt)` | Public/admin recency sorting |
| `Product` | `idx_product_title` | `(title)` | Product search/sort support |
| `Order` | `idx_order_customer_status` | `(customerId, status, createdAt)` | Customer order history with status filter |
| `Order` | `idx_order_status_created` | `(status, createdAt)` | Admin order list sort by date |
| `Customer` | `idx_customer_created_at` | `(createdAt)` | Admin ordered customer listing |
| `Review` | `idx_review_product_status` | `(productId, status, createdAt)` | Per-product approved review sort |
| `PageView` | `idx_pageview_path_created` | `(path, createdAt)` | Analytics path aggregation |

---

## Query Count Comparison (per endpoint)

| Endpoint | v1.0 queries | v1.1 queries | Reduction |
|---|---|---|---|
| `GET /products?limit=20` | ~22 (2 + 20×1) | **2** | −90% |
| `GET /admin/products?limit=20` | ~22 (2 + 20×1) | **2** | −90% |
| `GET /admin/orders?limit=20` | ~42 (2 + 20×2) | **2** | −95% |
| `GET /admin/customers?limit=20` | ~22 (2 + 20×1) | **2** | −91% |

---

## Connection Pool Configuration

```
# .env defaults (development)
DB_POOL_MAX=5
DB_POOL_IDLE_TIMEOUT_MS=10000
DB_POOL_ACQUIRE_TIMEOUT_MS=5000

# Recommended production values
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_ACQUIRE_TIMEOUT_MS=8000
```

**Startup validation:** Passing invalid pool values (non-numeric, max ≤ 0, timeouts below minimums)
causes a deterministic startup failure with a descriptive error message.

---

## Load Test Protocol

**Script:** `src/scripts/db-pool-load-test.ts`
**Command:**

```bash
cd backend-tinpavi
DB_POOL_MAX=5 npx tsx src/scripts/db-pool-load-test.ts
# Override concurrency:
LOAD_TEST_CONCURRENCY=50 LOAD_TEST_ITERATIONS=5 npx tsx src/scripts/db-pool-load-test.ts
```

**Output:** `logs/db-pool-load-test.json`

**Recommended baselines:**

| Metric | Acceptable | Warning | Critical |
|---|---|---|---|
| Error rate | < 1% | 1–5% | > 5% |
| Latency p50 | < 50ms | 50–150ms | > 150ms |
| Latency p95 | < 200ms | 200–500ms | > 500ms |
| Pool saturation | < 80% max_connections | 80–95% | > 95% |

---

## Performance Profiling Infrastructure

**Slow query logging** is active when `DB_PROFILE=true`:
- All queries above `DB_SLOW_QUERY_MS` (default 100ms) emit `db_slow_query` JSON events
- `performance.middleware.ts` captures per-request query count and total duration
- Events include: `requestId`, `endpointTag`, `durationMs`, `queryCount`, `queryHash`

**To enable in development:**
```bash
DB_PROFILE=true DB_SLOW_QUERY_MS=50 npm run dev
```

---

## Automated Regression Guards

Three test files enforce query-count ceilings and pagination constraints:

| File | Tests | Guards |
|---|---|---|
| `catalog/__tests__/catalog.performance.test.ts` | 5 | Query count=2, cap=100, include check, stock filter |
| `orders/__tests__/orders.performance.test.ts` | 3 | Query count=2, cap=100, items inline |
| `customers/__tests__/customers.performance.test.ts` | 2 | Query count=2, cap=100 |

**Run performance tests in CI:**
```bash
npx vitest run src/modules/catalog/__tests__/catalog.performance.test.ts \
               src/modules/orders/__tests__/orders.performance.test.ts \
               src/modules/customers/__tests__/customers.performance.test.ts
```

These tests will fail immediately if N+1 patterns reappear in any refactor.

---

## CI / Automation Commands

```bash
# Full backend test suite (includes performance regression guards)
cd backend-tinpavi && npm test

# Build verification
cd backend-tinpavi && npm run build

# Pool load test
cd backend-tinpavi && npx tsx src/scripts/db-pool-load-test.ts

# Performance-only test slice
cd backend-tinpavi && npx vitest run --reporter=verbose \
  src/modules/catalog/__tests__/catalog.performance.test.ts \
  src/modules/orders/__tests__/orders.performance.test.ts \
  src/modules/customers/__tests__/customers.performance.test.ts
```

---

## Phase 14 Deliverables Checklist

| Requirement | Deliverable | Status |
|---|---|---|
| DB-01 | Baseline audit and N+1 identification | ✅ |
| DB-02 | Strategic indexes (product/order/customer/review) | ✅ |
| DB-03 | Query refactoring — N+1 eliminated (catalog, orders, customers) | ✅ |
| DB-04 | Pagination caps enforced at repository layer (max=100) | ✅ |
| DB-05 | Connection pool configuration + load-test script | ✅ |
| —     | Slow-query logging middleware | ✅ |
| —     | Performance regression test suite (10 tests) | ✅ |
| —     | Before/after comparison report | ✅ (this document) |
