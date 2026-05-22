import { z } from 'zod';

export const addItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1).max(9999),
});

export const updateItemSchema = z.object({
  quantity: z.number().int().min(1).max(9999),
});

export type AddItemDto = z.infer<typeof addItemSchema>;
export type UpdateItemDto = z.infer<typeof updateItemSchema>;
