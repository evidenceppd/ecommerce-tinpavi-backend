import type { ProductCategory } from '@/generated/prisma/client';
import { prisma } from '@/shared/infra/prisma';
import type { CreateCategoryDto, ListCategoriesQueryDto, UpdateCategoryDto } from './categories.schemas';

export class CategoriesRepository {
  async findAll(): Promise<ProductCategory[]> {
    return prisma.productCategory.findMany({
      where: { is_active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findPaginated(
    query: ListCategoriesQueryDto,
  ): Promise<{ items: ProductCategory[]; total: number }> {
    const skip = (query.page - 1) * query.limit;
    const where = {
      is_active: true,
      ...(query.search ? { title: { contains: query.search } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.productCategory.findMany({ where, skip, take: query.limit, orderBy: { createdAt: 'asc' } }),
      prisma.productCategory.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string): Promise<ProductCategory | null> {
    return prisma.productCategory.findUnique({ where: { id } });
  }

  async create(data: CreateCategoryDto): Promise<ProductCategory> {
    return prisma.productCategory.create({ data });
  }

  async update(id: string, data: UpdateCategoryDto): Promise<ProductCategory> {
    return prisma.productCategory.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.productCategory.update({ where: { id }, data: { is_active: false } });
  }
}

