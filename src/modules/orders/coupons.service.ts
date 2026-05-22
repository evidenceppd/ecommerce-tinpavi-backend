import type { Coupon } from '@/generated/prisma/client';
import type { CreateCouponDto, UpdateCouponDto, ListCouponsQueryDto } from './coupons.schemas';
import { CouponsRepository } from './coupons.repository';

const repo = new CouponsRepository();

export class CouponsService {
  // ---- Admin CRUD ----

  async create(dto: CreateCouponDto): Promise<Coupon> {
    const existing = await repo.findByCode(dto.code);
    if (existing) throw new Error('COUPON_CODE_CONFLICT');
    return repo.create(dto);
  }

  async list(
    query: ListCouponsQueryDto,
  ): Promise<{ items: Coupon[]; total: number; page: number; limit: number }> {
    const { items, total } = await repo.list(query);
    return { items, total, page: query.page, limit: query.limit };
  }

  async getById(id: string): Promise<Coupon> {
    const coupon = await repo.findById(id);
    if (!coupon) throw new Error('COUPON_NOT_FOUND');
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    await this.getById(id);
    if (dto.code) {
      const conflict = await repo.findByCode(dto.code);
      if (conflict && conflict.id !== id) throw new Error('COUPON_CODE_CONFLICT');
    }
    return repo.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await repo.delete(id);
  }

  // ---- Checkout validation ----

  /**
   * Validates coupon by code for a given customer.
   * Returns the Coupon record if valid.
   * Throws string-coded errors if invalid.
   */
  async validateCoupon(code: string, customerId: string): Promise<Coupon> {
    const coupon = await repo.findByCode(code);
    if (!coupon) throw new Error('COUPON_NOT_FOUND');
    if (!coupon.isActive) throw new Error('COUPON_INACTIVE');

    const now = new Date();
    if (now < coupon.validFrom) throw new Error('COUPON_NOT_YET_VALID');
    if (now > coupon.validUntil) throw new Error('COUPON_EXPIRED');

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new Error('COUPON_MAX_USES_REACHED');
    }

    if (coupon.maxUsesPerCustomer !== null) {
      const customerUses = await repo.countOrdersByCouponAndCustomer(coupon.id, customerId);
      if (customerUses >= coupon.maxUsesPerCustomer) {
        throw new Error('COUPON_MAX_USES_PER_CUSTOMER_REACHED');
      }
    }

    return coupon;
  }
}
