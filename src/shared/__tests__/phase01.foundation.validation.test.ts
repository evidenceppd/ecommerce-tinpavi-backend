import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { fail, ok } from '@/shared/http/response-envelope';
import { errorHandlerMiddleware } from '@/shared/middleware/error-handler';
import { notFoundMiddleware } from '@/shared/middleware/not-found';

const rootDir = path.resolve(__dirname, '../../..');

function readRootFile(file: string): string {
  return readFileSync(path.join(rootDir, file), 'utf8');
}

describe('phase 01 foundation validation contracts', () => {
  it('keeps strict TypeScript and required npm scripts', () => {
    const tsconfig = JSON.parse(readRootFile('tsconfig.json')) as {
      compilerOptions?: { strict?: boolean };
    };
    const pkg = JSON.parse(readRootFile('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(tsconfig.compilerOptions?.strict).toBe(true);
    expect(pkg.scripts?.dev).toContain('tsx watch');
    expect(pkg.scripts?.build).toBeDefined();
    expect(pkg.scripts?.start).toBeDefined();
  });

  it('keeps required environment and docker baseline contracts', () => {
    const envExample = readRootFile('.env.example');
    const compose = readRootFile('docker-compose.yml');

    for (const key of ['PORT=', 'DATABASE_URL=', 'NODE_ENV=', 'JWT_SECRET=', 'JWT_REFRESH_SECRET=']) {
      expect(envExample).toContain(key);
    }

    for (const service of ['backend:', 'mysql:']) {
      expect(compose).toContain(service);
    }
  });

  it('keeps health route mounted in app', () => {
    const appSource = readRootFile('src/app.ts');

    expect(appSource).toContain('app.get("/health"');
    expect(appSource).toContain('ok({');
  });

  it('builds success and failure envelopes in expected shape', () => {
    expect(ok({ status: 'ok' })).toEqual({
      success: true,
      data: { status: 'ok' },
      meta: undefined,
      error: null,
    });

    expect(fail('NOT_FOUND', 'Route not found')).toEqual({
      success: false,
      data: null,
      meta: undefined,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        details: undefined,
      },
    });
  });

  it('returns 404 envelope on not-found middleware', () => {
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    notFoundMiddleware(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(fail('NOT_FOUND', 'Route not found'));
  });

  it('returns normalized 500 envelope on error middleware', () => {
    const req = { requestId: 'req-01' } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    errorHandlerMiddleware(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      fail('INTERNAL_ERROR', 'Internal server error', undefined, { requestId: 'req-01' }),
    );

    spy.mockRestore();
  });
});
