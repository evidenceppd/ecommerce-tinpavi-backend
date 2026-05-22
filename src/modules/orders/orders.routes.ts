import { Router } from 'express';
import { requireAdmin } from '@/shared/middleware/require-admin';
import {
  checkoutController,
  validateCouponController,
  listMyOrdersController,
  getMyOrderController,
  cancelMyOrderController,
  adminListOrdersController,
  adminGetOrderController,
  adminUpdateOrderStatusController,
} from './orders.controller';

// Customer routes (authenticate applied at app.ts level)
export const ordersRouter = Router();
ordersRouter.post('/coupons/validate', validateCouponController);
ordersRouter.post('/', checkoutController);
ordersRouter.get('/', listMyOrdersController);
ordersRouter.get('/:id', getMyOrderController);
ordersRouter.delete('/:id/cancel', cancelMyOrderController);

// Admin routes (authenticate applied at app.ts; requireAdmin applied here)
export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAdmin);
adminOrdersRouter.get('/', adminListOrdersController);
adminOrdersRouter.get('/:id', adminGetOrderController);
adminOrdersRouter.patch('/:id/status', adminUpdateOrderStatusController);
