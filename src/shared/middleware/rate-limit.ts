import rateLimit, { MemoryStore, type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

const redisUrl = process.env['REDIS_URL']?.trim();

const redisClient = redisUrl ? new Redis(redisUrl) : undefined;

if (!redisUrl) {
  console.warn('[rate-limit] REDIS_URL is not configured; using in-process MemoryStore fallback');
}

if (redisClient) {
  redisClient.on('error', (error: unknown) => {
    console.error('[rate-limit] Redis client error:', error);
  });
}

function createRateLimitStore(): Store {
  if (!redisClient) {
    return new MemoryStore();
  }

  return new RedisStore({
    sendCommand: ((...args: string[]) =>
      redisClient.call(args[0] ?? '', ...args.slice(1)) as Promise<unknown>) as (...args: string[]) => Promise<any>,
  }) as unknown as Store;
}

const windowMs = Number(process.env['RATE_LIMIT_WINDOW_MS'] ?? 900_000); // 15 min
const defaultRateLimitMessage = {
  success: false,
  data: null,
  error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
};

function toMax(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function createLimiter(max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRateLimitStore(),
    message: defaultRateLimitMessage,
  });
}

export const authRateLimiter = createLimiter(toMax(process.env['RATE_LIMIT_AUTH_MAX'], 20));

export const adminRateLimiter = createLimiter(toMax(process.env['RATE_LIMIT_ADMIN_MAX'], 600));

export const publicReadRateLimiter = createLimiter(toMax(process.env['RATE_LIMIT_PUBLIC_READ_MAX'], 1200));

export const userRateLimiter = createLimiter(
  toMax(process.env['RATE_LIMIT_USER_MAX'] ?? process.env['RATE_LIMIT_GENERAL_MAX'], 300),
);

// Backward-compatible export name used by existing imports.
export const generalRateLimiter = userRateLimiter;

