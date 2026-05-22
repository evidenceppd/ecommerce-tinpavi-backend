import { describe, it, expect } from 'vitest';
import { registerSchema } from '@/modules/auth/auth.schemas';
import { createReviewSchema } from '@/modules/reviews/reviews.schemas';
import { createAddressSchema } from '@/modules/customers/customers.schemas';
import { createProductSchema } from '@/modules/catalog/catalog.schemas';

describe('XSS input guards in schemas', () => {
  it('rejects script-like name on register payload', () => {
    const result = registerSchema.safeParse({
      name: '<script>alert(1)</script>',
      email: 'safe@example.com',
      password: '12345678',
    });
    expect(result.success).toBe(false);
  });

  it('rejects script-like review comment', () => {
    const result = createReviewSchema.safeParse({
      rating: 5,
      comment: '<img src=x onerror=alert(1)>',
    });
    expect(result.success).toBe(false);
  });

  it('rejects script-like address field', () => {
    const result = createAddressSchema.safeParse({
      zipCode: '01001000',
      street: 'Rua <b>Teste</b>',
      number: '10',
      district: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      country: 'BR',
      isDefault: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects script-like catalog description', () => {
    const result = createProductSchema.safeParse({
      name: 'Produto seguro',
      description: '<svg onload=alert(1)>',
      price: 10,
      stock: 1,
      isActive: true,
    });
    expect(result.success).toBe(false);
  });

  it('accepts safe values', () => {
    const result = registerSchema.safeParse({
      name: 'Cliente Seguro',
      email: 'safe@example.com',
      password: '12345678',
    });
    expect(result.success).toBe(true);
  });
});
