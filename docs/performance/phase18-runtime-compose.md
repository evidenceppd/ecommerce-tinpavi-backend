# Phase 18 Runtime Compose

## Goals

- Add explicit CPU and memory limits per service.
- Use health checks for startup ordering and runtime visibility.
- Keep restart and shutdown behavior deterministic.

## Compose Validation

```bash
docker compose config
```

## Health Checks

- `mysql`: `mysqladmin ping` loopback check.
- `backend`: HTTP probe against `/ready`.
- `nginx`: HTTP probe against `/`.

## Runtime Limits

All limits are env-driven via `.env.example`:

- `*_MEMORY_LIMIT`
- `*_CPU_LIMIT`
- `*_HEALTHCHECK_*`

## Notes

- `backend` waits for healthy `mysql`.
- `nginx` waits for healthy `backend`.
- `backend` uses `stop_grace_period` to align with graceful shutdown code.