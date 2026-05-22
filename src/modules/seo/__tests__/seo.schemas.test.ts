import { describe, expect, it } from 'vitest';
import { createRedirectSchema, listRedirectsQuerySchema, updateRedirectSchema } from '../seo.schemas';

describe('seo.schemas', () => {
  it('createRedirect requires fromPath starting with slash', () => {
    const parsed = createRedirectSchema.parse({ fromPath: '/old', toPath: '/new' });
    expect(parsed.fromPath).toBe('/old');

    expect(() => createRedirectSchema.parse({ fromPath: 'old', toPath: '/new' })).toThrow();
  });

  it('createRedirect defaults isActive to true', () => {
    const parsed = createRedirectSchema.parse({ fromPath: '/old', toPath: '/new' });
    expect(parsed.isActive).toBe(true);
  });

  it('updateRedirect accepts partial payload', () => {
    const parsed = updateRedirectSchema.parse({ toPath: '/new-path' });
    expect(parsed.toPath).toBe('/new-path');
  });

  it('coerces redirects listing query defaults', () => {
    const parsed = listRedirectsQuerySchema.parse({ page: '3', limit: '15' });
    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(15);
  });

  it('enforces max limit for redirect listing', () => {
    expect(() => listRedirectsQuerySchema.parse({ limit: 101 })).toThrow();
  });
});
