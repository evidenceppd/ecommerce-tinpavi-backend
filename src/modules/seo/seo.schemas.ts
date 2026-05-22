import { z } from 'zod';

export const createRedirectSchema = z.object({
  fromPath: z.string().min(1).startsWith('/'),
  toPath: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

export const updateRedirectSchema = createRedirectSchema.partial();

export const listRedirectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRedirectDto = z.infer<typeof createRedirectSchema>;
export type UpdateRedirectDto = z.infer<typeof updateRedirectSchema>;
export type ListRedirectsQueryDto = z.infer<typeof listRedirectsQuerySchema>;
