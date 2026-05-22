import { Router } from 'express';
import { authenticate } from '@/shared/middleware/authenticate';
import { requireAdmin } from '@/shared/middleware/require-admin';
import { validate } from '@/shared/middleware/validate';
import {
  listReviewsController,
  createReviewController,
  updateMyReviewController,
  deleteMyReviewController,
  reviewEligibilityController,
  adminListReviewsController,
  adminModerateReviewController,
  adminDeleteReviewController,
} from './reviews.controller';
import { createReviewSchema, updateReviewSchema, moderateReviewSchema } from './reviews.schemas';

// Customer routes — mounted at /products/:productId/reviews (mergeParams: true for req.params.productId)
export const reviewsRouter = Router({ mergeParams: true });
reviewsRouter.get('/', listReviewsController); // public
reviewsRouter.get('/eligibility', authenticate, reviewEligibilityController);
reviewsRouter.post('/', authenticate, validate(createReviewSchema), createReviewController);
reviewsRouter.patch('/mine', authenticate, validate(updateReviewSchema), updateMyReviewController);
reviewsRouter.delete('/mine', authenticate, deleteMyReviewController);

// Admin routes — mounted at /admin/reviews
export const adminReviewsRouter = Router();
adminReviewsRouter.use(requireAdmin);
adminReviewsRouter.get('/', adminListReviewsController);
adminReviewsRouter.patch('/:id', validate(moderateReviewSchema), adminModerateReviewController);
adminReviewsRouter.delete('/:id', adminDeleteReviewController);
