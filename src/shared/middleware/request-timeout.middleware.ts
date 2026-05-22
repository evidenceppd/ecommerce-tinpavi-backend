import type { NextFunction, Request, Response } from 'express';
import { fail } from '@/shared/http/response-envelope';
import { isPerfBenchmarkMode } from '@/config/perf-benchmark';

const DEFAULT_TIMEOUT_MS = Number(process.env['HTTP_REQUEST_HANDLER_TIMEOUT_MS'] ?? '8000');

export function requestTimeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow disabling during perf tests to eliminate per-request AbortController + setTimeout overhead
  if (isPerfBenchmarkMode() || process.env['PERF_DISABLE_TIMEOUT'] === 'true') {
    req.abortSignal = undefined as unknown as AbortSignal;
    req.requestTimedOut = false;
    next();
    return;
  }

  const timeoutMs = Number(process.env['HTTP_REQUEST_HANDLER_TIMEOUT_MS'] ?? DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();

  req.abortSignal = controller.signal;
  req.requestTimedOut = false;

  const timeout = setTimeout(() => {
    req.requestTimedOut = true;
    controller.abort();

    if (!res.headersSent) {
      res.setHeader('Retry-After', '1');
      res
        .status(503)
        .json(fail('REQUEST_TIMEOUT', 'Request exceeded time budget and was aborted'));
    }
  }, timeoutMs);

  const clear = () => clearTimeout(timeout);
  res.on('finish', clear);
  res.on('close', clear);

  next();
}
