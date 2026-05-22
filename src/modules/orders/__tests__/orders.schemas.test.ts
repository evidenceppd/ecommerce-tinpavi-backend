import { describe, expect, it } from 'vitest';
import { checkoutSchema, listOrdersQuerySchema, orderItemSchema, updateOrderStatusSchema } from '../orders.schemas';

describe('orders.schemas', () => {
  it('validates a positive order item payload', () => {
    const parsed = orderItemSchema.parse({ productId: 'prod-1', quantity: 2 });
    expect(parsed.quantity).toBe(2);
  });

  it('rejects non-positive item quantity', () => {
    expect(() => orderItemSchema.parse({ productId: 'prod-1', quantity: 0 })).toThrow();
  });

  it('validates checkout with saved shipping address id', () => {
    const parsed = checkoutSchema.parse({
      items: [{ productId: 'prod-1', quantity: 1 }],
      shippingAddressId: 'addr-1',
      quoteId: 'quote-1',
    });

    expect(parsed.items).toHaveLength(1);
  });

  it('validates checkout with inline shipping address payload', () => {
    const parsed = checkoutSchema.parse({
      items: [{ productId: 'prod-1', quantity: 1 }],
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
      quoteId: 'quote-1',
    });

    expect(parsed.shippingAddress?.zipCode).toBe('01310100');
    expect(parsed.saveAddress).toBe(true);
  });

  it('rejects checkout payload when shippingAddressId and shippingAddress are both provided', () => {
    expect(() =>
      checkoutSchema.parse({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddressId: 'addr-1',
        shippingAddress: {
          zipCode: '01310100',
          street: 'Av Paulista',
          number: '1000',
          district: 'Bela Vista',
          city: 'Sao Paulo',
          state: 'SP',
          country: 'BR',
        },
        quoteId: 'quote-1',
      }),
    ).toThrow();
  });

  it('rejects saveAddress=true when inline address is missing', () => {
    expect(() =>
      checkoutSchema.parse({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddressId: 'addr-1',
        saveAddress: true,
        quoteId: 'quote-1',
      }),
    ).toThrow();
  });

  it('coerces list query params and applies defaults', () => {
    const parsed = listOrdersQuerySchema.parse({ page: '2', limit: '50' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
  });

  it('accepts valid status transitions enum and rejects invalid', () => {
    const parsed = updateOrderStatusSchema.parse({ status: 'PAID' });
    expect(parsed.status).toBe('PAID');
    expect(() => updateOrderStatusSchema.parse({ status: 'UNKNOWN' })).toThrow();
  });
});
