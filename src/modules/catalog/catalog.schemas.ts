import { z } from 'zod';
import { isSafeTextInput } from '@/shared/security/input-guards';

const booleanQuerySchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
}, z.boolean());

export const whereUseItemSchema = z.object({
  icon: z.string().min(1).max(255),
  description: z.string().min(1).max(500).refine(isSafeTextInput, 'Invalid characters in where_use description'),
});

export const productVariantSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  sku: z.string().min(1).max(120).optional(),
  stock: z.number().int().min(0),
  priceAdjustment: z.number().optional(),
  attributes: z.record(z.string().min(1).max(80), z.string().min(1).max(120)).optional(),
  imageUrl: z.string().min(1).max(2048).optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(1).optional(),
});

export const createProductVariantSchema = productVariantSchema.omit({ id: true });

export const updateProductVariantSchema = createProductVariantSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one variant field must be provided',
  });

export type ProductVariantDto = z.infer<typeof productVariantSchema>;
export type CreateProductVariantDto = z.infer<typeof createProductVariantSchema>;
export type UpdateProductVariantDto = z.infer<typeof updateProductVariantSchema>;

// --- Product schemas ---
const createProductSchemaBase = z.object({
  category_id: z.string().cuid().optional(),
  category_ids: z.array(z.string().cuid()).default([]),
  code: z
    .string()
    .length(8)
    .regex(/^[a-fA-F0-9]{8}$/, 'code must be 8 hex chars')
    .optional(),
  title: z.string().min(1).max(300).refine(isSafeTextInput, 'Invalid characters in title'),
  slug: z.string().min(1).max(300).optional(),
  brand: z.string().min(1).max(120).optional(),
  reviews: z.number().int().min(0).default(0),
  sales: z.number().int().min(0).default(0),
  benefits: z.string().min(1).max(3000).refine(isSafeTextInput, 'Invalid characters in benefits').optional(),
  highlights: z
    .array(z.string().min(1).max(300).refine(isSafeTextInput, 'Invalid characters in highlights'))
    .default([]),
  icons: z.string().min(1).max(1000),
  pricing: z.number().nonnegative(),
  pix_pricing: z.number().nonnegative(),
  compare_at_price: z.number().nonnegative().optional(),
  weight_kg: z.number().nonnegative().optional(),
  dimensions: z.string().min(1).max(120).optional(),
  seo_title: z.string().min(1).max(300).optional(),
  seo_description: z.string().min(1).max(500).optional(),
  badge: z.string().min(1).max(80).optional(),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
  quantity_stock: z.number().int().min(0).default(0),
  carousel_image: z.array(z.string().min(1).max(2048)).default([]),
  specifications: z.record(z.string(), z.string()).default({}),
  description: z.string().refine(isSafeTextInput, 'Invalid characters in description').optional(),
  applications: z.string().min(1).max(1000).refine(isSafeTextInput, 'Invalid characters in applications'),
  faqs: z.array(z.object({ question: z.string().min(1).max(300), answer: z.string().min(1).max(1000) })).default([]),
  usage_areas: z.array(z.string().min(1).max(120)).default([]),
  variants: z.array(productVariantSchema).default([]),
  where_use: z.array(whereUseItemSchema).default([]),
});

export const createProductSchema = createProductSchemaBase.superRefine((value, ctx) => {
  const hasPrimaryCategory = Boolean(value.category_id);
  const hasAnyCategory = hasPrimaryCategory || value.category_ids.length > 0;

  if (!hasAnyCategory) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one category must be provided',
      path: ['category_ids'],
    });
  }
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  category_id: z.string().cuid().optional(),
  category_ids: z.array(z.string().cuid()).optional(),
  code: z
    .string()
    .length(8)
    .regex(/^[a-fA-F0-9]{8}$/, 'code must be 8 hex chars')
    .optional(),
  title: z.string().min(1).max(300).refine(isSafeTextInput, 'Invalid characters in title').optional(),
  slug: z.string().min(1).max(300).optional(),
  brand: z.string().min(1).max(120).optional(),
  reviews: z.number().int().min(0).optional(),
  sales: z.number().int().min(0).optional(),
  benefits: z.string().min(1).max(3000).refine(isSafeTextInput, 'Invalid characters in benefits').optional(),
  highlights: z
    .array(z.string().min(1).max(300).refine(isSafeTextInput, 'Invalid characters in highlights'))
    .optional(),
  icons: z.string().min(1).max(1000).optional(),
  pricing: z.number().nonnegative().optional(),
  pix_pricing: z.number().nonnegative().optional(),
  compare_at_price: z.number().nonnegative().optional(),
  weight_kg: z.number().nonnegative().optional(),
  dimensions: z.string().min(1).max(120).optional(),
  seo_title: z.string().min(1).max(300).optional(),
  seo_description: z.string().min(1).max(500).optional(),
  badge: z.string().min(1).max(80).optional(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
  quantity_stock: z.number().int().min(0).optional(),
  carousel_image: z.array(z.string().min(1).max(2048)).optional(),
  specifications: z.record(z.string(), z.string()).optional(),
  description: z.string().refine(isSafeTextInput, 'Invalid characters in description').optional(),
  applications: z.string().min(1).max(1000).refine(isSafeTextInput, 'Invalid characters in applications').optional(),
  faqs: z.array(z.object({ question: z.string().min(1).max(300), answer: z.string().min(1).max(1000) })).optional(),
  usage_areas: z.array(z.string().min(1).max(120)).optional(),
  variants: z.array(productVariantSchema).optional(),
  where_use: z.array(whereUseItemSchema).optional(),
});
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

// --- Public list query schema ---
export const listProductsQuerySchema = z.object({
  category_id: z.string().cuid().optional(),
  search: z.string().max(200).optional(),
  orderBy: z.enum(['pricing', 'title', 'createdAt']).default('createdAt'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListProductsQueryDto = z.infer<typeof listProductsQuerySchema>;

export const adminListProductsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  category_id: z.string().cuid().optional(),
  lowStockOnly: booleanQuerySchema.default(false),
  threshold: z.coerce.number().int().min(0).default(5),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminListProductsQueryDto = z.infer<typeof adminListProductsQuerySchema>;
