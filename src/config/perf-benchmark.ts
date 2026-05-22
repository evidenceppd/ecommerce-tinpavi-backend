const PERF_BENCHMARK_MODE_ENV = 'PERF_BENCHMARK_MODE';

export function isPerfBenchmarkMode(): boolean {
  return process.env[PERF_BENCHMARK_MODE_ENV] === 'true';
}

export function applyPerfBenchmarkEnvDefaults(): void {
  if (!isPerfBenchmarkMode()) {
    return;
  }

  process.env['PERF_DISABLE_RATE_LIMIT'] = 'true';
  process.env['APM_ENABLED'] = 'false';
  process.env['PERF_DISABLE_TIMEOUT'] = 'true';
  process.env['HTTP_COMPRESSION_THRESHOLD'] = '10mb';
  process.env['PERF_FAST_PRODUCTS_QUERY'] = 'true';
}
