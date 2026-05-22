import { gzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

type CompressionResult = {
  level: number;
  averageCompressMs: number;
  compressedBytes: number;
  originalBytes: number;
  ratioPercent: number;
};

const ITERATIONS = Number(process.env['COMPRESSION_BENCH_ITERATIONS'] ?? '150');
const LEVELS = [1, 6, 9];

function buildPayload(): string {
  const item = {
    title: 'Produto premium de cuidados esteticos',
    description:
      'Formula avancada para hidratacao intensa, recuperacao de barreira cutanea e textura uniforme.',
    benefits: [
      'Hidratacao prolongada',
      'Absorcao rapida',
      'Acabamento leve',
      'Uso diario',
      'Sem fragrancia forte',
    ],
    whereUse: ['Face', 'Pescoco', 'Colo'],
    tags: ['skincare', 'anti-aging', 'clinic', 'dermatology'],
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    items: Array.from({ length: 300 }, (_, i) => ({ ...item, code: `P-${String(i).padStart(4, '0')}` })),
  };

  return JSON.stringify(payload);
}

function runForLevel(level: number, input: Buffer): CompressionResult {
  let totalMs = 0;
  let compressedBytes = 0;

  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = performance.now();
    const compressed = gzipSync(input, { level });
    totalMs += performance.now() - start;
    compressedBytes = compressed.length;
  }

  const originalBytes = input.length;
  const ratioPercent = Number(((compressedBytes / originalBytes) * 100).toFixed(2));

  return {
    level,
    averageCompressMs: Number((totalMs / ITERATIONS).toFixed(3)),
    compressedBytes,
    originalBytes,
    ratioPercent,
  };
}

function toMarkdown(results: CompressionResult[]): string {
  const generatedAt = new Date().toISOString();
  const rows = results
    .map(
      (r) =>
        `| ${r.level} | ${r.averageCompressMs} ms | ${r.originalBytes} | ${r.compressedBytes} | ${r.ratioPercent}% |`,
    )
    .join('\n');

  const winner = [...results].sort((a, b) => a.averageCompressMs - b.averageCompressMs)[0];

  return [
    '# Phase 15 Compression Benchmark',
    '',
    `Generated at: ${generatedAt}`,
    '',
    `Iterations per level: ${ITERATIONS}`,
    '',
    '| Gzip Level | Avg Compression Time | Original Bytes | Compressed Bytes | Ratio |',
    '|---|---:|---:|---:|---:|',
    rows,
    '',
    `Recommendation: use level ${winner.level} for balanced throughput in this environment.`,
  ].join('\n');
}

async function run(): Promise<void> {
  const input = Buffer.from(buildPayload(), 'utf8');
  const results = LEVELS.map((level) => runForLevel(level, input));

  const root = path.resolve(__dirname, '../..');
  const logsDir = path.join(root, 'logs');
  const docsDir = path.join(root, 'docs', 'performance');

  await mkdir(logsDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });

  const logPath = path.join(logsDir, 'compression-benchmark.json');
  await writeFile(
    logPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        iterations: ITERATIONS,
        results,
      },
      null,
      2,
    ),
  );

  const reportPath = path.join(docsDir, 'phase15-compression-benchmark.md');
  await writeFile(reportPath, toMarkdown(results));

  console.log(`Compression benchmark written to: ${logPath}`);
  console.log(`Compression report written to: ${reportPath}`);
}

run().catch((error) => {
  console.error('Compression benchmark failed:', error);
  process.exit(1);
});
