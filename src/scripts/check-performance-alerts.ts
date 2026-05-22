import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const DASHBOARD_JSON = path.join(ROOT, 'logs', 'phase19-metrics-dashboard.json');
const THRESHOLDS_JSON = path.join(ROOT, 'config', 'performance-alert-thresholds.json');

type Thresholds = {
  api_latency_ms: number;
  cpu_pct: number;
  memory_pct: number;
  min_rps: number;
};

async function run(): Promise<void> {
  const thresholds = JSON.parse(await readFile(THRESHOLDS_JSON, 'utf8')) as Thresholds;
  const dashboard = JSON.parse(await readFile(DASHBOARD_JSON, 'utf8')) as {
    latency: { p95Ms: number };
    throughput: { rps: number };
    resources: { cpuPct: number; memoryPct: number };
  };

  const failures: string[] = [];

  if (dashboard.latency.p95Ms > thresholds.api_latency_ms) {
    failures.push(`API p95 ${dashboard.latency.p95Ms}ms > ${thresholds.api_latency_ms}ms`);
  }

  if (dashboard.resources.cpuPct > thresholds.cpu_pct) {
    failures.push(`CPU ${dashboard.resources.cpuPct}% > ${thresholds.cpu_pct}%`);
  }

  if (dashboard.resources.memoryPct > thresholds.memory_pct) {
    failures.push(`Memory ${dashboard.resources.memoryPct}% > ${thresholds.memory_pct}%`);
  }

  if (dashboard.throughput.rps < thresholds.min_rps) {
    failures.push(`Throughput ${dashboard.throughput.rps}rps < ${thresholds.min_rps}rps`);
  }

  if (failures.length > 0) {
    console.error('Performance alert gate failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Performance alert gate passed');
}

run().catch((error) => {
  console.error('Performance alert check failed:', error);
  process.exit(1);
});
