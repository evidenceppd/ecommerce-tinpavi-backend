import { describe, expect, it, vi } from 'vitest';

import { createCacheHeadersMiddleware } from '../cache-headers.middleware';

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: unknown;
  sendBody: unknown;
  ended: boolean;
  setHeader: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

function makeResponse(): MockResponse {
  const res = {
    statusCode: 200,
    headers: {},
    jsonBody: undefined,
    sendBody: undefined,
    ended: false,
    setHeader: vi.fn((key: string, value: string) => {
      res.headers[key] = value;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.jsonBody = body;
      return res;
    }),
    send: vi.fn((body?: unknown) => {
      res.sendBody = body;
      return res;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    end: vi.fn(() => {
      res.ended = true;
      return res;
    }),
  };

  return res;
}

describe('createCacheHeadersMiddleware', () => {
  const middleware = createCacheHeadersMiddleware({
    maxAgeSeconds: 60,
    sMaxAgeSeconds: 120,
    staleWhileRevalidateSeconds: 300,
  });

  it('skips non-GET requests', () => {
    const req = { method: 'POST', headers: {} };
    const res = makeResponse();
    const next = vi.fn();

    middleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('adds Cache-Control and ETag headers for successful GET json responses', () => {
    const req = { method: 'GET', headers: {} };
    const res = makeResponse();
    const next = vi.fn();

    middleware(req as any, res as any, next);
    res.json({ ok: true, data: [1, 2, 3] });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers['Cache-Control']).toBe(
      'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
    );
    expect(res.headers['Vary']).toBe('Accept-Encoding');
    expect(res.headers['ETag']).toMatch(/^W\//);
    expect(res.jsonBody).toEqual({ ok: true, data: [1, 2, 3] });
  });

  it('returns 304 when If-None-Match matches generated ETag', () => {
    const firstReq = { method: 'GET', headers: {} };
    const firstRes = makeResponse();

    middleware(firstReq as any, firstRes as any, vi.fn());
    firstRes.send('cacheable payload');

    const etag = firstRes.headers['ETag'];

    const req = { method: 'GET', headers: { 'if-none-match': etag } };
    const res = makeResponse();
    const next = vi.fn();

    middleware(req as any, res as any, next);
    res.send('cacheable payload');

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(304);
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(res.sendBody).toBeUndefined();
  });

  it('returns 304 when If-None-Match has multiple candidate etags', () => {
    const firstReq = { method: 'GET', headers: {} };
    const firstRes = makeResponse();

    middleware(firstReq as any, firstRes as any, vi.fn());
    firstRes.send('cacheable payload');

    const etag = firstRes.headers['ETag'];
    const req = { method: 'GET', headers: { 'if-none-match': `W/"other", ${etag}` } };
    const res = makeResponse();

    middleware(req as any, res as any, vi.fn());
    res.send('cacheable payload');

    expect(res.status).toHaveBeenCalledWith(304);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('does not set cache headers for non-success responses', () => {
    const req = { method: 'GET', headers: {} };
    const res = makeResponse();
    const next = vi.fn();

    middleware(req as any, res as any, next);
    res.status(404);
    res.json({ message: 'not found' });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers['Cache-Control']).toBeUndefined();
    expect(res.headers['ETag']).toBeUndefined();
  });
});
