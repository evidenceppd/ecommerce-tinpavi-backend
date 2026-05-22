interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  del(key: string): void {
    this.store.delete(key);
  }

  delByPrefix(prefix: string): number {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  safeGet<T>(key: string): T | null {
    try {
      return this.get<T>(key);
    } catch {
      return null;
    }
  }

  safeSet<T>(key: string, value: T, ttlSeconds: number): boolean {
    try {
      this.set(key, value, ttlSeconds);
      return true;
    } catch {
      return false;
    }
  }

  /** Atomic set-if-not-exists. Returns true if the key was set, false if it already existed. */
  setNX<T>(key: string, value: T, ttlSeconds: number): boolean {
    if (this.get(key) !== null) return false;
    this.set(key, value, ttlSeconds);
    return true;
  }
}

export const cache = new MemoryCache();
