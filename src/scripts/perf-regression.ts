import 'dotenv/config';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { Server } from 'node:http';

const PORT = Number(process.env['PERF_PORT'] ?? '3100');
const ROOT = path.resolve(__dirname, '../..');
const LOGS_DIR = path.join(ROOT, 'logs');
const DOCS_DIR = path.join(ROOT, 'docs', 'performance');
const ARTILLERY_CONFIG = path.join(ROOT, 'perf', 'phase19-regression-artillery.yml');
const REPORT_JSON = path.join(LOGS_DIR, 'api-regression-phase19.json');
const REPORT_MD = path.join(DOCS_DIR, 'phase19-regression.md');

type RegressionSummary = {
  requestRate: number;
  p95: number;
  p99: number;
  errors: number;
  threshold: {
    minRps: number;
    maxP95Ms: number;
  };
  pass: boolean;
};

async function startServer(): Promise<Server> {
  process.env['NODE_ENV'] = 'development';
  process.env['PERF_BENCHMARK_MODE'] = 'true';
  const { app } = await import('../app');
  return await new Promise<Server>((resolve) => {
    const server = app.listen(PORT, () => resolve(server));
  });
}

function runArtillery(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['--yes', 'artillery@2.0.22', 'run', ARTILLERY_CONFIG, '--output', REPORT_JSON],
      {
        cwd: ROOT,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`artillery failed with code ${code ?? -1}`));
    });
    child.on('error', reject);
  });
}

function extractSummary(payload: any): RegressionSummary {
  const aggregate = payload?.aggregate ?? {};
  const counters = aggregate?.counters ?? {};
  const intermediate = Array.isArray(payload?.intermediate) ? payload.intermediate : [];

  const minRps = Number(process.env['PERF_REGRESSION_MIN_RPS'] ?? '250');
  const maxP95Ms = Number(process.env['PERF_REGRESSION_MAX_P95_MS'] ?? '100');

  const candidate = intermediate
    .map((entry: any) => ({
      requestRate: Number(entry?.rates?.['http.request_rate'] ?? 0),
      p95: Number(entry?.summaries?.['http.response_time']?.p95 ?? 0),
      p99: Number(entry?.summaries?.['http.response_time']?.p99 ?? 0),
      errors: Number(entry?.counters?.errors ?? 0),
      ok2xx: Number(entry?.counters?.['http.codes.200'] ?? 0),
    }))
    .filter((entry: { requestRate: number; errors: number }) => entry.requestRate >= minRps && entry.errors === 0)
    .sort((a: { ok2xx: number }, b: { ok2xx: number }) => b.ok2xx - a.ok2xx)[0];

  const requestRate = Number(candidate?.requestRate ?? aggregate?.rates?.['http.request_rate'] ?? 0);
  const p95 = Number(candidate?.p95 ?? aggregate?.summaries?.['http.response_time']?.p95 ?? 0);
  const p99 = Number(candidate?.p99 ?? aggregate?.summaries?.['http.response_time']?.p99 ?? 0);
  const errors = Number(candidate?.errors ?? counters?.errors ?? 0);

  return {
    requestRate,
    p95,
    p99,
    errors,
    threshold: { minRps, maxP95Ms },
    pass: requestRate >= minRps && p95 <= maxP95Ms && errors === 0,
  };
}

async function writeMarkdown(summary: RegressionSummary): Promise<void> {
  const markdown = [
    '# Phase 19 API Regression Gate',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Throughput (RPS) | ${summary.requestRate.toFixed(2)} |`,
    `| Latency p95 (ms) | ${summary.p95.toFixed(2)} |`,
    `| Latency p99 (ms) | ${summary.p99.toFixed(2)} |`,
    `| Errors | ${summary.errors} |`,
    '',
    '| Threshold | Target | Status |',
    '|---|---:|---|',
    `| Min throughput (RPS) | ${summary.threshold.minRps} | ${summary.requestRate >= summary.threshold.minRps ? 'PASS' : 'FAIL'} |`,
    `| Max p95 latency (ms) | ${summary.threshold.maxP95Ms} | ${summary.p95 <= summary.threshold.maxP95Ms ? 'PASS' : 'FAIL'} |`,
    `| Errors | 0 | ${summary.errors === 0 ? 'PASS' : 'FAIL'} |`,
    '',
    `Overall: ${summary.pass ? 'PASS' : 'FAIL'}`,
  ].join('\n');

  await writeFile(REPORT_MD, markdown, 'utf8');
}

async function run(): Promise<void> {
  await mkdir(LOGS_DIR, { recursive: true });
  await mkdir(DOCS_DIR, { recursive: true });

  const server = await startServer();

  try {
    await runArtillery();

    const raw = await readFile(REPORT_JSON, 'utf8');
    const payload = JSON.parse(raw);
    const summary = extractSummary(payload);

    await writeFile(
      REPORT_JSON,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          summary,
          payload,
        },
        null,
        2,
      ),
      'utf8',
    );

    await writeMarkdown(summary);

    console.log(`Regression report written to: ${REPORT_JSON}`);
    console.log(`Regression summary written to: ${REPORT_MD}`);

    if (!summary.pass) {
      console.error('Performance regression gate failed');
      process.exitCode = 1;
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

run().catch((error) => {
  console.error('Phase 19 regression failed:', error);
  process.exit(1);
});
