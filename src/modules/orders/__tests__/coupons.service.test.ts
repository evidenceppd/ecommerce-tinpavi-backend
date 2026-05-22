import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/infra/prisma', () => ({ prisma: {} }));
vi.mock('../coupons.repository');

import { CouponsService } from '../coupons.service';
import { CouponsRepository } from '../coupons.repository';

const mockFindByCode = vi.mocked(CouponsRepository.prototype.findByCode);
const mockCountOrders = vi.mocked(CouponsRepository.prototype.countOrdersByCouponAndCustomer);
const mockCreate = vi.mocked(CouponsRepository.prototype.create);
const mockFindById = vi.mocked(CouponsRepository.prototype.findById);
const mockDelete = vi.mocked(CouponsRepository.prototype.delete);
const mockUpdate = vi.mocked(CouponsRepository.prototype.update);

function makeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    code: 'SAVE10',
    isActive: true,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2027-01-01'),
    maxUses: null as number | null,
    usedCount: 0,
    maxUsesPerCustomer: null as number | null,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CouponsService.validateCoupon', () => {
  let service: CouponsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CouponsService();
  });

  it('throws COUPON_NOT_FOUND when coupon does not exist', async () => {
    mockFindByCode.mockResolvedValue(null);
    await expect(service.validateCoupon('INVALID', 'customer-1')).rejects.toThrow('COUPON_NOT_FOUND');
  });

  it('throws COUPON_INACTIVE when coupon is disabled', async () => {
    mockFindByCode.mockResolvedValue(makeCoupon({ isActive: false }) as never);
    await expect(service.validateCoupon('SAVE10', 'customer-1')).rejects.toThrow('COUPON_INACTIVE');
  });

  it('throws COUPON_NOT_YET_VALID when coupon starts in the future', async () => {
    mockFindByCode.mockResolvedValue(
      makeCoupon({ validFrom: new Date('2030-01-01'), validUntil: new Date('2031-01-01') }) as never,
    );
    await expect(service.validateCoupon('SAVE10', 'customer-1')).rejects.toThrow('COUPON_NOT_YET_VALID');
  });

  it('throws COUPON_EXPIRED when coupon validity has passed', async () => {
    mockFindByCode.mockResolvedValue(
      makeCoupon({ validFrom: new Date('2020-01-01'), validUntil: new Date('2021-01-01') }) as never,
    );
    await expect(service.validateCoupon('SAVE10', 'customer-1')).rejects.toThrow('COUPON_EXPIRED');
  });

  it('throws COUPON_MAX_USES_REACHED when global usage limit is hit', async () => {
    mockFindByCode.mockResolvedValue(makeCoupon({ maxUses: 100, usedCount: 100 }) as never);
    await expect(service.validateCoupon('SAVE10', 'customer-1')).rejects.toThrow('COUPON_MAX_USES_REACHED');
  });

  it('allows coupon when usedCount is still below maxUses boundary', async () => {
    const coupon = makeCoupon({ maxUses: 100, usedCount: 99, maxUsesPerCustomer: null });
    mockFindByCode.mockResolvedValue(coupon as never);

    const result = await service.validateCoupon('SAVE10', 'customer-1');

    expect(result).toEqual(coupon);
  });

  it('throws COUPON_MAX_USES_PER_CUSTOMER_REACHED when customer limit is hit', async () => {
    mockFindByCode.mockResolvedValue(makeCoupon({ maxUsesPerCustomer: 1 }) as never);
    mockCountOrders.mockResolvedValue(1);
    await expect(service.validateCoupon('SAVE10', 'customer-1')).rejects.toThrow(
      'COUPON_MAX_USES_PER_CUSTOMER_REACHED',
    );
  });

  it('allows coupon when customer usage is below maxUsesPerCustomer', async () => {
    const coupon = makeCoupon({ maxUsesPerCustomer: 3 });
    mockFindByCode.mockResolvedValue(coupon as never);
    mockCountOrders.mockResolvedValue(2);

    const result = await service.validateCoupon('SAVE10', 'customer-1');

    expect(result).toEqual(coupon);
    expect(mockCountOrders).toHaveBeenCalledWith('coupon-1', 'customer-1');
  });

  it('returns the coupon when all validations pass', async () => {
    const coupon = makeCoupon({ maxUsesPerCustomer: 3 });
    mockFindByCode.mockResolvedValue(coupon as never);
    mockCountOrders.mockResolvedValue(1);
    const result = await service.validateCoupon('SAVE10', 'customer-1');
    expect(result).toEqual(coupon);
  });

  it('does not check per-customer usage when maxUsesPerCustomer is null', async () => {
    const coupon = makeCoupon({ maxUsesPerCustomer: null });
    mockFindByCode.mockResolvedValue(coupon as never);
    const result = await service.validateCoupon('SAVE10', 'customer-1');
    expect(result).toEqual(coupon);
    expect(mockCountOrders).not.toHaveBeenCalled();
  });
});

describe('CouponsService.create', () => {
  let service: CouponsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CouponsService();
  });

  it('throws COUPON_CODE_CONFLICT when code already exists', async () => {
    mockFindByCode.mockResolvedValue(makeCoupon() as never);
    await expect(
      service.create({ code: 'SAVE10' } as Parameters<typeof service.create>[0]),
    ).rejects.toThrow('COUPON_CODE_CONFLICT');
  });

  it('creates and returns the coupon when code is unique', async () => {
    const newCoupon = makeCoupon({ code: 'NEW20' });
    mockFindByCode.mockResolvedValue(null);
    mockCreate.mockResolvedValue(newCoupon as never);
    const result = await service.create({ code: 'NEW20' } as Parameters<typeof service.create>[0]);
    expect(result).toEqual(newCoupon);
  });
});

describe('CouponsService.getById', () => {
  let service: CouponsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CouponsService();
  });

  it('throws COUPON_NOT_FOUND when coupon does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(service.getById('missing-id')).rejects.toThrow('COUPON_NOT_FOUND');
  });

  it('returns the coupon when it exists', async () => {
    const coupon = makeCoupon();
    mockFindById.mockResolvedValue(coupon as never);
    const result = await service.getById('coupon-1');
    expect(result).toEqual(coupon);
  });
});

describe('CouponsService.delete', () => {
  let service: CouponsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CouponsService();
  });

  it('throws COUPON_NOT_FOUND when coupon does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(service.delete('missing-id')).rejects.toThrow('COUPON_NOT_FOUND');
  });

  it('deletes the coupon when it exists', async () => {
    mockFindById.mockResolvedValue(makeCoupon() as never);
    mockDelete.mockResolvedValue(undefined);
    await expect(service.delete('coupon-1')).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith('coupon-1');
  });
});

describe('CouponsService.update', () => {
  let service: CouponsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CouponsService();
  });

  it('throws COUPON_NOT_FOUND when coupon does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(
      service.update('missing-id', {} as Parameters<typeof service.update>[1]),
    ).rejects.toThrow('COUPON_NOT_FOUND');
  });

  it('throws COUPON_CODE_CONFLICT when new code belongs to another coupon', async () => {
    mockFindById.mockResolvedValue(makeCoupon() as never);
    mockFindByCode.mockResolvedValue(makeCoupon({ id: 'other-coupon' }) as never);
    await expect(
      service.update('coupon-1', { code: 'EXISTING' } as Parameters<typeof service.update>[1]),
    ).rejects.toThrow('COUPON_CODE_CONFLICT');
  });

  it('updates successfully when code belongs to the same coupon', async () => {
    const coupon = makeCoupon();
    const updated = makeCoupon({ code: 'SAVE10', discountValue: 20 });
    mockFindById.mockResolvedValue(coupon as never);
    mockFindByCode.mockResolvedValue(coupon as never);
    mockUpdate.mockResolvedValue(updated as never);
    const result = await service.update(
      'coupon-1',
      { code: 'SAVE10' } as Parameters<typeof service.update>[1],
    );
    expect(result).toEqual(updated);
  });
});
