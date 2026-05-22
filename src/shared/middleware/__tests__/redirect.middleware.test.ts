import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetActiveRedirectMap } = vi.hoisted(() => ({
  mockGetActiveRedirectMap: vi.fn(),
}));

vi.mock('@/modules/seo/redirects.service', () => ({
  RedirectsService: class RedirectsService {
    getActiveRedirectMap = mockGetActiveRedirectMap;
  },
}));

import { redirectMiddleware } from '../redirect';

function createResponse() {
  return {
    redirect: vi.fn(),
  };
}

describe('redirectMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips non-GET requests', async () => {
    const req = { method: 'POST', path: '/old' };
    const res = createResponse();
    const next = vi.fn();

    await redirectMiddleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('returns 301 redirect when path matches redirect map', async () => {
    const req = { method: 'GET', path: '/old' };
    const res = createResponse();
    const next = vi.fn();

    mockGetActiveRedirectMap.mockResolvedValue(new Map([['/old', '/new']]));

    await redirectMiddleware(req as any, res as any, next);

    expect(res.redirect).toHaveBeenCalledWith(301, '/new');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when no redirect rule is found', async () => {
    const req = { method: 'GET', path: '/none' };
    const res = createResponse();
    const next = vi.fn();

    mockGetActiveRedirectMap.mockResolvedValue(new Map([['/old', '/new']]));

    await redirectMiddleware(req as any, res as any, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('is fail-open and calls next when redirect lookup throws', async () => {
    const req = { method: 'GET', path: '/old' };
    const res = createResponse();
    const next = vi.fn();

    mockGetActiveRedirectMap.mockRejectedValue(new Error('redis down'));

    await redirectMiddleware(req as any, res as any, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
