import { prisma } from '@/shared/infra/prisma';

export interface TrackPayload {
  page?: string;
  title?: string;
  referrer?: string;
  sessionId?: string;
  device?: string;
}

function detectDevice(userAgent: string): string {
  if (/mobile|android|iphone|ipad|tablet/i.test(userAgent)) return 'mobile';
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

export const analyticsService = {
  async track(payload: TrackPayload, userAgent = '') {
    const page = payload.page ?? '/';
    const device = payload.device ?? detectDevice(userAgent);
    const row = await prisma.pageView.create({
      data: {
        page,
        title: payload.title ?? null,
        device,
        referrer: payload.referrer ?? null,
        sessionId: payload.sessionId ?? null,
      },
    });
    return { id: row.id, counted: true };
  },

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7Start = new Date(now);
    last7Start.setDate(last7Start.getDate() - 6);
    last7Start.setHours(0, 0, 0, 0);

    const [totalViews, viewsThisMonth, deviceRows, dailyRows, last7Rows, topPagesRows] =
      await Promise.all([
        prisma.pageView.count(),
        prisma.pageView.count({ where: { createdAt: { gte: startOfMonth } } }),
        analyticsService.getDevicesMonth(),
        analyticsService.getDailyAverage(),
        analyticsService.getLast7Days(),
        analyticsService.getTopPages(5),
      ]);

    return {
      totalViews,
      viewsThisMonth,
      devices: deviceRows,
      dailyAverage: dailyRows,
      last7Days: last7Rows,
      topPages: topPagesRows,
      generatedAt: now.toISOString(),
    };
  },

  async getViewsMonth(dateFrom?: Date, dateTo?: Date) {
    const now = new Date();
    const from = dateFrom ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const to = dateTo ?? now;
    const count = await prisma.pageView.count({ where: { createdAt: { gte: from, lte: to } } });
    return { count, month: now.getMonth() + 1 };
  },

  async getDevicesMonth() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const rows = await prisma.pageView.groupBy({
      by: ['device'],
      where: { createdAt: { gte: startOfMonth } },
      _count: { device: true },
    });
    return rows.map((r) => ({ device: r.device, count: r._count.device }));
  },

  async getDailyAverage() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const total = await prisma.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } });
    const average = Math.round(total / 30);
    return { total, average, period: '30d' };
  },

  async getLast7Days() {
    const now = new Date();
    const results: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = await prisma.pageView.count({ where: { createdAt: { gte: start, lt: end } } });
      results.push({ date: start.toISOString().slice(0, 10), count });
    }
    return results;
  },

  async getTopPages(limit = 10) {
    const rows = await prisma.pageView.groupBy({
      by: ['page', 'title'],
      _count: { page: true },
      orderBy: { _count: { page: 'desc' } },
      take: limit,
    });
    return rows.map((r) => ({ page: r.page, title: r.title ?? null, views: r._count.page }));
  },

  async cleanup(days = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await prisma.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return { message: 'Cleanup complete', deletedCount: result.count, olderThan: cutoff.toISOString() };
  },
};
