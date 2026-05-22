import "dotenv/config";

import { app } from "./app";
import { prisma } from '@/shared/infra/prisma';

const port = Number(process.env.PORT ?? 3000);
const requestTimeoutMs = Number(process.env['HTTP_REQUEST_TIMEOUT_MS'] ?? 30_000);
const headersTimeoutMs = Number(process.env['HTTP_HEADERS_TIMEOUT_MS'] ?? 10_000);
const keepAliveTimeoutMs = Number(process.env['HTTP_KEEP_ALIVE_TIMEOUT_MS'] ?? 5_000);

const server = app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
});

server.requestTimeout = requestTimeoutMs;
server.headersTimeout = headersTimeoutMs;
server.keepAliveTimeout = keepAliveTimeoutMs;

let shuttingDown = false;

async function gracefulShutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.info(`[shutdown] Received ${signal}; draining connections...`);

  const forceTimeoutMs = Number(process.env['SHUTDOWN_FORCE_TIMEOUT_MS'] ?? 15000);
  const forceTimer = setTimeout(() => {
    console.error('[shutdown] Force shutdown timeout reached');
    process.exit(1);
  }, forceTimeoutMs);

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await prisma.$disconnect();
    clearTimeout(forceTimer);
    console.info('[shutdown] Shutdown completed gracefully');
    process.exit(0);
  } catch (error) {
    clearTimeout(forceTimer);
    console.error('[shutdown] Graceful shutdown failed', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});
