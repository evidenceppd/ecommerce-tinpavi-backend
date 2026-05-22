import { Router } from 'express';
import { requireAdmin } from '@/shared/middleware/require-admin';
import {
  dashboardOverviewController,
  lowStockReportController,
  salesReportController,
} from './admin.controller';

export const adminOperationsRouter = Router();

adminOperationsRouter.use(requireAdmin);
adminOperationsRouter.get('/dashboard', dashboardOverviewController);
adminOperationsRouter.get('/reports/sales', salesReportController);
adminOperationsRouter.get('/reports/low-stock', lowStockReportController);