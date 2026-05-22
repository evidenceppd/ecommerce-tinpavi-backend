import { describe, expect, it } from 'vitest';
import {
  adminCreateCustomerSchema,
  adminListCustomersQuerySchema,
  adminUpdateCustomerSchema,
  createAddressSchema,
  updateProfileSchema,
} from '../customers.schemas';

describe('customers.schemas', () => {
  it('updateProfile accepts customer profile fields from the site form', () => {
    const parsed = updateProfileSchema.parse({
      name: 'Cliente Teste',
      phone: '(11) 98888-1234',
      company: 'Tinpavi Engenharia',
      document: '12.345.678/0001-90',
    });

    expect(parsed.phone).toBe('(11) 98888-1234');
    expect(parsed.company).toBe('Tinpavi Engenharia');
    expect(parsed.document).toBe('12.345.678/0001-90');
  });

  it('updateProfile accepts nullable optional profile fields', () => {
    const parsed = updateProfileSchema.parse({ phone: null, company: null, document: null });
    expect(parsed.phone).toBeNull();
    expect(parsed.company).toBeNull();
    expect(parsed.document).toBeNull();
  });

  it('createAddress applies defaults and normalizes state', () => {
    const parsed = createAddressSchema.parse({
      zipCode: '01001000',
      street: 'Rua A',
      number: '10',
      district: 'Centro',
      city: 'Sao Paulo',
      state: 'sp',
    });

    expect(parsed.state).toBe('SP');
    expect(parsed.country).toBe('BR');
    expect(parsed.isDefault).toBe(false);
  });

  it('createAddress rejects invalid CEP format', () => {
    expect(() =>
      createAddressSchema.parse({
        zipCode: '01001-000',
        street: 'Rua A',
        number: '10',
        district: 'Centro',
        city: 'Sao Paulo',
        state: 'SP',
      }),
    ).toThrow('CEP deve conter exatamente 8 digitos numericos (sem hifen)');
  });

  it('adminList query coerces defaults and validates role', () => {
    const parsed = adminListCustomersQuerySchema.parse({ page: '2', limit: '10', role: 'ADMIN' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.role).toBe('ADMIN');
  });

  it('adminCreate uses CUSTOMER as default role and adminUpdate allows partial payload', () => {
    const created = adminCreateCustomerSchema.parse({
      name: 'Cliente',
      email: 'c@example.com',
      password: '12345678',
    });
    const updated = adminUpdateCustomerSchema.parse({ email: 'new@example.com' });

    expect(created.role).toBe('CUSTOMER');
    expect(updated.email).toBe('new@example.com');
  });
});
