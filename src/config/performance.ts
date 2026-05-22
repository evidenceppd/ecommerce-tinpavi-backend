import type { CompressionOptions } from 'compression';
import { isPerfBenchmarkMode } from './perf-benchmark';

function asNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getCompressionOptions(): CompressionOptions {
  const level = asNumber(process.env['HTTP_COMPRESSION_LEVEL'], 6);
  const threshold = process.env['HTTP_COMPRESSION_THRESHOLD'] ?? (isPerfBenchmarkMode() ? '10mb' : '1kb');

  return {
    level: Math.max(1, Math.min(9, level)),
    threshold,
    filter: (req, res) => {
      const contentType = String(res.getHeader('Content-Type') ?? '').toLowerCase();
      if (contentType.includes('application/ld+json')) {
        return false;
      }

      const noCompression = req.headers['x-no-compression'];
      if (noCompression) {
        return false;
      }

      return true;
    },
  };
}
