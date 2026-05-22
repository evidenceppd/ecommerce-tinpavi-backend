import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCategoryFindMany, mockCategoryCount, mockCategoryFindUnique, mockCategoryCreate, mockCategoryUpdate, mockCategoryDelete } =
  vi.hoisted(() => ({
    mockCategoryFindMany: vi.fn(),
    mockCategoryCount: vi.fn(),
    mockCategoryFindUnique: vi.fn(),
    mockCategoryCreate: vi.fn(),
    mockCategoryUpdate: vi.fn(),
    mockCategoryDelete: vi.fn(),
  }));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    productCategory: {
      findMany: mockCategoryFindMany,
      count: mockCategoryCount,
      findUnique: mockCategoryFindUnique,
      create: mockCategoryCreate,
      update: mockCategoryUpdate,
      delete: mockCategoryDelete,
    },
  },
}));

import { CategoriesRepository } from '../categories.repository';

describe('CategoriesRepository', () => {
  let repository: CategoriesRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new CategoriesRepository();
  });

  it('findAll orders by createdAt ascending', async () => {
    mockCategoryFindMany.mockResolvedValue([{ id: 'cat-1', title: 'A' }]);

    const result = await repository.findAll();

    expect(mockCategoryFindMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } });
    expect(result).toEqual([{ id: 'cat-1', title: 'A' }]);
  });

  it('findPaginated applies search filter, pagination and returns total', async () => {
    mockCategoryFindMany.mockResolvedValue([{ id: 'cat-1', title: 'Pisos' }]);
    mockCategoryCount.mockResolvedValue(1);

    const result = await repository.findPaginated({ page: 2, limit: 10, search: 'pis' });

    expect(mockCategoryFindMany).toHaveBeenCalledWith({
      where: { title: { contains: 'pis' } },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'asc' },
    });
    expect(mockCategoryCount).toHaveBeenCalledWith({ where: { title: { contains: 'pis' } } });
    expect(result).toEqual({ items: [{ id: 'cat-1', title: 'Pisos' }], total: 1 });
  });

  it('findById, create, update and delete delegate correctly', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1' });
    mockCategoryCreate.mockResolvedValue({ id: 'cat-2', title: 'Novo' });
    mockCategoryUpdate.mockResolvedValue({ id: 'cat-1', title: 'Editado' });
    mockCategoryDelete.mockResolvedValue({ id: 'cat-1' });

    const found = await repository.findById('cat-1');
    const created = await repository.create({ title: 'Novo' });
    const updated = await repository.update('cat-1', { title: 'Editado' });
    await repository.delete('cat-1');

    expect(mockCategoryFindUnique).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
    expect(mockCategoryCreate).toHaveBeenCalledWith({ data: { title: 'Novo' } });
    expect(mockCategoryUpdate).toHaveBeenCalledWith({ where: { id: 'cat-1' }, data: { title: 'Editado' } });
    expect(mockCategoryDelete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
    expect(found).toEqual({ id: 'cat-1' });
    expect(created).toMatchObject({ id: 'cat-2' });
    expect(updated).toMatchObject({ title: 'Editado' });
  });
});
