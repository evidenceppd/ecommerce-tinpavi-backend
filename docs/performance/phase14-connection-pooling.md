# Phase 14 — Connection Pool Runbook

## Configuration

| Variable | Default (dev) | Recommended (prod) | Description |
|---|---|---|---|
| `DB_POOL_MAX` | 5 | 20 | Max simultaneous DB connections |
| `DB_POOL_IDLE_TIMEOUT_MS` | 10000 | 30000 | Idle connection release time (ms) |
| `DB_POOL_ACQUIRE_TIMEOUT_MS` | 5000 | 8000 | Max wait to acquire connection (ms) |

## Alert Thresholds

| Metric | Warning | Critical | Action |
|---|---|---|---|
| Pool saturation | >80% of `DB_POOL_MAX` | >95% | Increase `DB_POOL_MAX` or scale horizontally |
| Acquire timeout errors | >1% of requests | >5% | Increase `DB_POOL_ACQUIRE_TIMEOUT_MS` or reduce pool contention |
| Latency p95 | >200ms | >500ms | Review slow query log, check index usage |

## Monitoring

```sql
-- Active MySQL connections during load test
SHOW PROCESSLIST;

-- Connection count by host
SELECT HOST, COUNT(*) as connections
FROM information_schema.PROCESSLIST
GROUP BY HOST;
```

## Load Test

```bash
cd backend-tinpavi
# Default: 30 concurrent × 3 iterations
npx tsx src/scripts/db-pool-load-test.ts

# Heavy load simulation
LOAD_TEST_CONCURRENCY=50 LOAD_TEST_ITERATIONS=5 npx tsx src/scripts/db-pool-load-test.ts

# Output is written to logs/db-pool-load-test.json
```

## Startup Validation

The following values will cause a fast-fail at startup with a descriptive error:

- `DB_POOL_MAX` ≤ 0 or non-numeric
- `DB_POOL_IDLE_TIMEOUT_MS` < 1000ms
- `DB_POOL_ACQUIRE_TIMEOUT_MS` < 500ms

## Production Tuning Guide

- Start with `DB_POOL_MAX=10` and measure saturation under peak load
- Use `SHOW PROCESSLIST` to confirm active connections stay below max
- If p95 acquire time rises above 200ms, either increase `DB_POOL_MAX` or add a read replica
- Set `DB_POOL_IDLE_TIMEOUT_MS` slightly lower than MySQL `wait_timeout` (default: 28800s)
