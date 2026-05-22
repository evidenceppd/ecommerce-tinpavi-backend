import { describe, expect, it } from 'vitest';
import { createUserSchema, updateMeSchema, updateUserSchema } from '../users.schemas';

describe('users.schemas', () => {
  it('applies defaults for isActive and firstLogin on create', () => {
    const parsed = createUserSchema.parse({
      name: 'Admin User',
      email: 'admin@example.com',
      password: '12345678',
      role: 'ADMIN',
    });

    expect(parsed.isActive).toBe(true);
    expect(parsed.firstLogin).toBe(false);
  });

  it('rejects invalid role', () => {
    expect(() =>
      createUserSchema.parse({
        name: 'Admin User',
        email: 'admin@example.com',
        password: '12345678',
        role: 'CUSTOMER',
      }),
    ).toThrow();
  });

  it('rejects unsafe characters in name', () => {
    expect(() =>
      createUserSchema.parse({
        name: '<script>alert(1)</script>',
        email: 'admin@example.com',
        password: '12345678',
        role: 'ADMIN',
      }),
    ).toThrow('Invalid characters in name');
  });

  it('accepts partial payload in updateUser', () => {
    const parsed = updateUserSchema.parse({
      email: 'new-admin@example.com',
      firstLogin: true,
    });

    expect(parsed.email).toBe('new-admin@example.com');
    expect(parsed.firstLogin).toBe(true);
  });

  it('accepts updateMe payload without role fields', () => {
    const parsed = updateMeSchema.parse({
      name: 'New Name',
      password: '12345678',
    });

    expect(parsed.name).toBe('New Name');
    expect(parsed.password).toBe('12345678');
  });
});
