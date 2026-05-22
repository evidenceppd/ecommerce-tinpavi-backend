import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaQueryMock = vi.fn();

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    $queryRaw: prismaQueryMock,
  },
}));

describe('runReadinessCheck', () => {
  beforeEach(() => {
    prismaQueryMock.mockReset();
    process.env['READINESS_TIMEOUT_MS'] = '1500';
  });

  it('returns ready true when database probe succeeds', async () => {
    prismaQueryMock.mockResolvedValueOnce([{ one: 1 }]);

    const { runReadinessCheck } = await import('@/shared/infra/readiness');
    const result = await runReadinessCheck();

    expect(result.ready).toBe(true);
    expect(result.checks.database).toBe('ok');
    expect(result.errors).toEqual([]);
  });

  it('returns ready false when database probe fails', async () => {
    prismaQueryMock.mockRejectedValueOnce(new Error('db unavailable'));

    const { runReadinessCheck } = await import('@/shared/infra/readiness');
    const result = await runReadinessCheck();

    expect(result.ready).toBe(false);
    expect(result.checks.database).toBe('error');
    expect(result.errors[0]).toContain('db unavailable');
  });
});