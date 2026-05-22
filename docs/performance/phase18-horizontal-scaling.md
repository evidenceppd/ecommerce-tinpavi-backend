# Phase 18 Horizontal Scaling Readiness

## Overlay and Upstream Template

- Compose overlay: `docker-compose.scale.yml`
- Nginx upstream template: `nginx/upstreams.conf.template`

## Validate Overlay

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml config
```

## Shared-State Requirements

- `JWT_SECRET` and `JWT_REFRESH_SECRET` must be identical across replicas.
- `TRUST_PROXY=true` must be configured when behind reverse proxy/load balancer.
- `APP_BASE_URL` must point to canonical public URL.

## Current Replica-Safety Caveats

- Local `uploads` storage is node-local and not multi-node safe.
- In-process `MemoryCache` is node-local and not shared across replicas.

## Rollout and Rollback

### Rollout

1. Apply base compose.
2. Apply scale overlay.
3. Reload nginx template-driven upstreams.

### Rollback

1. Remove scale overlay.
2. Return to single backend service instance.
3. Validate health endpoints and upstream resolution.