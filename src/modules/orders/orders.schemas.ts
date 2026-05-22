import { z } from 'zod';

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

export const checkoutShippingAddressSchema = z.object({
  zipCode: z.string().regex(/^\d{8}$/, 'ZIP code must have 8 digits'),
  street: z.string().min(1).max(200),
  number: z.string().min(1).max(20),
  complement: z.string().max(100).optional(),
  district: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  country: z.string().length(2).default('BR'),
});

export const checkoutSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  shippingAddressId: z.string().min(1).optional(),
  shippingAddress: checkoutShippingAddressSchema.optional(),
  saveAddress: z.boolean().optional().default(false),
  setAsDefaultAddress: z.boolean().optional().default(false),
  quoteId: z.string().min(1),
  couponCode: z.string().optional(),
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

  if (data.saveAddress && !hasInlineAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'saveAddress requires shippingAddress payload',
      path: ['saveAddress'],
    });
  }
});

export const validateCouponSchema = z.object({
  code: z.string().min(1).max(50).transform((value) => value.toUpperCase()),
  subtotal: z.number().nonnegative(),
  shippingCost: z.number().nonnegative().default(0),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
    .optional(),
  paymentStatus: z
    .enum(['PENDING', 'AWAITING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'])
    .optional(),
  customerId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().max(200).optional(),
});

export type CheckoutDto = z.infer<typeof checkoutSchema>;
export type ValidateCouponDto = z.infer<typeof validateCouponSchema>;
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;
export type ListOrdersQueryDto = z.infer<typeof listOrdersQuerySchema>;
export type OrderItemDto = z.infer<typeof orderItemSchema>;
export type CheckoutShippingAddressDto = z.infer<typeof checkoutShippingAddressSchema>;
