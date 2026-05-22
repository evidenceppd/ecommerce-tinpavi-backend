import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  queuePreviewLimit: z.coerce.number().int().min(1).max(50).default(5),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const salesReportQuerySchema = z
  .object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
    granularity: z.enum(['day']).default('day'),
  })
  .refine((value) => value.dateTo >= value.dateFrom, {
    message: 'dateTo must be greater than or equal to dateFrom',
    path: ['dateTo'],
  });

export const lowStockReportQuerySchema = z.object({
  threshold: z.coerce.number().int().min(0).max(1000).default(5),
  includeInactive: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type DashboardQueryDto = z.infer<typeof dashboardQuerySchema>;
export type SalesReportQueryDto = z.infer<typeof salesReportQuerySchema>;
export type LowStockReportQueryDto = z.infer<typeof lowStockReportQuerySchema>;