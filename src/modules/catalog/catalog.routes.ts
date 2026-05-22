import { Router } from 'express';
import { requireAdmin } from '@/shared/middleware/require-admin';
import { createCacheHeadersMiddleware } from '@/shared/middleware/cache-headers.middleware';
import { validate } from '@/shared/middleware/validate';
import {
  createProductSchema,
  createProductVariantSchema,
  updateProductSchema,
  updateProductVariantSchema,
} from './catalog.schemas';
import {
  createProductVariantController,
  listProductsController,
  getProductController,
  listAdminProductsController,
  getAdminProductController,
  createProductController,
  updateProductController,
  deleteProductController,
  deleteProductVariantController,
  listProductVariantsController,
  updateProductVariantController,
} from './catalog.controller';

// Public routes — no authentication required
export const catalogRouter = Router();
const publicCatalogCache = createCacheHeadersMiddleware({
  maxAgeSeconds: 60,
  sMaxAgeSeconds: 120,
  staleWhileRevalidateSeconds: 300,
});
catalogRouter.get('/', publicCatalogCache, listProductsController);
catalogRouter.get('/:code', publicCatalogCache, getProductController);

// Admin routes — authenticate applied in app.ts, requireAdmin here per-route
export const adminCatalogRouter = Router();
adminCatalogRouter.get('/', requireAdmin, listAdminProductsController);
adminCatalogRouter.get('/:id', requireAdmin, getAdminProductController);
adminCatalogRouter.get('/:id/variants', requireAdmin, listProductVariantsController);
adminCatalogRouter.post('/:id/variants', requireAdmin, validate(createProductVariantSchema), createProductVariantController);
adminCatalogRouter.put('/:id/variants/:variantId', requireAdmin, validate(updateProductVariantSchema), updateProductVariantController);
adminCatalogRouter.delete('/:id/variants/:variantId', requireAdmin, deleteProductVariantController);
adminCatalogRouter.post('/', requireAdmin, validate(createProductSchema), createProductController);
adminCatalogRouter.put('/:id', requireAdmin, validate(updateProductSchema), updateProductController);
adminCatalogRouter.delete('/:id', requireAdmin, deleteProductController);
