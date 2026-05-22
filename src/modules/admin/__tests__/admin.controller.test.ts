import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

const {
  mockDashboardQueryParse,
  mockSalesReportQueryParse,
  mockLowStockReportQueryParse,
  mockGetDashboardOverview,
  mockGetSalesReport,
  mockGetLowStockReport,
} = vi.hoisted(() => ({
  mockDashboardQueryParse: vi.fn(),
  mockSalesReportQueryParse: vi.fn(),
  mockLowStockReportQueryParse: vi.fn(),
  mockGetDashboardOverview: vi.fn(),
  mockGetSalesReport: vi.fn(),
  mockGetLowStockReport: vi.fn(),
}));

vi.mock('../admin.schemas', async () => {
  const actual = await vi.importActual<typeof import('../admin.schemas')>('../admin.schemas');
  return {
    ...actual,
    dashboardQuerySchema: { parse: mockDashboardQueryParse },
    salesReportQuerySchema: { parse: mockSalesReportQueryParse },
    lowStockReportQuerySchema: { parse: mockLowStockReportQueryParse },
  };
});

vi.mock('../admin.service', () => ({
  AdminService: class AdminService {
    getDashboardOverview = mockGetDashboardOverview;
    getSalesReport = mockGetSalesReport;
    getLowStockReport = mockGetLowStockReport;
  },
}));

import {
  dashboardOverviewController,
  lowStockReportController,
  salesReportController,
} from '../admin.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('admin.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dashboardOverviewController returns 200 with queue metadata', async () => {
    const req = { query: { queuePreviewLimit: '5' } };
    const res = createResponse();
    mockDashboardQueryParse.mockReturnValue({ queuePreviewLimit: 5 });
    mockGetDashboardOverview.mockResolvedValue({ pendingReviewQueue: [{ id: 'r1' }] });

    await dashboardOverviewController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meta: expect.objectContaining({ queuePreviewLimit: 5, pendingReviewQueueSize: 1 }),
      }),
    );
  });

  it('salesReportController maps ZodError to 400 INVALID_QUERY', async () => {
    const req = { query: { dateFrom: 'bad' } };
    const res = createResponse();
    mockSalesReportQueryParse.mockImplementation(() => {
      throw new ZodError([{ code: 'custom', path: ['dateFrom'], message: 'Bad query' } as any]);
    });

    await salesReportController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_QUERY', message: 'Bad query' }),
      }),
    );
  });

  it('lowStockReportController returns 200 with pagination metadata', async () => {
    const req = { query: { page: '1', limit: '10' } };
    const res = createResponse();
    mockLowStockReportQueryParse.mockReturnValue({ page: 1, limit: 10, threshold: 5, includeInactive: false });
    mockGetLowStockReport.mockResolvedValue({
      items: [{ id: 'p1' }],
      total: 1,
      page: 1,
      limit: 10,
      threshold: 5,
      includeInactive: false,
    });

    await lowStockReportController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meta: expect.objectContaining({ total: 1, page: 1, limit: 10, threshold: 5 }),
      }),
    );
  });
});
