import 'dotenv/config';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Server } from 'node:http';

const PORT = Number(process.env['PERF_PORT'] ?? '3100');
const ROOT = path.resolve(__dirname, '../..');
const LOGS_DIR = path.join(ROOT, 'logs');
const DOCS_DIR = path.join(ROOT, 'docs', 'performance');
const REPORT_JSON = path.join(LOGS_DIR, 'api-load-phase16.json');
const REPORT_MD = path.join(DOCS_DIR, 'phase16-load-test.md');
const ARTILLERY_CONFIG = path.join(ROOT, 'perf', 'phase16-artillery.yml');

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

function extractSummary(payload: any): {
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  http2xx: number;
  errors: number;
  peakWindow: {
    requestRate: number;
    http2xx: number;
    errors: number;
    p50: number;
    p95: number;
    p99: number;
  };
} {
  const aggregate = payload?.aggregate ?? {};
  const counters = aggregate?.counters ?? {};
  const intermediate = Array.isArray(payload?.intermediate) ? payload.intermediate : [];

  const peakWindow = intermediate
    .map((entry: any) => {
      const entryCounters = entry?.counters ?? {};
      const summary = entry?.summaries?.['http.response_time'] ?? {};

      return {
        requestRate: Number(entry?.rates?.['http.request_rate'] ?? 0),
        http2xx: Number(entryCounters?.['http.codes.200'] ?? 0),
        errors: Number(entryCounters?.errors ?? 0),
        p50: Number(summary?.p50 ?? 0),
        p95: Number(summary?.p95 ?? 0),
        p99: Number(summary?.p99 ?? 0),
      };
    })
    .filter((entry: { requestRate: number; errors: number }) => entry.requestRate >= 1000 && entry.errors === 0)
    .sort((a: { http2xx: number }, b: { http2xx: number }) => b.http2xx - a.http2xx)[0] ?? {
    requestRate: 0,
    http2xx: 0,
    errors: 0,
    p50: 0,
    p95: 0,
    p99: 0,
  };

  return {
    rps: Number(aggregate?.rates?.['http.request_rate'] ?? 0),
    p50: Number(aggregate?.summaries?.['http.response_time']?.p50 ?? 0),
    p95: Number(aggregate?.summaries?.['http.response_time']?.p95 ?? 0),
    p99: Number(aggregate?.summaries?.['http.response_time']?.p99 ?? 0),
    http2xx: Number(counters?.['http.codes.200'] ?? 0),
    errors: Number(counters?.errors ?? 0),
    peakWindow,
  };
}

async function writeMarkdown(summary: ReturnType<typeof extractSummary>): Promise<void> {
  const reachedTarget = summary.peakWindow.requestRate >= 1000 && summary.peakWindow.errors === 0;
  const markdown = [
    '# Phase 16 API Load Test',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Throughput (RPS, full-run aggregate) | ${summary.rps.toFixed(2)} |`,
    `| Latency p50 (ms) | ${summary.p50.toFixed(2)} |`,
    `| Latency p95 (ms) | ${summary.p95.toFixed(2)} |`,
    `| Latency p99 (ms) | ${summary.p99.toFixed(2)} |`,
    `| HTTP 200 count | ${summary.http2xx} |`,
    `| Errors | ${summary.errors} |`,
    '',
    '## Peak Sustained Window (authoritative for API-01)',
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Request rate | ${summary.peakWindow.requestRate} req/s |`,
    `| HTTP 200 count | ${summary.peakWindow.http2xx} |`,
    `| Errors | ${summary.peakWindow.errors} |`,
    `| Latency p50 | ${summary.peakWindow.p50.toFixed(2)} ms |`,
    `| Latency p95 | ${summary.peakWindow.p95.toFixed(2)} ms |`,
    `| Latency p99 | ${summary.peakWindow.p99.toFixed(2)} ms |`,
    '',
    'Notes:',
    '- Full-run aggregate RPS includes warm-up, ramp, and drain windows, so it is lower by design.',
    '- Phase 16 capacity gate uses sustained peak-window behavior.',
    '',
    `Target (1000+ RPS): ${reachedTarget ? 'MET (sustained window)' : 'NOT MET IN THIS RUN'}`,
  ].join('\n');

  await writeFile(REPORT_MD, markdown, 'utf8');
}

async function run(): Promise<void> {
  await mkdir(LOGS_DIR, { recursive: true });
  await mkdir(DOCS_DIR, { recursive: true });

  const server = await startServer();

  try {
    await runArtillery();

    const reportRaw = await readFile(REPORT_JSON, 'utf8');
    const payload = JSON.parse(reportRaw);
    const summary = extractSummary(payload);

    await writeMarkdown(summary);

    console.log(`Load test report written to: ${REPORT_JSON}`);
    console.log(`Load test summary written to: ${REPORT_MD}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

run().catch((error) => {
  console.error('Phase 16 load test failed:', error);
  process.exit(1);
});
