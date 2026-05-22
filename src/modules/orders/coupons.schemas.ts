import { z } from 'zod';

const createCouponBase = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .transform((v) => v.toUpperCase()),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().positive(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  maxUses: z.number().int().positive().optional(),
  maxUsesPerCustomer: z.number().int().positive().optional(),
  isActive: z.boolean().optional().default(true),
});

export const createCouponSchema = createCouponBase.refine(
  (d) => d.validUntil > d.validFrom,
  {
    message: 'validUntil must be after validFrom',
    path: ['validUntil'],
  },
);

export const updateCouponSchema = createCouponBase.partial();

export const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});

export type CreateCouponDto = z.infer<typeof createCouponSchema>;
export type UpdateCouponDto = z.infer<typeof updateCouponSchema>;
export type ListCouponsQueryDto = z.infer<typeof listCouponsQuerySchema>;
