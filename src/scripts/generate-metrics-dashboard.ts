import 'dotenv/config';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const LOGS_DIR = path.join(ROOT, 'logs');
const DOCS_DIR = path.join(ROOT, 'docs', 'performance');

const REGRESSION_LOG = path.join(LOGS_DIR, 'api-regression-phase19.json');
const ENDPOINT_PROFILE_LOG = path.join(LOGS_DIR, 'api-endpoint-profile-phase16.json');
const OUTPUT_JSON = path.join(LOGS_DIR, 'phase19-metrics-dashboard.json');
const OUTPUT_MD = path.join(DOCS_DIR, 'phase19-metrics-dashboard.md');

type DashboardMetrics = {
  generatedAt: string;
  latency: {
    p95Ms: number;
    p99Ms: number;
  };
  throughput: {
    rps: number;
  };
  resources: {
    cpuPct: number;
    memoryPct: number;
  };
  sources: string[];
};

async function readJson(filePath: string): Promise<any | undefined> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

function calculateCpuPct(profiles: any[]): number {
  if (!profiles.length) return 0;
  const average =
    profiles.reduce((sum, item) => sum + Number(item.cpuUserMicros ?? 0) + Number(item.cpuSystemMicros ?? 0), 0) /
    profiles.length;
  return Number(Math.min(100, average / 20000).toFixed(2));
}

function calculateMemoryPct(profiles: any[]): number {
  const budgetMb = Number(process.env['PERF_MEMORY_BUDGET_MB'] ?? '512');
  if (!profiles.length || budgetMb <= 0) return 0;
  const maxHeapDiffKb = Math.max(...profiles.map((item) => Number(item.heapDiffKb ?? 0), 0));
  const maxHeapDiffMb = Math.max(0, maxHeapDiffKb / 1024);
  return Number(Math.min(100, (maxHeapDiffMb / budgetMb) * 100).toFixed(2));
}

function toMarkdown(metrics: DashboardMetrics): string {
  return [
    '# Phase 19 Metrics Dashboard',
    '',
    `Generated at: ${metrics.generatedAt}`,
    '',
    '| Dimension | Metric | Value |',
    '|---|---|---:|',
    '| Latency | p95 (ms) | ' + metrics.latency.p95Ms.toFixed(2) + ' |',
    '| Latency | p99 (ms) | ' + metrics.latency.p99Ms.toFixed(2) + ' |',
    '| Throughput | requests/sec | ' + metrics.throughput.rps.toFixed(2) + ' |',
    '| Resource Usage | CPU (%) | ' + metrics.resources.cpuPct.toFixed(2) + ' |',
    '| Resource Usage | Memory (%) | ' + metrics.resources.memoryPct.toFixed(2) + ' |',
    '',
    '## Sources',
    ...metrics.sources.map((source) => `- ${source}`),
  ].join('\n');
}

async function run(): Promise<void> {
  await mkdir(LOGS_DIR, { recursive: true });
  await mkdir(DOCS_DIR, { recursive: true });

  const regressionPayload = await readJson(REGRESSION_LOG);
  const endpointPayload = await readJson(ENDPOINT_PROFILE_LOG);

  const summary = regressionPayload?.summary;
  const profiles = Array.isArray(endpointPayload?.profiles) ? endpointPayload.profiles : [];

  const metrics: DashboardMetrics = {
    generatedAt: new Date().toISOString(),
    latency: {
      p95Ms: Number(summary?.p95 ?? 0),
      p99Ms: Number(summary?.p99 ?? 0),
    },
    throughput: {
      rps: Number(summary?.requestRate ?? 0),
    },
    resources: {
      cpuPct: calculateCpuPct(profiles),
      memoryPct: calculateMemoryPct(profiles),
    },
    sources: [REGRESSION_LOG, ENDPOINT_PROFILE_LOG],
  };

  await writeFile(OUTPUT_JSON, JSON.stringify(metrics, null, 2), 'utf8');
  await writeFile(OUTPUT_MD, toMarkdown(metrics), 'utf8');

  console.log(`Metrics dashboard json written to: ${OUTPUT_JSON}`);
  console.log(`Metrics dashboard markdown written to: ${OUTPUT_MD}`);
}

run().catch((error) => {
  console.error('Metrics dashboard generation failed:', error);
  process.exit(1);
});
