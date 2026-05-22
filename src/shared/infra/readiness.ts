import { prisma } from '@/shared/infra/prisma';

export type ReadinessCheck = {
  ready: boolean;
  checks: {
    database: 'ok' | 'error';
  };
  errors: string[];
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Readiness timeout exceeded')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function runReadinessCheck(): Promise<ReadinessCheck> {
  const timeoutMs = Number(process.env['READINESS_TIMEOUT_MS'] ?? 1500);

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs);
    return {
      ready: true,
      checks: {
        database: 'ok',
      },
      errors: [],
    };
  } catch (error) {
    return {
      ready: false,
      checks: {
        database: 'error',
      },
      errors: [error instanceof Error ? error.message : 'Unknown readiness error'],
    };
  }
}