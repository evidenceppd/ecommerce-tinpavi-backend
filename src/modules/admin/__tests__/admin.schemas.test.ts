import { describe, expect, it } from 'vitest';
import {
  dashboardQuerySchema,
  lowStockReportQuerySchema,
  salesReportQuerySchema,
} from '../admin.schemas';

describe('admin.schemas', () => {
  it('uses default queue preview limit for dashboard query', () => {
    const parsed = dashboardQuerySchema.parse({});
    expect(parsed.queuePreviewLimit).toBe(5);
  });

  it('rejects invalid sales report ranges where dateTo is before dateFrom', () => {
    expect(() =>
      salesReportQuerySchema.parse({
        dateFrom: '2026-05-10T00:00:00.000Z',
        dateTo: '2026-05-01T00:00:00.000Z',
      }),
    ).toThrow('dateTo must be greater than or equal to dateFrom');
  });

  it('accepts valid sales report range and defaults granularity to day', () => {
    const parsed = salesReportQuerySchema.parse({
      dateFrom: '2026-05-01T00:00:00.000Z',
      dateTo: '2026-05-10T00:00:00.000Z',
    });

    expect(parsed.granularity).toBe('day');
    expect(parsed.dateFrom).toBeInstanceOf(Date);
    expect(parsed.dateTo).toBeInstanceOf(Date);
  });

  it('uses low-stock defaults and coerces booleans', () => {
    const parsed = lowStockReportQuerySchema.parse({ includeInactive: 'true' });

    expect(parsed.threshold).toBe(5);
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.includeInactive).toBe(true);
  });
});
