import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '@/shared/infra/prisma';

type ExplainRow = Record<string, unknown>;

type ExplainResult = {
  name: string;
  domain: 'products' | 'orders' | 'customers';
  sql: string;
  explain: ExplainRow[];
  usesIndex: boolean;
};

function stringifyJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, currentValue) => (typeof currentValue === 'bigint' ? currentValue.toString() : currentValue),
    2,
  );
}

async function runExplain(name: string, domain: ExplainResult['domain'], sql: string): Promise<ExplainResult> {
  const explain = (await prisma.$queryRawUnsafe(`EXPLAIN ${sql}`)) as ExplainRow[];

  const usesIndex = explain.some((row) => {
    const key = row['key'];
    return typeof key === 'string' && key.length > 0;
  });

  return {
    name,
    domain,
    sql,
    explain,
    usesIndex,
  };
}

async function showIndex(tableName: string): Promise<ExplainRow[]> {
  const indexes = (await prisma.$queryRawUnsafe(`SHOW INDEX FROM \`${tableName}\``)) as ExplainRow[];
  return indexes;
}

async function main(): Promise<void> {
  const explainChecks = await Promise.all([
    runExplain(
      'products_active_listing',
      'products',
      'SELECT id, title, createdAt FROM Product WHERE quantity_stock > 0 ORDER BY createdAt DESC LIMIT 20',
    ),
    runExplain(
      'products_by_category_join',
      'products',
      "SELECT p.id, p.title FROM Product p INNER JOIN ProductCategory pc ON p.category_id = pc.id WHERE p.category_id = 'sample' ORDER BY p.createdAt DESC LIMIT 20",
    ),
    runExplain(
      'orders_customer_status_listing',
      'orders',
      "SELECT id, customerId, status, createdAt FROM `Order` WHERE customerId = 'sample' AND status = 'PAID' ORDER BY createdAt DESC LIMIT 20",
    ),
    runExplain(
      'orders_status_listing',
      'orders',
      "SELECT id, status, createdAt FROM `Order` WHERE status = 'PAID' ORDER BY createdAt DESC LIMIT 20",
    ),
    runExplain(
      'customers_recent_listing',
      'customers',
      'SELECT id, email, createdAt FROM Customer ORDER BY createdAt DESC LIMIT 20',
    ),
  ]);

  const indexSnapshot = {
    Product: await showIndex('Product'),
    ProductCategory: await showIndex('ProductCategory'),
    Order: await showIndex('Order'),
    Customer: await showIndex('Customer'),
    Review: await showIndex('Review'),
  };

  const output = {
    generatedAt: new Date().toISOString(),
    explainChecks,
    indexSnapshot,
    summary: {
      totalChecks: explainChecks.length,
      indexedChecks: explainChecks.filter((check) => check.usesIndex).length,
    },
  };

  const logsDir = path.resolve(process.cwd(), 'logs');
  const outputPath = path.join(logsDir, 'db-explain-phase14.json');
  await mkdir(logsDir, { recursive: true });
  await writeFile(outputPath, `${stringifyJson(output)}\n`, 'utf8');

  console.table(
    explainChecks.map((check) => ({
      name: check.name,
      domain: check.domain,
      usesIndex: check.usesIndex,
      explainRows: check.explain.length,
    })),
  );

  console.info(`EXPLAIN snapshot written to ${outputPath}`);

  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error('Failed to execute EXPLAIN verification', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
