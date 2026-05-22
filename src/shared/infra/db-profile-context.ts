import { AsyncLocalStorage } from 'node:async_hooks';

export type DbProfileContext = {
  requestId: string;
  endpointTag: string;
  startedAtMs: number;
  queryCount: number;
};

const dbProfileStorage = new AsyncLocalStorage<DbProfileContext>();

export function runWithDbProfileContext(
  context: Omit<DbProfileContext, 'queryCount'>,
  callback: () => void,
): void {
  dbProfileStorage.run({ ...context, queryCount: 0 }, callback);
}

export function getDbProfileContext(): DbProfileContext | undefined {
  return dbProfileStorage.getStore();
}

export function incrementDbQueryCount(): number {
  const context = dbProfileStorage.getStore();
  if (!context) {
    return 0;
  }

  context.queryCount += 1;
  return context.queryCount;
}
