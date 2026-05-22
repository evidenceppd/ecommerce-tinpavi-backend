import 'dotenv/config';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Server } from 'node:http';

const PORT = Number(process.env['PERF_PORT'] ?? '3100');
const ROOT = path.resolve(__dirname, '../..');

const LOGS_PATH = path.join(ROOT, 'logs', 'api-endpoint-profile-phase16.json');
const DOC_PATH = path.join(ROOT, 'docs', 'performance', 'phase16-endpoint-profile.md');

type EndpointProfile = {
  endpoint: string;
  method: 'GET' | 'POST';
  averageMs: number;
  p95Ms: number;
  maxMs: number;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  heapDiffKb: number;
  statusHistogram: Record<string, number>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer(): Promise<Server> {
  process.env['NODE_ENV'] = 'development';
  const { app } = await import('../app');
  return await new Promise<Server>((resolve) => {
    const server = app.listen(PORT, () => resolve(server));
  });
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

async function runScenario(
  endpoint: string,
  method: 'GET' | 'POST',
  init?: RequestInit,
  iterations = 25,
): Promise<EndpointProfile> {
  const times: number[] = [];
  const statusHistogram: Record<string, number> = {};

  const cpuStart = process.cpuUsage();
  const memStart = process.memoryUsage().heapUsed;

  for (let i = 0; i < iterations; i += 1) {
    const startedAt = performance.now();
    const response = await fetch(`http://127.0.0.1:${PORT}${endpoint}`, {
      method,
      ...init,
    });
    const elapsed = Number((performance.now() - startedAt).toFixed(2));
    times.push(elapsed);
    const key = String(response.status);
    statusHistogram[key] = (statusHistogram[key] ?? 0) + 1;
    await response.text();
  }

  const cpu = process.cpuUsage(cpuStart);
  const memEnd = process.memoryUsage().heapUsed;

  return {
    endpoint,
    method,
    averageMs: Number((times.reduce((sum, value) => sum + value, 0) / times.length).toFixed(2)),
    p95Ms: percentile(times, 95),
    maxMs: Number(Math.max(...times).toFixed(2)),
    cpuUserMicros: cpu.user,
    cpuSystemMicros: cpu.system,
    heapDiffKb: Number(((memEnd - memStart) / 1024).toFixed(2)),
    statusHistogram,
  };
}

function toMarkdown(profiles: EndpointProfile[]): string {
  const lines = [
    '# Phase 16 Endpoint Profiling',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '| Endpoint | Method | Avg (ms) | P95 (ms) | Max (ms) | CPU User (us) | CPU System (us) | Heap Diff (KB) |',
    '|---|---|---:|---:|---:|---:|---:|---:|',
  ];

  for (const p of profiles) {
    lines.push(
      `| ${p.endpoint} | ${p.method} | ${p.averageMs} | ${p.p95Ms} | ${p.maxMs} | ${p.cpuUserMicros} | ${p.cpuSystemMicros} | ${p.heapDiffKb} |`,
    );
  }

  lines.push('', '## Status Histograms');
  for (const p of profiles) {
    lines.push('', `- ${p.method} ${p.endpoint}: ${JSON.stringify(p.statusHistogram)}`);
  }

  return lines.join('\n');
}

async function run(): Promise<void> {
  const server = await startServer();

  try {
    await sleep(300);

    const profiles: EndpointProfile[] = [];
    profiles.push(await runScenario('/products?page=1&limit=20', 'GET'));
    profiles.push(await runScenario('/orders?page=1&limit=20', 'GET'));
    profiles.push(
      await runScenario('/orders', 'POST', {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          shippingAddressId: 'cuid-placeholder',
          quoteId: 'quote-placeholder',
          items: [{ productId: 'cuid-placeholder', quantity: 1 }],
        }),
      }),
    );

    await mkdir(path.dirname(LOGS_PATH), { recursive: true });
    await mkdir(path.dirname(DOC_PATH), { recursive: true });

    await writeFile(
      LOGS_PATH,
      JSON.stringify({ generatedAt: new Date().toISOString(), profiles }, null, 2),
      'utf8',
    );
    await writeFile(DOC_PATH, toMarkdown(profiles), 'utf8');

    console.log(`Endpoint profiling report written to: ${LOGS_PATH}`);
    console.log(`Endpoint profiling summary written to: ${DOC_PATH}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

run().catch((error) => {
  console.error('Phase 16 endpoint profiling failed:', error);
  process.exit(1);
});
