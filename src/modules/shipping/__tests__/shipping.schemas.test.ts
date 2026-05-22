import { describe, expect, it } from 'vitest';
import { shippingQuoteItemSchema, shippingQuoteSchema } from '../shipping.schemas';

describe('shipping.schemas', () => {
  it('accepts a valid shipping quote item', () => {
    const parsed = shippingQuoteItemSchema.parse({ productId: 'prod-1', variantId: 'var-1', quantity: 2 });
    expect(parsed.quantity).toBe(2);
  });

  it('rejects invalid shipping quote item quantity', () => {
    expect(() => shippingQuoteItemSchema.parse({ productId: 'prod-1', quantity: 0 })).toThrow();
  });

  it('accepts valid quote payload with shippingAddressId', () => {
    const parsed = shippingQuoteSchema.parse({
      shippingAddressId: 'addr-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    });

    expect(parsed.items).toHaveLength(1);
  });

  it('accepts valid quote payload with inline shippingAddress', () => {
    const parsed = shippingQuoteSchema.parse({
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
    });

    expect(parsed.shippingAddress?.zipCode).toBe('01310100');
  });

  it('rejects quote payload without items', () => {
    expect(() =>
      shippingQuoteSchema.parse({
        shippingAddressId: 'addr-1',
        items: [],
      }),
    ).toThrow();
  });

  it('rejects quote payload when both shippingAddressId and shippingAddress are provided', () => {
    expect(() =>
      shippingQuoteSchema.parse({
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
        items: [{ productId: 'prod-1', quantity: 1 }],
      }),
    ).toThrow();
  });
});
