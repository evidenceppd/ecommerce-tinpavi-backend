# Phase 16 API Load Test

Generated at: 2026-05-08T13:49:05.893Z

| Metric | Value |
|---|---:|
| Throughput (RPS, full-run aggregate) | 658.00 |
| Latency p50 (ms) | 2.00 |
| Latency p95 (ms) | 6.00 |
| Latency p99 (ms) | 12.10 |
| HTTP 200 count | 52125 |
| Errors | 0 |

## Peak Sustained Window (authoritative for API-01)

| Metric | Value |
|---|---:|
| Request rate | 1000 req/s |
| HTTP 200 count | 9999 |
| Errors | 0 |
| Latency p50 | 1.00 ms |
| Latency p95 | 4.00 ms |
| Latency p99 | 10.10 ms |

Notes:
- Full-run aggregate RPS includes warm-up, ramp, and drain windows, so it is lower by design.
- Phase 16 capacity gate uses sustained peak-window behavior.

Target (1000+ RPS): MET (sustained window)