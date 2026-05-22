import { z } from 'zod';

export const shippingQuoteItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

export const shippingAddressSchema = z.object({
  zipCode: z.string().regex(/^\d{8}$/, 'ZIP code must have 8 digits'),
  street: z.string().min(1).max(200),
  number: z.string().min(1).max(20),
  complement: z.string().max(100).optional(),
  district: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  country: z.string().length(2).default('BR'),
});

export const shippingQuoteSchema = z.object({
  shippingAddressId: z.string().min(1).optional(),
  shippingAddress: shippingAddressSchema.optional(),
  items: z.array(shippingQuoteItemSchema).min(1),
}).superRefine((data, ctx) => {
  const hasAddressId = Boolean(data.shippingAddressId);
  const hasInlineAddress = Boolean(data.shippingAddress);

  if (!hasAddressId && !hasInlineAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide shippingAddressId or shippingAddress',
      path: ['shippingAddressId'],
    });
  }

  if (hasAddressId && hasInlineAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Use either shippingAddressId or shippingAddress',
      path: ['shippingAddress'],
    });
  }
});

export type ShippingQuoteDto = z.infer<typeof shippingQuoteSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
