import type { NextFunction, Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { isPerfBenchmarkMode } from '@/config/perf-benchmark';

const SLOW_REQUEST_MS = Number(process.env['APM_SLOW_REQUEST_MS'] ?? '500');

export function apmMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Read env at request-time so perf scripts can disable APM via env after import
  if (isPerfBenchmarkMode() || process.env['APM_ENABLED'] === 'false') {
    next();
    return;
  }

  const startedAt = performance.now();
  const startedMem = process.memoryUsage().heapUsed;
  const endpoint = `${req.method} ${req.originalUrl.split('?')[0] ?? req.path}`;

  res.on('finish', () => {
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    const endedMem = process.memoryUsage().heapUsed;
    const heapDiffKb = Number(((endedMem - startedMem) / 1024).toFixed(2));

    console.info(
      JSON.stringify({
        type: durationMs >= SLOW_REQUEST_MS ? 'apm_slow_span' : 'apm_span',
        traceId: req.requestId ?? null,
        endpoint,
        method: req.method,
        statusCode: res.statusCode,
        durationMs,
        heapDiffKb,
        queryCount: req.dbQueryCount ?? 0,
      }),
    );
  });

  next();
}
