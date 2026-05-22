import { describe, expect, it } from 'vitest';

import { MemoryCache } from '../memory-cache';

describe('MemoryCache', () => {
  it('deletes all keys matching prefix', () => {
    const memory = new MemoryCache();

    memory.set('catalog:list|page=1', { items: [] }, 60);
    memory.set('catalog:product:abc', { id: 'abc' }, 60);
    memory.set('categories:list|page=1', { items: [] }, 60);

    const removed = memory.delByPrefix('catalog:');

    expect(removed).toBe(2);
    expect(memory.get('catalog:list|page=1')).toBeNull();
    expect(memory.get('catalog:product:abc')).toBeNull();
    expect(memory.get('categories:list|page=1')).toEqual({ items: [] });
  });

  it('safeSet and safeGet return stable results', () => {
    const memory = new MemoryCache();

    expect(memory.safeSet('k1', { ok: true }, 30)).toBe(true);
    expect(memory.safeGet<{ ok: boolean }>('k1')).toEqual({ ok: true });
  });
});
