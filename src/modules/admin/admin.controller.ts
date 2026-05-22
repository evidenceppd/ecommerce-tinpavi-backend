import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { fail, ok } from '@/shared/http/response-envelope';
import {
  dashboardQuerySchema,
  lowStockReportQuerySchema,
  salesReportQuerySchema,
} from './admin.schemas';
import { AdminService } from './admin.service';

const adminService = new AdminService();

function mapAdminError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof ZodError) {
    return {
      status: 400,
      code: 'INVALID_QUERY',
      message: error.issues[0]?.message ?? 'Invalid query parameters',
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
}

export async function dashboardOverviewController(req: Request, res: Response): Promise<void> {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const overview = await adminService.getDashboardOverview(query);

    res.status(200).json(
      ok(overview, {
        queuePreviewLimit: query.queuePreviewLimit,
        pendingReviewQueueSize: overview.pendingReviewQueue.length,
      }),
    );
  } catch (error) {
    const mapped = mapAdminError(error);
    res.status(mapped.status).json(fail(mapped.code, mapped.message));
  }
}

export async function salesReportController(req: Request, res: Response): Promise<void> {
  try {
    const query = salesReportQuerySchema.parse(req.query);
    const report = await adminService.getSalesReport(query);

    res.status(200).json(
      ok(report.buckets, {
        granularity: report.granularity,
        dateFrom: report.dateFrom,
        dateTo: report.dateTo,
        totals: report.totals,
      }),
    );
  } catch (error) {
    const mapped = mapAdminError(error);
    res.status(mapped.status).json(fail(mapped.code, mapped.message));
  }
}

export async function lowStockReportController(req: Request, res: Response): Promise<void> {
  try {
    const query = lowStockReportQuerySchema.parse(req.query);
    const report = await adminService.getLowStockReport(query);

    res.status(200).json(
      ok(report.items, {
        total: report.total,
        page: report.page,
        limit: report.limit,
        threshold: report.threshold,
        includeInactive: report.includeInactive,
      }),
    );
  } catch (error) {
    const mapped = mapAdminError(error);
    res.status(mapped.status).json(fail(mapped.code, mapped.message));
  }
}