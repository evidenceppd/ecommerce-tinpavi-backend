import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindById,
  mockUpdateStatus,
  mockListByCustomer,
  mockListAdmin,
  mockValidateCoupon,
  mockAddressFindUnique,
  mockProductFindUnique,
  mockTxProductUpdateMany,
  mockTxVariantUpdateMany,
  mockTxCouponUpdate,
  mockTxCouponUpdateMany,
  mockTxAddressCreate,
  mockTxAddressUpdateMany,
  mockTxOrderCreate,
  mockPrismaTransaction,
  mockCacheGet,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockListByCustomer: vi.fn(),
  mockListAdmin: vi.fn(),
  mockValidateCoupon: vi.fn(),
  mockAddressFindUnique: vi.fn(),
  mockProductFindUnique: vi.fn(),
  mockCacheGet: vi.fn(),
  mockTxProductUpdateMany: vi.fn(),
  mockTxVariantUpdateMany: vi.fn(),
  mockTxCouponUpdate: vi.fn(),
  mockTxCouponUpdateMany: vi.fn(),
  mockTxAddressCreate: vi.fn(),
  mockTxAddressUpdateMany: vi.fn(),
  mockTxOrderCreate: vi.fn(),
  mockPrismaTransaction: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    address: { findUnique: mockAddressFindUnique },
    product: { findUnique: mockProductFindUnique },
    $transaction: mockPrismaTransaction,
  },
}));

vi.mock('@/shared/infra/memory-cache', () => ({
  cache: {
    get: mockCacheGet,
    set: vi.fn(),
    del: vi.fn(),
    delByPrefix: vi.fn(),
    setNX: vi.fn(),
  },
}));

vi.mock('../orders.repository', () => ({
  OrdersRepository: class OrdersRepository {
    findById = mockFindById;
    updateStatus = mockUpdateStatus;
    listByCustomer = mockListByCustomer;
    listAdmin = mockListAdmin;
  },
}));

vi.mock('../coupons.service', () => ({
  CouponsService: class CouponsService {
    validateCoupon = mockValidateCoupon;
  },
}));

import { OrdersService } from '../orders.service';

function makeCheckoutDto(overrides: Record<string, unknown> = {}) {
  return {
    shippingAddressId: 'addr-1',
    quoteId: 'quote-1',
    items: [{ productId: 'prod-1', quantity: 2 }],
    ...overrides,
  };
}

describe('OrdersService.checkout', () => {
  let service: OrdersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrdersService();

    mockAddressFindUnique.mockResolvedValue({
      id: 'addr-1',
      customerId: 'cust-1',
      street: 'Rua A',
      number: '10',
      complement: null,
      district: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01001000',
      country: 'BR',
    });

    mockCacheGet.mockReturnValue({
      customerId: 'cust-1',
      shippingAddressId: 'addr-1',
      shippingAddress: {
        zipCode: '01001000',
        street: 'Rua A',
        number: '10',
        district: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
        country: 'BR',
      },
      price: 20,
      carrier: 'Carrier X',
      service: 'Express',
      estimatedDays: 2,
    });

    mockProductFindUnique.mockResolvedValue({
      id: 'prod-1',
      pricing: 100,
      quantity_stock: 10,
    });

    mockTxProductUpdateMany.mockResolvedValue({ count: 1 });
    mockTxVariantUpdateMany.mockResolvedValue({ count: 1 });
    mockTxCouponUpdate.mockResolvedValue({ id: 'coupon-1' });
    mockTxCouponUpdateMany.mockResolvedValue({ count: 1 });
    mockTxAddressCreate.mockResolvedValue({ id: 'addr-new' });
    mockTxAddressUpdateMany.mockResolvedValue({ count: 1 });
    mockTxOrderCreate.mockResolvedValue({ id: 'ord-1', items: [{ id: 'item-1' }] });

    mockPrismaTransaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        product: { updateMany: mockTxProductUpdateMany },
        productVariant: { updateMany: mockTxVariantUpdateMany },
        address: { create: mockTxAddressCreate, updateMany: mockTxAddressUpdateMany },
        coupon: { update: mockTxCouponUpdate, updateMany: mockTxCouponUpdateMany },
        order: { create: mockTxOrderCreate },
      }),
    );
  });

  it('throws ADDRESS_NOT_FOUND when address is missing', async () => {
    mockAddressFindUnique.mockResolvedValue(null);
    await expect(service.checkout(makeCheckoutDto(), 'cust-1')).rejects.toThrow('ADDRESS_NOT_FOUND');
  });

  it('throws SHIPPING_QUOTE_INVALID when quote snapshot is missing', async () => {
    mockCacheGet.mockReturnValue(null);
    await expect(service.checkout(makeCheckoutDto(), 'cust-1')).rejects.toThrow('SHIPPING_QUOTE_INVALID');
  });

  it('throws SHIPPING_QUOTE_INVALID when quote snapshot is malformed json', async () => {
    // With memory-cache, values are stored as objects — simulate null (miss) for invalid
    mockCacheGet.mockReturnValue(null);
    await expect(service.checkout(makeCheckoutDto(), 'cust-1')).rejects.toThrow('SHIPPING_QUOTE_INVALID');
  });

  it('throws SHIPPING_QUOTE_INVALID when quote owner does not match checkout customer', async () => {
    mockCacheGet.mockReturnValue({
      customerId: 'other-customer',
      shippingAddressId: 'addr-1',
      price: 20,
      carrier: 'Carrier X',
      service: 'Express',
      estimatedDays: 2,
    });

    await expect(service.checkout(makeCheckoutDto(), 'cust-1')).rejects.toThrow('SHIPPING_QUOTE_INVALID');
  });

  it('throws PRODUCT_NOT_FOUND when checkout item product does not exist', async () => {
    mockProductFindUnique.mockResolvedValue(null);
    await expect(service.checkout(makeCheckoutDto(), 'cust-1')).rejects.toThrow('PRODUCT_NOT_FOUND');
  });

  it('ignores variantId in payload and still checks product stock', async () => {
    await service.checkout(
      makeCheckoutDto({ items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 1 }] }),
      'cust-1',
    );

    expect(mockProductFindUnique).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      select: { id: true, pricing: true, quantity_stock: true, variants: true },
    });
  });

  it('throws INSUFFICIENT_STOCK when guarded product decrement fails', async () => {
    mockTxProductUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.checkout(makeCheckoutDto(), 'cust-1')).rejects.toThrow('INSUFFICIENT_STOCK');
  });

  it('throws COUPON_MAX_USES_REACHED when guarded coupon increment fails', async () => {
    mockValidateCoupon.mockResolvedValue({
      id: 'coupon-1',
      code: 'SAVE10',
      type: 'PERCENTAGE',
      value: 10,
      maxUses: 1,
    });
    mockTxCouponUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.checkout(makeCheckoutDto({ couponCode: 'SAVE10' }), 'cust-1'),
    ).rejects.toThrow('COUPON_MAX_USES_REACHED');
  });

  it('throws COUPON_EXCEEDS_ORDER_TOTAL when discount equals or exceeds base amount', async () => {
    mockValidateCoupon.mockResolvedValue({
      id: 'coupon-1',
      code: 'FREE100',
      type: 'FIXED',
      value: 220,
      maxUses: null,
    });

    await expect(
      service.checkout(makeCheckoutDto({ couponCode: 'FREE100' }), 'cust-1'),
    ).rejects.toThrow('COUPON_EXCEEDS_ORDER_TOTAL');
  });

  it('creates order successfully and decrements stock without coupon', async () => {
    const result = await service.checkout(makeCheckoutDto(), 'cust-1');
    expect(result).toEqual({ id: 'ord-1', items: [{ id: 'item-1' }] });
    expect(mockTxProductUpdateMany).toHaveBeenCalled();
    expect(mockTxOrderCreate).toHaveBeenCalled();
    expect(mockTxCouponUpdate).not.toHaveBeenCalled();

    expect(mockTxOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust-1',
          subtotal: 200,
          shippingCost: 20,
          discountAmount: 0,
          totalAmount: 220,
          couponId: null,
          couponCode: null,
          shippingStreet: 'Rua A',
          shippingNumber: '10',
          shippingComplement: null,
          shippingNeighborhood: 'Centro',
          shippingCity: 'Sao Paulo',
          shippingState: 'SP',
          shippingZipCode: '01001000',
          shippingAddressRef: 'addr-1',
          items: {
            create: [
              expect.objectContaining({
                productId: 'prod-1',
                variantId: null,
                quantity: 2,
                unitPrice: 100,
                totalPrice: 200,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('increments coupon usage via guarded updateMany when coupon has maxUses', async () => {
    mockValidateCoupon.mockResolvedValue({
      id: 'coupon-1',
      code: 'SAVE10',
      type: 'PERCENTAGE',
      value: 10,
      maxUses: 100,
    });

    await service.checkout(makeCheckoutDto({ couponCode: 'SAVE10' }), 'cust-1');
    expect(mockTxCouponUpdateMany).toHaveBeenCalled();
    expect(mockTxCouponUpdate).not.toHaveBeenCalled();
  });

  it('creates order with inline shipping address without persisting customer address', async () => {
    mockCacheGet.mockReturnValue({
      customerId: 'cust-1',
      shippingAddressId: null,
      shippingAddress: {
        zipCode: '01310100',
        street: 'Av Paulista',
        number: '1000',
        district: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
        country: 'BR',
      },
      price: 20,
      carrier: 'Carrier X',
      service: 'Express',
      estimatedDays: 2,
    });

    await service.checkout(
      makeCheckoutDto({
        shippingAddressId: undefined,
        shippingAddress: {
          zipCode: '01310100',
          street: 'Av Paulista',
          number: '1000',
          district: 'Bela Vista',
          city: 'Sao Paulo',
          state: 'SP',
          country: 'BR',
        },
        saveAddress: false,
      }),
      'cust-1',
    );

    expect(mockTxAddressCreate).not.toHaveBeenCalled();
    expect(mockTxOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingStreet: 'Av Paulista',
          shippingAddressRef: null,
        }),
      }),
    );
  });

  it('persists inline shipping address when saveAddress is true', async () => {
    mockCacheGet.mockReturnValue({
      customerId: 'cust-1',
      shippingAddressId: null,
      shippingAddress: {
        zipCode: '01310100',
        street: 'Av Paulista',
        number: '1000',
        district: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
        country: 'BR',
      },
      price: 20,
      carrier: 'Carrier X',
      service: 'Express',
      estimatedDays: 2,
    });

    await service.checkout(
      makeCheckoutDto({
        shippingAddressId: undefined,
        shippingAddress: {
          zipCode: '01310100',
          street: 'Av Paulista',
          number: '1000',
          district: 'Bela Vista',
          city: 'Sao Paulo',
          state: 'SP',
          country: 'BR',
        },
        saveAddress: true,
        setAsDefaultAddress: true,
      }),
      'cust-1',
    );

    expect(mockTxAddressUpdateMany).toHaveBeenCalled();
    expect(mockTxAddressCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust-1',
          zipCode: '01310100',
          isDefault: true,
        }),
      }),
    );
    expect(mockTxOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingAddressRef: 'addr-new',
        }),
      }),
    );
  });

  it('rejects checkout when inline shipping address does not match quote snapshot', async () => {
    mockCacheGet.mockReturnValue({
      customerId: 'cust-1',
      shippingAddressId: null,
      shippingAddress: {
        zipCode: '01310100',
        street: 'Rua Diferente',
        number: '1000',
        district: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
        country: 'BR',
      },
      price: 20,
      carrier: 'Carrier X',
      service: 'Express',
      estimatedDays: 2,
    });

    await expect(
      service.checkout(
        makeCheckoutDto({
          shippingAddressId: undefined,
          shippingAddress: {
            zipCode: '01310100',
            street: 'Av Paulista',
            number: '1000',
            district: 'Bela Vista',
            city: 'Sao Paulo',
            state: 'SP',
            country: 'BR',
          },
        }),
        'cust-1',
      ),
    ).rejects.toThrow('SHIPPING_QUOTE_INVALID');
  });
});

describe('OrdersService lifecycle and queries', () => {
  let service: OrdersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrdersService();
  });

  it('throws ORDER_NOT_FOUND in admin status update when order does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(
      service.updateStatusAsAdmin('ord-404', { status: 'PAID' }, 'admin-1'),
    ).rejects.toThrow('ORDER_NOT_FOUND');
  });

  it('blocks customer cancellation when status is not PENDING_PAYMENT', async () => {
    mockFindById.mockResolvedValue({ id: 'ord-1', customerId: 'cust-1', status: 'PAID' });
    await expect(service.cancelAsCustomer('ord-1', 'cust-1')).rejects.toThrow('ORDER_CANCEL_NOT_ALLOWED');
  });

  it('blocks customer cancellation for order owned by another customer', async () => {
    mockFindById.mockResolvedValue({ id: 'ord-1', customerId: 'other-customer', status: 'PENDING_PAYMENT' });
    await expect(service.cancelAsCustomer('ord-1', 'cust-1')).rejects.toThrow('ORDER_NOT_FOUND');
  });

  it('returns order for customer when ownership matches', async () => {
    mockFindById.mockResolvedValue({ id: 'ord-1', customerId: 'cust-1', items: [] });
    const result = await service.getOrderAsCustomer('ord-1', 'cust-1');
    expect(result).toMatchObject({ id: 'ord-1' });
  });

  it('throws ORDER_NOT_FOUND when customer requests order owned by someone else', async () => {
    mockFindById.mockResolvedValue({ id: 'ord-1', customerId: 'other-customer' });
    await expect(service.getOrderAsCustomer('ord-1', 'cust-1')).rejects.toThrow('ORDER_NOT_FOUND');
  });

  it('returns paginated customer list metadata unchanged', async () => {
    mockListByCustomer.mockResolvedValue({ items: [{ id: 'ord-1' }], total: 1 });
    const result = await service.listMyOrders('cust-1', { page: 1, limit: 5 });
    expect(result).toEqual({ items: [{ id: 'ord-1' }], total: 1, page: 1, limit: 5 });
  });

  it('returns paginated admin list metadata unchanged', async () => {
    mockListAdmin.mockResolvedValue({ items: [{ id: 'ord-1' }], total: 1 });
    const result = await service.listAdminOrders({ page: 2, limit: 10 } as Parameters<typeof service.listAdminOrders>[0]);
    expect(result).toEqual({ items: [{ id: 'ord-1' }], total: 1, page: 2, limit: 10 });
  });
});
