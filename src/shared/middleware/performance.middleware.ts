/**
 * performance.middleware.ts
 *
 * Request performance middleware that captures per-endpoint latency and
 * Prisma query count. Emits structured JSON to stdout when DB_PROFILE=true
 * or when the request exceeds PERF_SLOW_REQUEST_MS (default 500ms).
 *
 * Activating:
 *   - app.use(performanceMiddleware) before routes
 *   - DB_PROFILE=true enables per-query profiling too (see prisma.ts)
 */

import type { Request, Response, NextFunction } from 'express';
import { performance } from 'node:perf_hooks';
import {
  runWithDbProfileContext,
  getDbProfileContext,
} from '../infra/db-profile-context.js';

const SLOW_REQUEST_MS = Number(process.env['PERF_SLOW_REQUEST_MS'] ?? '500');
const PROFILE_ENABLED = process.env['DB_PROFILE'] === 'true';

export function performanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!PROFILE_ENABLED) {
    next();
    return;
  }

  const requestId = Math.random().toString(36).slice(2, 10);
  const startMs = performance.now();
  const endpointTag = `${req.method} ${req.route?.path ?? req.path}`;

  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - startMs);
    const queryCount = getDbProfileContext()?.queryCount ?? 0;
    const isSlow = durationMs >= SLOW_REQUEST_MS;

    const payload = {
      type: isSlow ? 'request_slow' : 'request_perf',
      requestId,
      endpointTag,
      method: req.method,
      statusCode: res.statusCode,
      durationMs,
      queryCount,
    };

    console.info(JSON.stringify(payload));
  });

  runWithDbProfileContext({ requestId, endpointTag, startedAtMs: startMs }, () => {
    next();
  });
}

