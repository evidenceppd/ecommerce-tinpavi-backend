import { cache } from '@/shared/infra/memory-cache';
import { SeoRepository } from './seo.repository';
import type { CreateRedirectDto, ListRedirectsQueryDto, UpdateRedirectDto } from './seo.schemas';
import { cachePrefixes, cacheTtl, seoRedirectsKey } from '@/shared/infra/cache-keys';

const repo = new SeoRepository();

export class RedirectsService {
  async listAll() {
    return repo.findAll();
  }

  async list(query: ListRedirectsQueryDto) {
    return repo.findPaginated(query);
  }

  async create(dto: CreateRedirectDto) {
    const redirect = await repo.create(dto);
    cache.delByPrefix(cachePrefixes.seo);
    return redirect;
  }

  async update(id: string, dto: UpdateRedirectDto) {
    const existing = await repo.findById(id);
    if (!existing) throw new Error('REDIRECT_NOT_FOUND');
    const updated = await repo.update(id, dto);
    cache.delByPrefix(cachePrefixes.seo);
    return updated;
  }

  async delete(id: string) {
    const existing = await repo.findById(id);
    if (!existing) throw new Error('REDIRECT_NOT_FOUND');
    await repo.delete(id);
    cache.delByPrefix(cachePrefixes.seo);
  }

  // Used by redirect middleware — loads with in-memory cache (D-07)
  async getActiveRedirectMap(): Promise<Map<string, string>> {
    const key = seoRedirectsKey();
    const cached = cache.safeGet<Array<{ fromPath: string; toPath: string }>>(key);
    if (cached) {
      return new Map(cached.map((e) => [e.fromPath, e.toPath]));
    }
    const active = await repo.findAllActive();
    cache.safeSet(key, active, cacheTtl.seoRedirects);
    return new Map(active.map((e: { fromPath: string; toPath: string }) => [e.fromPath, e.toPath]));
  }
}
