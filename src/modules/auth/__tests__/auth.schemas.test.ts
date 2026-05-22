import { describe, expect, it } from 'vitest';
import { loginSchema, refreshSchema, registerSchema } from '../auth.schemas';

describe('auth.schemas', () => {
  it('accepts a valid register payload', () => {
    const parsed = registerSchema.parse({
      name: 'Admin User',
      email: 'admin@example.com',
      password: '12345678',
    });

    expect(parsed.email).toBe('admin@example.com');
  });

  it('rejects register payload with invalid email', () => {
    expect(() =>
      registerSchema.parse({
        name: 'Admin User',
        email: 'not-an-email',
        password: '12345678',
      }),
    ).toThrow();
  });

  it('rejects register payload with unsafe name', () => {
    expect(() =>
      registerSchema.parse({
        name: '<script>alert(1)</script>',
        email: 'admin@example.com',
        password: '12345678',
      }),
    ).toThrow('Invalid characters in name');
  });

  it('accepts login payload with non-empty password', () => {
    const parsed = loginSchema.parse({ email: 'admin@example.com', password: 'x' });
    expect(parsed.password).toBe('x');
  });

  it('rejects empty refresh token', () => {
    expect(() => refreshSchema.parse({ refreshToken: '' })).toThrow();
  });
});
