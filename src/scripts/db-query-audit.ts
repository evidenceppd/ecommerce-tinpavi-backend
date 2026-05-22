import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { prisma } from '@/shared/infra/prisma';

type AuditQuery = {
  name: string;
  endpoint: string;
  execute: () => Promise<unknown>;
  expectedRows: number;
  expectedQueries: number;
};

type QueryMetric = {
  name: string;
  endpoint: string;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  expectedRows: number;
  expectedQueries: number;
  nPlusOneRisk: boolean;
  optimizationTarget: 'indexing' | 'eager-load' | 'join-rewrite' | 'pagination';
};

async function timedRun<T>(fn: () => Promise<T>): Promise<{ durationMs: number; result: T }> {
  const startedAt = performance.now();
  const result = await fn();
  return { durationMs: performance.now() - startedAt, result };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

function avg(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function pickTarget(endpoint: string): QueryMetric['optimizationTarget'] {
  if (endpoint.includes('/products') || endpoint.includes('/categories')) {
    return 'indexing';
  }
  if (endpoint.includes('/customers')) {
    return 'join-rewrite';
  }
  if (endpoint.includes('/orders')) {
    return 'eager-load';
  }
  return 'pagination';
}

async function buildMetrics(auditQueries: AuditQuery[]): Promise<QueryMetric[]> {
  const metrics: QueryMetric[] = [];

  for (const query of auditQueries) {
    await query.execute();

    const runs: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const { durationMs } = await timedRun(query.execute);
      runs.push(Number(durationMs.toFixed(2)));
    }

    const metric: QueryMetric = {
      name: query.name,
      endpoint: query.endpoint,
      avgMs: avg(runs),
      p95Ms: percentile(runs, 95),
      minMs: Number(Math.min(...runs).toFixed(2)),
      maxMs: Number(Math.max(...runs).toFixed(2)),
      expectedRows: query.expectedRows,
      expectedQueries: query.expectedQueries,
      nPlusOneRisk: query.expectedQueries > 3,
      optimizationTarget: pickTarget(query.endpoint),
    };

    metrics.push(metric);
  }

  return metrics.sort((a, b) => b.avgMs - a.avgMs);
}

async function main(): Promise<void> {
  const auditQueries: AuditQuery[] = [
    {
      name: 'catalog_public_list_default',
      endpoint: 'GET /products',
      execute: () =>
        prisma.product.findMany({
          where: { quantity_stock: { gt: 0 } },
          take: 20,
          include: { category: true },
        }),
      expectedRows: 20,
      expectedQueries: 2,
    },
    {
      name: 'catalog_public_list_search',
      endpoint: 'GET /products?search=serum',
      execute: () =>
        prisma.product.findMany({
          where: { OR: [{ title: { contains: 'serum' } }, { code: { contains: 'serum' } }] },
          take: 20,
        }),
      expectedRows: 20,
      expectedQueries: 2,
    },
    {
      name: 'catalog_admin_with_category_filter',
      endpoint: 'GET /admin/products?categoryId=*',
      execute: () =>
        prisma.product.findMany({
          where: { category_id: { not: '' } },
          take: 20,
          include: { category: true },
        }),
      expectedRows: 20,
      expectedQueries: 2,
    },
    {
      name: 'orders_admin_list',
      endpoint: 'GET /admin/orders',
      execute: () =>
        prisma.order.findMany({
          take: 20,
          include: {
            customer: true,
            items: true,
            statusHistory: true,
          },
        }),
      expectedRows: 20,
      expectedQueries: 5,
    },
    {
      name: 'orders_customer_list',
      endpoint: 'GET /orders',
      execute: () =>
        prisma.order.findMany({
          take: 20,
          include: { items: true },
        }),
      expectedRows: 20,
      expectedQueries: 3,
    },
    {
      name: 'customers_admin_list_with_counts',
      endpoint: 'GET /admin/customers',
      execute: () =>
        prisma.customer.findMany({
          take: 20,
          include: { addresses: true, orders: true },
        }),
      expectedRows: 20,
      expectedQueries: 5,
    },
    {
      name: 'customers_profile_address_list',
      endpoint: 'GET /me/addresses',
      execute: () =>
        prisma.address.findMany({
          take: 20,
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        }),
      expectedRows: 20,
      expectedQueries: 1,
    },
    {
      name: 'categories_tree_with_products',
      endpoint: 'GET /categories',
      execute: () =>
        prisma.productCategory.findMany({
          take: 20,
          include: { products: true },
        }),
      expectedRows: 20,
      expectedQueries: 4,
    },
    {
      name: 'reviews_product_feed',
      endpoint: 'GET /products/:id/reviews',
      execute: () =>
        prisma.review.findMany({
          where: { status: 'APPROVED' },
          take: 20,
          include: { customer: true, product: true },
        }),
      expectedRows: 20,
      expectedQueries: 3,
    },
    {
      name: 'seo_redirect_lookup',
      endpoint: 'GET /redirects',
      execute: () => prisma.redirect.findMany({ take: 20, orderBy: { createdAt: 'desc' } }),
      expectedRows: 20,
      expectedQueries: 1,
    },
    {
      name: 'analytics_recent_pageviews',
      endpoint: 'GET /analytics/pageviews',
      execute: () => prisma.pageView.findMany({ take: 20, orderBy: { createdAt: 'desc' } }),
      expectedRows: 20,
      expectedQueries: 1,
    },
    {
      name: 'blogs_public_feed',
      endpoint: 'GET /blogs',
      execute: () =>
        prisma.blog.findMany({
          where: { publicado: true },
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      expectedRows: 20,
      expectedQueries: 1,
    },
  ];

  const metrics = await buildMetrics(auditQueries);
  const nPlusOneCandidates = metrics
    .filter((metric) => metric.nPlusOneRisk)
    .map((metric) => ({
      endpoint: metric.endpoint,
      name: metric.name,
      expectedQueries: metric.expectedQueries,
      evidence: `estimatedQueries=${metric.expectedQueries} for ${metric.expectedRows} rows`,
      priority: metric.expectedQueries >= 5 ? 'P1' : 'P2',
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    baselineVersion: 'phase-14-01',
    slowQueryThresholdMs: 100,
    totalQueriesAnalyzed: metrics.length,
    rankedQueries: metrics,
    nPlusOneCandidates,
  };

  const logsDir = path.resolve(process.cwd(), 'logs');
  const outputPath = path.join(logsDir, 'db-query-audit-baseline.json');
  await mkdir(logsDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.table(
    metrics.slice(0, 12).map((metric) => ({
      query: metric.name,
      endpoint: metric.endpoint,
      avgMs: metric.avgMs,
      p95Ms: metric.p95Ms,
      expectedQueries: metric.expectedQueries,
      nPlusOneRisk: metric.nPlusOneRisk,
    })),
  );

  console.info(`Audit baseline report written to ${outputPath}`);

  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error('Failed to execute db query audit', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
