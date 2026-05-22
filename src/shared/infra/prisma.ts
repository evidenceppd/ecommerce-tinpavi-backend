import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@/generated/prisma/client';
import { createHash } from 'node:crypto';

import { getDbProfileContext, incrementDbQueryCount } from './db-profile-context';

/** Parse and validate DB pool environment variables, failing fast on bad values. */
function resolvePoolConfig(): { poolMax: number; idleTimeoutMs: number; acquireTimeoutMs: number } {
  const poolMax = Number(process.env['DB_POOL_MAX'] ?? '5');
  const idleTimeoutMs = Number(process.env['DB_POOL_IDLE_TIMEOUT_MS'] ?? '10000');
  const acquireTimeoutMs = Number(process.env['DB_POOL_ACQUIRE_TIMEOUT_MS'] ?? '5000');

  if (!Number.isInteger(poolMax) || poolMax <= 0) {
    throw new Error(`DB_POOL_MAX must be a positive integer, got: ${process.env['DB_POOL_MAX']}`);
  }
  if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs < 1000) {
    throw new Error(
      `DB_POOL_IDLE_TIMEOUT_MS must be >= 1000ms, got: ${process.env['DB_POOL_IDLE_TIMEOUT_MS']}`,
    );
  }
  if (!Number.isFinite(acquireTimeoutMs) || acquireTimeoutMs < 500) {
    throw new Error(
      `DB_POOL_ACQUIRE_TIMEOUT_MS must be >= 500ms, got: ${process.env['DB_POOL_ACQUIRE_TIMEOUT_MS']}`,
    );
  }
  return { poolMax, idleTimeoutMs, acquireTimeoutMs };
}

function createPrismaClient(): PrismaClient {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const dbProfileEnabled = process.env['DB_PROFILE'] === 'true';
  const slowQueryThresholdMs = Number(process.env['DB_SLOW_QUERY_MS'] ?? '100');
  const pool = resolvePoolConfig();

  // Parse mysql://user:pass@host:port/dbname
  const parsed = new URL(url);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: Number(parsed.port) || 3306,
    user: parsed.username || 'root',
    password: parsed.password || '',
    database: parsed.pathname.replace(/^\//, ''),
    connectionLimit: pool.poolMax,
    idleTimeout: pool.idleTimeoutMs,
    acquireTimeout: pool.acquireTimeoutMs,
  });

  const prisma = new PrismaClient({
    adapter,
    ...(dbProfileEnabled ? { log: [{ level: 'query' as const, emit: 'event' as const }] } : {}),
  });

  if (dbProfileEnabled) {
    const prismaWithQueryEvents = prisma as PrismaClient & {
      $on: (
        eventType: 'query',
        callback: (event: { query: string; duration: number }) => void,
      ) => void;
    };

    prismaWithQueryEvents.$on('query', (event) => {
      const context = getDbProfileContext();
      const queryHash = createHash('sha256').update(event.query).digest('hex').slice(0, 12);
      const endpointTag = context?.endpointTag ?? 'background';
      const requestId = context?.requestId;
      const queryCount = incrementDbQueryCount();

      const payload = {
        type: event.duration >= slowQueryThresholdMs ? 'db_slow_query' : 'db_query',
        endpointTag,
        requestId,
        durationMs: event.duration,
        queryHash,
        queryCount,
      };

      console.info(JSON.stringify(payload));
    });
  }

  return prisma;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? (globalForPrisma.prisma = createPrismaClient());

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
