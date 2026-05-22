# Phase 18 Reverse Proxy

## Routing Ownership

- `/api/*` -> backend service
- `/uploads/*` -> backend static uploads
- `/assets/*` -> frontend static build assets
- `/` -> frontend shell

## Compression

- `gzip on`
- tuned for text and JSON asset types

## Caching Policy

- API responses: `Cache-Control: no-store`
- Frontend assets: immutable cache headers
- Uploads: short public cache window

## Verification Commands

```bash
docker compose config
curl -I http://localhost:8080/
curl -I http://localhost:8080/assets/
curl -I http://localhost:8080/api/health
```