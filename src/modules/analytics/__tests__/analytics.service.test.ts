import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPageViewCreate } = vi.hoisted(() => ({
  mockPageViewCreate: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    pageView: {
      create: mockPageViewCreate,
      count: vi.fn(),
      groupBy: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { analyticsService } from '../analytics.service';

describe('analyticsService.track', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageViewCreate.mockResolvedValue({ id: 1 });
  });

  it('persists explicit device, referrer and sessionId from payload', async () => {
    await analyticsService.track(
      {
        page: '/produto/1',
        title: 'Produto 1',
        device: 'mobile',
        referrer: 'https://google.com',
        sessionId: 'sess-1',
      },
      'Mozilla/5.0',
    );

    expect(mockPageViewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          page: '/produto/1',
          title: 'Produto 1',
          device: 'mobile',
          referrer: 'https://google.com',
          sessionId: 'sess-1',
        }),
      }),
    );
  });

  it('uses desktop device and null optional fields when missing', async () => {
    await analyticsService.track({ page: '/home' }, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    expect(mockPageViewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          page: '/home',
          device: 'desktop',
          referrer: null,
          sessionId: null,
        }),
      }),
    );
  });
});
