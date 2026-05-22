import { describe, expect, it } from 'vitest';
import { createCategorySchema, listCategoriesQuerySchema, updateCategorySchema } from '../categories.schemas';

describe('categories.schemas', () => {
  it('accepts valid category creation payload', () => {
    const parsed = createCategorySchema.parse({ title: 'Pisos' });
    expect(parsed.title).toBe('Pisos');
  });

  it('rejects empty category title', () => {
    expect(() => createCategorySchema.parse({ title: '' })).toThrow();
  });

  it('accepts partial category update payload', () => {
    const parsed = updateCategorySchema.parse({});
    expect(parsed).toEqual({});
  });

  it('coerces query values and applies defaults', () => {
    const parsed = listCategoriesQuerySchema.parse({ page: '2', limit: '25' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
  });

  it('enforces max limit for categories listing', () => {
    expect(() => listCategoriesQuerySchema.parse({ limit: 201 })).toThrow();
  });
});
