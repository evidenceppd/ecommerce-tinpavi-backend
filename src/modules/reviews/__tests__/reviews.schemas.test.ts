import { describe, expect, it } from 'vitest';
import {
  createReviewSchema,
  listAdminReviewsQuerySchema,
  moderateReviewSchema,
  updateReviewSchema,
} from '../reviews.schemas';

describe('reviews.schemas', () => {
  it('accepts valid create review payload', () => {
    const parsed = createReviewSchema.parse({ rating: 5, comment: 'Excelente produto' });
    expect(parsed.rating).toBe(5);
  });

  it('rejects rating outside 1..5 range', () => {
    expect(() => createReviewSchema.parse({ rating: 0 })).toThrow();
    expect(() => createReviewSchema.parse({ rating: 6 })).toThrow();
  });

  it('accepts partial update review payload', () => {
    const parsed = updateReviewSchema.parse({ comment: 'Comentario editado' });
    expect(parsed.comment).toBe('Comentario editado');
  });

  it('validates moderation status and safe moderator note', () => {
    const parsed = moderateReviewSchema.parse({ status: 'APPROVED', moderatorNote: 'Tudo certo' });
    expect(parsed.status).toBe('APPROVED');
    expect(() =>
      moderateReviewSchema.parse({ status: 'REJECTED', moderatorNote: '<script>alert(1)</script>' }),
    ).toThrow('Invalid characters in moderator note');
  });

  it('coerces admin reviews query defaults', () => {
    const parsed = listAdminReviewsQuerySchema.parse({ page: '2', limit: '10', status: 'PENDING' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.status).toBe('PENDING');
  });
});
