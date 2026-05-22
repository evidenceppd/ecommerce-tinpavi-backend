import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindAll,
  mockFindPaginated,
  mockFindById,
  mockCreate,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockFindAll: vi.fn(),
  mockFindPaginated: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../categories.repository', () => ({
  CategoriesRepository: class CategoriesRepository {
    findAll = mockFindAll;
    findPaginated = mockFindPaginated;
    findById = mockFindById;
    create = mockCreate;
    update = mockUpdate;
    delete = mockDelete;
  },
}));

import { CategoriesService } from '../categories.service';
import { cache } from '@/shared/infra/memory-cache';

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache.delByPrefix('categories:');
    cache.delByPrefix('catalog:');
    service = new CategoriesService();
  });

  it('throws CATEGORY_NOT_FOUND on getById when missing', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(service.getById('cat-404')).rejects.toThrow('CATEGORY_NOT_FOUND');
  });

  it('delegates listAll and listPaginated to repository', async () => {
    mockFindAll.mockResolvedValue([{ id: 'cat-1', title: 'A' }]);
    mockFindPaginated.mockResolvedValue({ items: [{ id: 'cat-1', title: 'A' }], total: 1 });

    const all = await service.listAll();
    const paged = await service.listPaginated({ page: 1, limit: 10 } as any);

    expect(all).toEqual([{ id: 'cat-1', title: 'A' }]);
    expect(mockFindPaginated).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(paged).toEqual({ items: [{ id: 'cat-1', title: 'A' }], total: 1 });
  });

  it('reuses cache for repeated listAll calls', async () => {
    mockFindAll.mockResolvedValue([{ id: 'cat-1', title: 'A' }]);

    await service.listAll();
    await service.listAll();

    expect(mockFindAll).toHaveBeenCalledTimes(1);
  });

  it('creates category with title', async () => {
    mockCreate.mockResolvedValue({ id: 'cat-1', title: 'Skincare' });

    const result = await service.create({ title: 'Skincare' } as any);

    expect(mockCreate).toHaveBeenCalledWith({ title: 'Skincare' });
    expect(result).toMatchObject({ id: 'cat-1', title: 'Skincare' });
  });

  it('updates category after existence check', async () => {
    mockFindById.mockResolvedValue({ id: 'cat-1', title: 'Old' });
    mockUpdate.mockResolvedValue({ id: 'cat-1', title: 'New' });

    const result = await service.update('cat-1', { title: 'New' } as any);

    expect(mockUpdate).toHaveBeenCalledWith('cat-1', { title: 'New' });
    expect(result).toMatchObject({ title: 'New' });
  });

  it('deletes category after existence check', async () => {
    mockFindById.mockResolvedValue({ id: 'cat-1', title: 'A' });
    mockDelete.mockResolvedValue(undefined);

    await service.delete('cat-1');

    expect(mockDelete).toHaveBeenCalledWith('cat-1');
  });
});
