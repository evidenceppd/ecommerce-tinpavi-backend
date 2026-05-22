# Phase 19 Performance Alerting

## Objective

Define and enforce deterministic alert thresholds for degradation in latency, throughput, CPU, and memory.

## Threshold Contract

Source: `backend-tinpavi/config/performance-alert-thresholds.json`

- API p95 latency: `<= 100 ms`
- Throughput: `>= 250 rps`
- CPU usage: `<= 80%`
- Memory usage: `<= 85%`

## Commands

```bash
cd backend-tinpavi
npm run perf:regression
npm run perf:dashboard
npm run perf:alerts
```

## CI Workflows

- `.github/workflows/perf-regression.yml`
- `.github/workflows/perf-alerting.yml`

## Alert Gate Behavior

The checker (`src/scripts/check-performance-alerts.ts`) exits with status code `1` when any threshold is violated, making it suitable as a blocking CI quality gate.
