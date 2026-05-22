/**
 * db-pool-load-test.ts
 *
 * Executes a concurrent query burst against the configured database to
 * validate connection pool behavior under load.
 *
 * Usage:
 *   npx tsx src/scripts/db-pool-load-test.ts
 *
 * Outputs results to logs/db-pool-load-test.json
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import 'dotenv/config';
import { prisma } from '../shared/infra/prisma.js';

const CONCURRENCY = Number(process.env['LOAD_TEST_CONCURRENCY'] ?? '30');
const ITERATIONS = Number(process.env['LOAD_TEST_ITERATIONS'] ?? '3');
const QUERY_TIMEOUT_MS = Number(process.env['LOAD_TEST_QUERY_TIMEOUT_MS'] ?? '5000');

interface QueryResult {
  iteration: number;
  worker: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

async function runWorker(iteration: number, worker: number): Promise<QueryResult> {
  const start = performance.now();
  try {
    await Promise.race([
      prisma.product.count(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('query timeout')), QUERY_TIMEOUT_MS),
      ),
    ]);
    return { iteration, worker, durationMs: Math.round(performance.now() - start), success: true };
  } catch (err) {
    return {
      iteration,
      worker,
      durationMs: Math.round(performance.now() - start),
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function run(): Promise<void> {
  console.log(
    `Starting pool load test: ${CONCURRENCY} concurrent workers × ${ITERATIONS} iterations`,
  );
  console.log(
    `Pool settings: max=${process.env['DB_POOL_MAX'] ?? '5'} idle=${process.env['DB_POOL_IDLE_TIMEOUT_MS'] ?? '10000'}ms acquire=${process.env['DB_POOL_ACQUIRE_TIMEOUT_MS'] ?? '5000'}ms`,
  );

  const allResults: QueryResult[] = [];

  for (let i = 1; i <= ITERATIONS; i++) {
    console.log(`\nIteration ${i}/${ITERATIONS}: launching ${CONCURRENCY} concurrent queries...`);
    const batchStart = performance.now();

    const batch = Array.from({ length: CONCURRENCY }, (_, w) => runWorker(i, w + 1));
    const results = await Promise.all(batch);

    const batchDurationMs = Math.round(performance.now() - batchStart);
    const successes = results.filter((r) => r.success).length;
    const failures = results.filter((r) => !r.success).length;
    const durations = results.filter((r) => r.success).map((r) => r.durationMs);
    const p50 = durations.length
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.5)]
      : 0;
    const p95 = durations.length
      ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]
      : 0;

    console.log(
      `  → ${successes} ok / ${failures} errors | batch=${batchDurationMs}ms | p50=${p50}ms p95=${p95}ms`,
    );
    allResults.push(...results);
  }

  // Summary
  const totalSuccess = allResults.filter((r) => r.success).length;
  const totalErrors = allResults.filter((r) => !r.success).length;
  const allDurations = allResults.filter((r) => r.success).map((r) => r.durationMs);
  allDurations.sort((a, b) => a - b);

  const summary = {
    timestamp: new Date().toISOString(),
    config: {
      concurrency: CONCURRENCY,
      iterations: ITERATIONS,
      queryTimeoutMs: QUERY_TIMEOUT_MS,
      poolMax: Number(process.env['DB_POOL_MAX'] ?? '5'),
      poolIdleTimeoutMs: Number(process.env['DB_POOL_IDLE_TIMEOUT_MS'] ?? '10000'),
      poolAcquireTimeoutMs: Number(process.env['DB_POOL_ACQUIRE_TIMEOUT_MS'] ?? '5000'),
    },
    totals: {
      queries: allResults.length,
      successes: totalSuccess,
      errors: totalErrors,
      errorRate: allResults.length > 0 ? ((totalErrors / allResults.length) * 100).toFixed(2) + '%' : '0%',
    },
    latencyMs: {
      min: allDurations[0] ?? 0,
      p50: allDurations[Math.floor(allDurations.length * 0.5)] ?? 0,
      p95: allDurations[Math.floor(allDurations.length * 0.95)] ?? 0,
      p99: allDurations[Math.floor(allDurations.length * 0.99)] ?? 0,
      max: allDurations[allDurations.length - 1] ?? 0,
    },
    errors: allResults.filter((r) => !r.success).map((r) => r.error),
    details: allResults,
  };

  // Write output
  const logsDir = path.resolve(__dirname, '../../logs');
  await mkdir(logsDir, { recursive: true });
  const outputPath = path.join(logsDir, 'db-pool-load-test.json');
  await writeFile(outputPath, JSON.stringify(summary, null, 2));

  console.log('\n=== LOAD TEST SUMMARY ===');
  console.log(`Queries:     ${summary.totals.queries} (${summary.totals.successes} ok / ${summary.totals.errors} errors)`);
  console.log(`Error rate:  ${summary.totals.errorRate}`);
  console.log(`Latency p50: ${summary.latencyMs.p50}ms`);
  console.log(`Latency p95: ${summary.latencyMs.p95}ms`);
  console.log(`Latency p99: ${summary.latencyMs.p99}ms`);
  console.log(`Output:      ${outputPath}`);

  if (summary.totals.errors > 0) {
    console.warn(`\nWARN: ${summary.totals.errors} queries failed — review error list above.`);
    process.exit(1);
  }
}

run()
  .catch((err) => {
    console.error('Load test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
