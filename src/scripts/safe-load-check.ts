import 'dotenv/config';

const host = '127.0.0.1';
const port = Number(process.env['LOAD_CHECK_PORT'] ?? 3010);
const requests = Number(process.env['LOAD_CHECK_REQUESTS'] ?? 120);

// Apply a stricter local profile when variables are not explicitly provided.
if (!process.env['RATE_LIMIT_WINDOW_MS']) process.env['RATE_LIMIT_WINDOW_MS'] = '60000';
if (!process.env['RATE_LIMIT_GENERAL_MAX']) process.env['RATE_LIMIT_GENERAL_MAX'] = '30';

type StatusCounters = Record<string, number>;

function countStatus(counter: StatusCounters, status: number): void {
  const key = String(status);
  counter[key] = (counter[key] ?? 0) + 1;
}

async function main(): Promise<void> {
  const { app } = await import('@/app');
  const server = app.listen(port, host);

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', (err) => reject(err));
  });

  const counters: StatusCounters = {};
  const url = `http://${host}:${port}/health`;

  try {
    await Promise.all(
      Array.from({ length: requests }, async () => {
        try {
          const response = await fetch(url, { method: 'GET' });
          countStatus(counters, response.status);
        } catch {
          countStatus(counters, 0);
        }
      }),
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  console.log(
    JSON.stringify(
      {
        requests,
        rateLimitWindowMs: process.env['RATE_LIMIT_WINDOW_MS'] ?? null,
        rateLimitGeneralMax: process.env['RATE_LIMIT_GENERAL_MAX'] ?? null,
        result: counters,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('safe-load-check failed', err);
  process.exitCode = 1;
});
