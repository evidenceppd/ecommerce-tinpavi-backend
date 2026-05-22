import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

interface CacheHeadersOptions {
  maxAgeSeconds: number;
  sMaxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
  isPublic?: boolean;
}

function buildCacheControl(options: CacheHeadersOptions): string {
  const directives = [
    options.isPublic === false ? 'private' : 'public',
    `max-age=${options.maxAgeSeconds}`,
  ];

  if (typeof options.sMaxAgeSeconds === 'number') {
    directives.push(`s-maxage=${options.sMaxAgeSeconds}`);
  }

  if (typeof options.staleWhileRevalidateSeconds === 'number') {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidateSeconds}`);
  }

  return directives.join(', ');
}

function makeWeakEtag(payload: string): string {
  const hash = createHash('sha1').update(payload).digest('base64url');
  return `W/"${hash}"`;
}

function etagMatches(ifNoneMatch: string, etag: string): boolean {
  if (ifNoneMatch.trim() === '*') return true;

  const candidates = ifNoneMatch
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return candidates.includes(etag);
}

export function createCacheHeadersMiddleware(options: CacheHeadersOptions) {
  const cacheControl = buildCacheControl(options);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const withCacheHeaders = (payload: unknown): { payload: unknown; notModified: boolean } => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return { payload, notModified: false };
      }

      const payloadText =
        typeof payload === 'string'
          ? payload
          : Buffer.isBuffer(payload)
            ? payload.toString('utf8')
            : JSON.stringify(payload ?? '');

      const etag = makeWeakEtag(payloadText);
      const ifNoneMatch = req.headers['if-none-match'];

      res.setHeader('Cache-Control', cacheControl);
      res.setHeader('ETag', etag);
      res.setHeader('Vary', 'Accept-Encoding');

      if (typeof ifNoneMatch === 'string' && etagMatches(ifNoneMatch, etag)) {
        return { payload: undefined, notModified: true };
      }

      return { payload, notModified: false };
    };

    res.json = ((body: unknown) => {
      const { payload, notModified } = withCacheHeaders(body);
      if (notModified) {
        res.status(304).end();
        return res;
      }
      return originalJson(payload as object);
    }) as Response['json'];

    res.send = ((body?: unknown) => {
      const { payload, notModified } = withCacheHeaders(body);
      if (notModified) {
        res.status(304).end();
        return res;
      }
      return originalSend(payload as never);
    }) as Response['send'];

    next();
  };
}
