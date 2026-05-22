import express, { type Request, type Response } from "express";
import { randomUUID } from 'crypto';
import compression from 'compression';
import path from "path";
import fs from 'fs/promises';
import { openApiDocument, swaggerHtml, swaggerInitScript, swaggerUiAssetsPath } from './config/openapi';

import { fail, ok } from "./shared/http/response-envelope";
import { applyPerfBenchmarkEnvDefaults } from './config/perf-benchmark';
import { getCompressionOptions } from './config/performance';
import { runReadinessCheck } from './shared/infra/readiness';
import { errorHandlerMiddleware } from "./shared/middleware/error-handler";
import { notFoundMiddleware } from "./shared/middleware/not-found";
import { authenticate } from "./shared/middleware/authenticate";
import { securityMiddleware, corsMiddleware, httpsRedirectMiddleware } from './shared/middleware/security';
import { csrfGuard } from './shared/middleware/csrf';
import {
  adminRateLimiter,
  authRateLimiter,
  publicReadRateLimiter,
  userRateLimiter,
} from './shared/middleware/rate-limit';
import { requestTimeoutMiddleware } from './shared/middleware/request-timeout.middleware';
import { apmMiddleware } from './shared/middleware/apm.middleware';
import { authRouter } from "./modules/auth/auth.routes";
import { adminCustomersRouter, customersRouter } from "./modules/customers/customers.routes";
import { catalogRouter, adminCatalogRouter } from "./modules/catalog/catalog.routes";
import { categoriesRouter, adminCategoriesRouter } from "./modules/categories/categories.routes";
import { ordersRouter, adminOrdersRouter } from './modules/orders/orders.routes';
import { couponsAdminRouter } from './modules/orders/coupons.routes';
import { reviewsRouter, adminReviewsRouter } from './modules/reviews/reviews.routes';
import { redirectMiddleware } from './shared/middleware/redirect';
import { seoRouter, adminRedirectsRouter } from './modules/seo/seo.routes';
import { orderPaymentRouter, paymentWebhookRouter } from './modules/payments/payments.routes';
import { shippingRouter } from './modules/shipping/shipping.routes';
import { adminOperationsRouter } from './modules/admin/admin.routes';
import { usersRouter } from './modules/users/users.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { blogsRouter } from './modules/blogs/blogs.routes';
import { cartRouter } from './modules/cart/cart.routes';
import { getDbProfileContext, runWithDbProfileContext } from './shared/infra/db-profile-context';
import { productImageUpload, validateUploadedProductImage } from './shared/middleware/upload';

applyPerfBenchmarkEnvDefaults();

const app = express();
const jsonBodyLimit = process.env['JSON_BODY_LIMIT'] ?? '256kb';
const formBodyLimit = process.env['FORM_BODY_LIMIT'] ?? '256kb';
const requestIdV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeInlineImageContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
]);
const contactInfoPath = path.join(process.cwd(), 'config', 'contact-info.json');
const defaultContactInfo = {
  id: 1,
  email: 'contato@tinpavi.com.br',
  endereco: '',
  link_maps: '',
  horario_funcionamento: 'Segunda a sexta, das 8h as 18h',
  telefone_1: '',
  telefone_2: '',
  whatsapp: '',
  link_instagram: '#',
  link_facebook: '#',
  link_linkedin: '#',
  link_youtube: '#',
};

async function readContactInfo() {
  try {
    const content = await fs.readFile(contactInfoPath, 'utf8');
    return { ...defaultContactInfo, ...JSON.parse(content) };
  } catch {
    return defaultContactInfo;
  }
}

async function writeContactInfo(payload: Record<string, unknown>) {
  await fs.mkdir(path.dirname(contactInfoPath), { recursive: true });
  const data = { ...defaultContactInfo, ...payload, id: 1 };
  await fs.writeFile(contactInfoPath, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

const heroBannerPath = path.join(process.cwd(), 'config', 'hero-banner.json');
const defaultHeroBanner = {
  titulo_1: 'ESPECIALISTAS EM',
  titulo_2: 'SINALIZAÇÃO VIÁRIA',
  titulo_3: 'PARA TODO O BRASIL',
  subtitulo: 'Produtos técnicos de alta qualidade para obras, empresas, condomínios e infraestrutura urbana.',
  cta_1: 'Ver produtos',
  cta_2: 'Falar com especialista',
  imagem: '',
};

async function readHeroBanner() {
  try {
    const content = await fs.readFile(heroBannerPath, 'utf8');
    return { ...defaultHeroBanner, ...JSON.parse(content) };
  } catch {
    return defaultHeroBanner;
  }
}

async function writeHeroBanner(payload: Record<string, unknown>) {
  await fs.mkdir(path.dirname(heroBannerPath), { recursive: true });
  const data = { ...defaultHeroBanner, ...payload };
  await fs.writeFile(heroBannerPath, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

// Trust proxy must be first — affects req.ip (rate-limiter) and req.secure (HTTPS redirect)
app.set('trust proxy', process.env['TRUST_PROXY'] === 'true' ? 1 : false);
app.use(httpsRedirectMiddleware);
app.use(securityMiddleware);
app.use(corsMiddleware);
app.use(compression(getCompressionOptions()) as express.RequestHandler); // cast required: @types/compression targets Express 4

app.use((req, res, next) => {
  const headerRequestId = req.headers['x-request-id'];
  req.requestId =
    typeof headerRequestId === 'string' && requestIdV4Regex.test(headerRequestId)
      ? headerRequestId
      : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

app.use(requestTimeoutMiddleware);
app.use(apmMiddleware);

app.use((req, res, next) => {
  const endpointPath = req.originalUrl.split('?')[0] ?? req.path;
  req.endpointTag = `${req.method} ${endpointPath}`;

  runWithDbProfileContext(
    {
      requestId: req.requestId ?? randomUUID(),
      endpointTag: req.endpointTag,
      startedAtMs: Date.now(),
    },
    () => {
      res.on('finish', () => {
        if (process.env['DB_PROFILE'] !== 'true') {
          return;
        }

        const context = getDbProfileContext();
        const queryCount = context?.queryCount ?? 0;
        req.dbQueryCount = queryCount;

        console.info(
          JSON.stringify({
            type: 'request_profile',
            requestId: req.requestId,
            endpointTag: req.endpointTag,
            statusCode: res.statusCode,
            durationMs: Date.now() - (context?.startedAtMs ?? Date.now()),
            queryCount,
          }),
        );
      });

      next();
    },
  );
});

// Webhook signatures must be validated against the exact raw request bytes.
app.use('/webhooks/payment', express.raw({ type: 'application/json', limit: jsonBodyLimit }));
app.use('/webhooks/payment', (req, res, next) => {
  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json(fail('INVALID_WEBHOOK_BODY', 'Invalid webhook body'));
    return;
  }

  req.rawBody = req.body;
  try {
    req.body = JSON.parse(req.rawBody.toString('utf8')) as Record<string, unknown>;
    next();
  } catch {
    res.status(400).json(fail('INVALID_JSON', 'Invalid JSON payload'));
  }
});

app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: formBodyLimit }));

app.get('/docs/openapi.json', (_req: Request, res: Response) => {
  res.status(200).json(openApiDocument);
});

app.use('/docs/assets', express.static(swaggerUiAssetsPath));

app.get('/docs/swagger-init.js', (_req: Request, res: Response) => {
  res.type('application/javascript').send(swaggerInitScript);
});

app.get('/docs', (_req: Request, res: Response) => {
  res.type('text/html').send(swaggerHtml);
});

app.use(csrfGuard);
app.use(redirectMiddleware);
app.post(
  '/uploads/image',
  authenticate,
  productImageUpload.single('image'),
  validateUploadedProductImage,
  (req: Request, res: Response) => {
    if (!req.file?.filename) {
      res.status(422).json(fail('VALIDATION_ERROR', 'Imagem obrigatoria'));
      return;
    }
    res.status(201).json(ok({ url: `/uploads/products/${req.file.filename}` }));
  },
);
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads'), {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const extMimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.avif': 'image/avif',
        '.bmp': 'image/bmp',
      };
      const contentType = extMimeMap[ext] ?? 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Allow cross-origin rendering of upload images (frontend runs on different port)
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      if (!safeInlineImageContentTypes.has(contentType)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  }),
);
app.use('/analytics', analyticsRouter);
app.use('/blogs', blogsRouter);

app.get('/contato', async (_req: Request, res: Response) => {
  res.status(200).json(ok(await readContactInfo()));
});

app.put('/contato', authenticate, async (req: Request, res: Response) => {
  const saved = await writeContactInfo(req.body as Record<string, unknown>);
  res.status(200).json(ok(saved));
});

app.get('/hero', async (_req: Request, res: Response) => {
  res.status(200).json(ok(await readHeroBanner()));
});

app.put('/hero', authenticate, async (req: Request, res: Response) => {
  const saved = await writeHeroBanner(req.body as Record<string, unknown>);
  res.status(200).json(ok(saved));
});

const blogBannerPath = path.join(process.cwd(), 'config', 'blog-banner.json');
const defaultBlogBanner = {
  supertitulo: 'Conteúdo técnico',
  titulo: 'Conteúdo técnico e orientações',
  descricao: 'Informações, dicas e boas práticas sobre sinalização viária para ajudar você a escolher e utilizar os produtos corretos com segurança e eficiência.',
  imagem: '',
};

async function readBlogBanner() {
  try {
    const content = await fs.readFile(blogBannerPath, 'utf8');
    return { ...defaultBlogBanner, ...JSON.parse(content) };
  } catch {
    return defaultBlogBanner;
  }
}

async function writeBlogBanner(payload: Record<string, unknown>) {
  await fs.mkdir(path.dirname(blogBannerPath), { recursive: true });
  const data = { ...defaultBlogBanner, ...payload };
  await fs.writeFile(blogBannerPath, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

app.get('/blog-banner', async (_req: Request, res: Response) => {
  res.status(200).json(ok(await readBlogBanner()));
});

app.put('/blog-banner', authenticate, async (req: Request, res: Response) => {
  const saved = await writeBlogBanner(req.body as Record<string, unknown>);
  res.status(200).json(ok(saved));
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json(
    ok({
      status: "ok",
      service: "ecommerce-tinpavi-api",
      timestamp: new Date().toISOString(),
    }),
  );
});

app.get('/ready', async (_req: Request, res: Response) => {
  const readiness = await runReadinessCheck();
  if (!readiness.ready) {
    res.status(503).json(
      fail('SERVICE_UNAVAILABLE', 'Service dependencies are not ready', {
        checks: readiness.checks,
        errors: readiness.errors,
      }),
    );
    return;
  }

  res.status(200).json(
    ok({
      status: 'ready',
      checks: readiness.checks,
      timestamp: new Date().toISOString(),
    }),
  );
});

app.use('/auth', authRateLimiter, authRouter);
app.use('/users', userRateLimiter, authenticate, usersRouter);
app.use('/me/cart', userRateLimiter, authenticate, cartRouter);
app.use('/me/orders', userRateLimiter, authenticate, orderPaymentRouter);
app.use('/me/shipping', userRateLimiter, authenticate, shippingRouter);
app.use("/me", userRateLimiter, authenticate, customersRouter);
app.use("/admin/customers", adminRateLimiter, authenticate, adminCustomersRouter);

app.use('/products', publicReadRateLimiter, catalogRouter);
app.use('/admin/products', adminRateLimiter, authenticate, adminCatalogRouter);
app.use('/categories', publicReadRateLimiter, categoriesRouter);
app.use('/admin/categories', adminRateLimiter, authenticate, adminCategoriesRouter);

app.use('/orders', userRateLimiter, authenticate, ordersRouter);
app.use('/admin/orders', adminRateLimiter, authenticate, adminOrdersRouter);
app.use('/admin/coupons', adminRateLimiter, authenticate, couponsAdminRouter);
app.use('/products/:productId/reviews', reviewsRouter); // auth handled per-route
app.use('/admin/reviews', adminRateLimiter, authenticate, adminReviewsRouter);

app.use(seoRouter);
app.use('/admin/redirects', adminRateLimiter, authenticate, adminRedirectsRouter);
app.use('/admin', adminRateLimiter, authenticate, adminOperationsRouter);

// Payment routes
app.use('/webhooks', paymentWebhookRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export { app };
