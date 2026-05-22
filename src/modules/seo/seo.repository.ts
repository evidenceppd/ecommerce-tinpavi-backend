import { prisma } from '@/shared/infra/prisma';
import type { CreateRedirectDto, ListRedirectsQueryDto, UpdateRedirectDto } from './seo.schemas';

export class SeoRepository {
  findAll() {
    return prisma.redirect.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findPaginated(query: ListRedirectsQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      prisma.redirect.findMany({ skip, take: query.limit, orderBy: { fromPath: 'asc' } }),
      prisma.redirect.count(),
    ]);
    return { items, total };
  }

  findById(id: string) {
    return prisma.redirect.findUnique({ where: { id } });
  }

  create(data: CreateRedirectDto) {
    return prisma.redirect.create({ data });
  }

  update(id: string, data: UpdateRedirectDto) {
    return prisma.redirect.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.redirect.delete({ where: { id } });
  }

  findAllActive() {
    return prisma.redirect.findMany({
      where: { isActive: true },
      select: { fromPath: true, toPath: true },
    });
  }
}
