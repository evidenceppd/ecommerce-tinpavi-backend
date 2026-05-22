# Phase 16 Endpoint Profiling

Generated at: 2026-05-08T12:11:19.987Z

| Endpoint | Method | Avg (ms) | P95 (ms) | Max (ms) | CPU User (us) | CPU System (us) | Heap Diff (KB) |
|---|---|---:|---:|---:|---:|---:|---:|
| /products?page=1&limit=20 | GET | 20.05 | 8.11 | 388.31 | 953000 | 78000 | 17715.45 |
| /orders?page=1&limit=20 | GET | 3.17 | 4.77 | 5.16 | 219000 | 0 | 4550.58 |
| /orders | POST | 4.81 | 6.22 | 24.99 | 203000 | 47000 | -3593.94 |

## Status Histograms

- GET /products?page=1&limit=20: {"200":25}

- GET /orders?page=1&limit=20: {"401":25}

- POST /orders: {"401":25}