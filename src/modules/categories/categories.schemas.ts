import { z } from 'zod';

export const createCategorySchema = z.object({
  title: z.string().min(1).max(200),
  coverImage: z.string().max(500).optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().max(200).optional(),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQueryDto = z.infer<typeof listCategoriesQuerySchema>;
