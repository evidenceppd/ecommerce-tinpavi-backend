import { prisma } from '@/shared/infra/prisma';
import type { Coupon } from '@/generated/prisma/client';
import type { CreateCouponDto, UpdateCouponDto, ListCouponsQueryDto } from './coupons.schemas';

export class CouponsRepository {
  async create(data: CreateCouponDto): Promise<Coupon> {
    return prisma.coupon.create({
      data: {
        code: data.code,
        type: data.type,
        value: data.value,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        maxUses: data.maxUses ?? null,
        maxUsesPerCustomer: data.maxUsesPerCustomer ?? null,
        isActive: data.isActive,
      },
    });
  }

  async findById(id: string): Promise<Coupon | null> {
    return prisma.coupon.findUnique({ where: { id } });
  }

  async findByCode(code: string): Promise<Coupon | null> {
    return prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  }

  async list(query: ListCouponsQueryDto): Promise<{ items: Coupon[]; total: number }> {
    const where = query.isActive !== undefined ? { isActive: query.isActive } : {};
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coupon.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: UpdateCouponDto): Promise<Coupon> {
    return prisma.coupon.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.coupon.delete({ where: { id } });
  }

  async incrementUsedCount(id: string): Promise<void> {
    await prisma.coupon.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });
  }

  async countOrdersByCouponAndCustomer(couponId: string, customerId: string): Promise<number> {
    return prisma.order.count({ where: { couponId, customerId } });
  }
}
