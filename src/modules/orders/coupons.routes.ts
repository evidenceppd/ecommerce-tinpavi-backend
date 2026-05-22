import { Router } from 'express';
import { requireAdmin } from '@/shared/middleware/require-admin';
import {
  createCouponController,
  listCouponsController,
  getCouponController,
  updateCouponController,
  deleteCouponController,
} from './coupons.controller';

export const couponsAdminRouter = Router();
couponsAdminRouter.use(requireAdmin);
couponsAdminRouter.post('/', createCouponController);
couponsAdminRouter.get('/', listCouponsController);
couponsAdminRouter.get('/:id', getCouponController);
couponsAdminRouter.patch('/:id', updateCouponController);
couponsAdminRouter.delete('/:id', deleteCouponController);
