import { Router } from 'express';
import { requireAdmin } from '@/shared/middleware/require-admin';
import { createCacheHeadersMiddleware } from '@/shared/middleware/cache-headers.middleware';
import { validate } from '@/shared/middleware/validate';
import { createCategorySchema, updateCategorySchema } from './categories.schemas';
import {
  listCategoriesController,
  getCategoryController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from './categories.controller';

// Public routes — no authentication required
export const categoriesRouter = Router();
const publicCategoriesCache = createCacheHeadersMiddleware({
  maxAgeSeconds: 300,
  sMaxAgeSeconds: 600,
  staleWhileRevalidateSeconds: 900,
});
categoriesRouter.get('/', publicCategoriesCache, listCategoriesController);
categoriesRouter.get('/:id', publicCategoriesCache, getCategoryController);

// Admin routes — authenticate applied in app.ts, requireAdmin here
export const adminCategoriesRouter = Router();
adminCategoriesRouter.get('/', requireAdmin, listCategoriesController);
adminCategoriesRouter.post('/', requireAdmin, validate(createCategorySchema), createCategoryController);
adminCategoriesRouter.put('/:id', requireAdmin, validate(updateCategorySchema), updateCategoryController);
adminCategoriesRouter.delete('/:id', requireAdmin, deleteCategoryController);
