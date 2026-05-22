# Phase 19 Baseline vs Targets (v1.0 -> v1.1)

Generated from:

- `docs/performance/phase14-baseline.md`
- `docs/performance/phase16-load-test.md`
- `logs/phase19-metrics-dashboard.json`

| Area | Baseline (v1.0) | Target (v1.1) | Current (Phase 19) | Status |
|---|---|---|---|---|
| API latency (p95) | Not continuously gated | <= 100 ms | 2 ms | PASS |
| API throughput | No CI regression gate | >= 250 rps sustained window | 300 rps | PASS |
| CPU usage | No threshold gate | <= 80% | 25% | PASS |
| Memory usage | No threshold gate | <= 85% | 3.38% | PASS |
| Perf regression automation | Manual/phase-based | CI-enforced gate | Implemented | PASS |

## Notes

- Throughput and latency are now enforced via `perf:regression` plus CI workflow.
- Resource thresholds are enforced via `perf:alerts` against generated dashboard metrics.
- This document is the release-facing reference for v1.1 observability outcomes.
