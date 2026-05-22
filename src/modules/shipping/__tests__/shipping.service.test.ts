import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAddressFindUnique,
  mockProductFindUnique,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockAddressFindUnique: vi.fn(),
  mockProductFindUnique: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    address: { findUnique: mockAddressFindUnique },
    product: { findUnique: mockProductFindUnique },
  },
}));

vi.mock('@/shared/infra/memory-cache', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
    del: vi.fn(),
  },
}));

import { ShippingService } from '../shipping.service';

function makeDto(overrides: Record<string, unknown> = {}) {
  return {
    shippingAddressId: 'addr-1',
    items: [{ productId: 'prod-1', quantity: 1 }],
    ...overrides,
  };
}

describe('ShippingService.quoteForCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAddressFindUnique.mockResolvedValue({
      id: 'addr-1',
      customerId: 'cust-1',
      zipCode: '01001-000',
      street: 'Rua A',
      number: '10',
      complement: null,
      district: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      country: 'BR',
    });
    mockProductFindUnique.mockResolvedValue({ id: 'prod-1', title: 'Produto A' });
    mockCacheGet.mockReturnValue(null);
    mockCacheSet.mockReturnValue(undefined);
  });

  it('throws SHIPPING_ADDRESS_NOT_FOUND when address is missing', async () => {
    const service = new ShippingService({ name: 'provider', quote: vi.fn() });
    mockAddressFindUnique.mockResolvedValue(null);

    await expect(service.quoteForCustomer(makeDto() as any, 'cust-1')).rejects.toMatchObject({
      code: 'SHIPPING_ADDRESS_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('throws PRODUCT_NOT_FOUND when product does not exist', async () => {
    const service = new ShippingService({ name: 'provider', quote: vi.fn() });
    mockProductFindUnique.mockResolvedValue(null);

    await expect(service.quoteForCustomer(makeDto() as any, 'cust-1')).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('accepts variantId in payload but quotes by product data only', async () => {
    const provider = {
      name: 'provider',
      quote: vi.fn().mockResolvedValue([{ carrier: 'C', service: 'S', price: 10, estimatedDays: 2 }]),
    };
    const service = new ShippingService(provider);

    const result = await service.quoteForCustomer(
      makeDto({ items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 1 }] }) as any,
      'cust-1',
    );

    expect(result.options).toHaveLength(1);
  });

  it('uses cached options and binds selection quote ids', async () => {
    const provider = { name: 'provider', quote: vi.fn() };
    const service = new ShippingService(provider);

    mockCacheGet.mockReturnValue([{ carrier: 'C', service: 'S', price: 10, estimatedDays: 2 }]);

    const result = await service.quoteForCustomer(makeDto() as any, 'cust-1');

    expect(result.source).toBe('provider');
    expect(result.options).toHaveLength(1);
    expect(result.options[0]?.quoteId).toBeTypeOf('string');
    expect(provider.quote).not.toHaveBeenCalled();
  });

  it('falls back to manual table when provider is unavailable', async () => {
    const provider = {
      name: 'provider',
      quote: vi.fn().mockRejectedValue({ code: 'SHIPPING_PROVIDER_UNAVAILABLE' }),
    };
    const service = new ShippingService(provider);

    const result = await service.quoteForCustomer(makeDto() as any, 'cust-1');

    expect(result.source).toBe('fallback');
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options[0]?.carrier).toBe('Manual Carrier');
  });

  it('quotes shipping with inline address without loading saved address', async () => {
    const provider = {
      name: 'provider',
      quote: vi.fn().mockResolvedValue([{ carrier: 'C', service: 'S', price: 10, estimatedDays: 2 }]),
    };
    const service = new ShippingService(provider);

    const result = await service.quoteForCustomer(
      {
        shippingAddress: {
          zipCode: '01310100',
          street: 'Av Paulista',
          number: '1000',
          district: 'Bela Vista',
          city: 'Sao Paulo',
          state: 'SP',
          country: 'BR',
        },
        items: [{ productId: 'prod-1', quantity: 1 }],
      } as any,
      'cust-1',
    );

    expect(result.options).toHaveLength(1);
    expect(mockAddressFindUnique).not.toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalled();
  });
});
