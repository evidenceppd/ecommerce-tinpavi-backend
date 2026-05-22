import { Router } from 'express';
import { requireAdmin } from '@/shared/middleware/require-admin';
import { createCacheHeadersMiddleware } from '@/shared/middleware/cache-headers.middleware';
import { validate } from '@/shared/middleware/validate';
import { createRedirectSchema, updateRedirectSchema } from './seo.schemas';
import { sitemapController, robotsTxtController, productSchemaController, categorySchemaController } from './seo.controller';
import {
  listRedirectsController,
  createRedirectController,
  updateRedirectController,
  deleteRedirectController,
} from './redirects.controller';

// Public SEO routes (no auth)
export const seoRouter = Router();
const sitemapCache = createCacheHeadersMiddleware({
  maxAgeSeconds: 300,
  sMaxAgeSeconds: 600,
  staleWhileRevalidateSeconds: 900,
});
const schemaCache = createCacheHeadersMiddleware({
  maxAgeSeconds: 120,
  sMaxAgeSeconds: 300,
  staleWhileRevalidateSeconds: 600,
});

seoRouter.get('/sitemap.xml', sitemapCache, sitemapController);
seoRouter.get('/robots.txt', sitemapCache, robotsTxtController);
seoRouter.get('/products/:slug/schema', schemaCache, productSchemaController);
seoRouter.get('/categories/:slug/schema', schemaCache, categorySchemaController);

// Admin redirect CRUD
export const adminRedirectsRouter = Router();
adminRedirectsRouter.use(requireAdmin);
adminRedirectsRouter.get('/', listRedirectsController);
adminRedirectsRouter.post('/', validate(createRedirectSchema), createRedirectController);
adminRedirectsRouter.patch('/:id', validate(updateRedirectSchema), updateRedirectController);
adminRedirectsRouter.delete('/:id', deleteRedirectController);
