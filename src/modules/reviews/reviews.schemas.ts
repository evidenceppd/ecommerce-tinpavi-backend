import { z } from 'zod';
import { isSafeTextInput } from '@/shared/security/input-guards';

// ── Customer-facing ────────────────────────────────────────────────────────
const createReviewBase = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).refine(isSafeTextInput, 'Invalid characters in comment').optional(),
});

export const createReviewSchema = createReviewBase;
export const updateReviewSchema = createReviewBase.partial();

// ── Admin moderation ────────────────────────────────────────────────────────
export const moderateReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  moderatorNote: z
    .string()
    .max(1000)
    .refine(isSafeTextInput, 'Invalid characters in moderator note')
    .optional(),
});

// ── Admin listing query ─────────────────────────────────────────────────────
export const listAdminReviewsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ── DTO types ───────────────────────────────────────────────────────────────
export type CreateReviewDto = z.infer<typeof createReviewSchema>;
export type UpdateReviewDto = z.infer<typeof updateReviewSchema>;
export type ModerateReviewDto = z.infer<typeof moderateReviewSchema>;
export type ListAdminReviewsQueryDto = z.infer<typeof listAdminReviewsQuerySchema>;
