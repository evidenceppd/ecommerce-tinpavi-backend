import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRedirectFindMany, mockRedirectCount, mockRedirectFindUnique, mockRedirectCreate, mockRedirectUpdate, mockRedirectDelete } =
  vi.hoisted(() => ({
    mockRedirectFindMany: vi.fn(),
    mockRedirectCount: vi.fn(),
    mockRedirectFindUnique: vi.fn(),
    mockRedirectCreate: vi.fn(),
    mockRedirectUpdate: vi.fn(),
    mockRedirectDelete: vi.fn(),
  }));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    redirect: {
      findMany: mockRedirectFindMany,
      count: mockRedirectCount,
      findUnique: mockRedirectFindUnique,
      create: mockRedirectCreate,
      update: mockRedirectUpdate,
      delete: mockRedirectDelete,
    },
  },
}));

import { SeoRepository } from '../seo.repository';

describe('SeoRepository', () => {
  let repository: SeoRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SeoRepository();
  });

  it('findAll orders by createdAt desc', async () => {
    mockRedirectFindMany.mockResolvedValue([{ id: 'r-1' }]);

    const result = await repository.findAll();

    expect(mockRedirectFindMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(result).toEqual([{ id: 'r-1' }]);
  });

  it('findPaginated applies skip/take and returns total', async () => {
    mockRedirectFindMany.mockResolvedValue([{ id: 'r-1', fromPath: '/a', toPath: '/b' }]);
    mockRedirectCount.mockResolvedValue(1);

    const result = await repository.findPaginated({ page: 3, limit: 5 });

    expect(mockRedirectFindMany).toHaveBeenCalledWith({ skip: 10, take: 5, orderBy: { fromPath: 'asc' } });
    expect(mockRedirectCount).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [{ id: 'r-1', fromPath: '/a', toPath: '/b' }], total: 1 });
  });

  it('findById/create/update/delete delegate correctly', async () => {
    mockRedirectFindUnique.mockResolvedValue({ id: 'r-1' });
    mockRedirectCreate.mockResolvedValue({ id: 'r-2' });
    mockRedirectUpdate.mockResolvedValue({ id: 'r-1', toPath: '/new' });
    mockRedirectDelete.mockResolvedValue({ id: 'r-1' });

    const found = await repository.findById('r-1');
    const created = await repository.create({ fromPath: '/old', toPath: '/new', isActive: true });
    const updated = await repository.update('r-1', { toPath: '/new' });
    await repository.delete('r-1');

    expect(mockRedirectFindUnique).toHaveBeenCalledWith({ where: { id: 'r-1' } });
    expect(mockRedirectCreate).toHaveBeenCalledWith({ data: { fromPath: '/old', toPath: '/new', isActive: true } });
    expect(mockRedirectUpdate).toHaveBeenCalledWith({ where: { id: 'r-1' }, data: { toPath: '/new' } });
    expect(mockRedirectDelete).toHaveBeenCalledWith({ where: { id: 'r-1' } });
    expect(found).toMatchObject({ id: 'r-1' });
    expect(created).toMatchObject({ id: 'r-2' });
    expect(updated).toMatchObject({ toPath: '/new' });
  });

  it('findAllActive selects only fromPath and toPath with isActive filter', async () => {
    mockRedirectFindMany.mockResolvedValue([{ fromPath: '/a', toPath: '/b' }]);

    const result = await repository.findAllActive();

    expect(mockRedirectFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { fromPath: true, toPath: true },
    });
    expect(result).toEqual([{ fromPath: '/a', toPath: '/b' }]);
  });
});
