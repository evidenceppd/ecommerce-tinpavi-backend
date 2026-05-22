import { z } from 'zod';
import { isSafeTextInput } from '@/shared/security/input-guards';

export const userRoleSchema = z.enum(['EDITOR', 'ADMIN', 'MASTER']);

export const createUserSchema = z.object({
  name: z.string().min(2).max(100).refine(isSafeTextInput, 'Invalid characters in name'),
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  role: userRoleSchema,
  isActive: z.boolean().default(true),
  firstLogin: z.boolean().default(false),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).refine(isSafeTextInput, 'Invalid characters in name').optional(),
  email: z.string().email().max(320).optional(),
  password: z.string().min(8).max(128).optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  firstLogin: z.boolean().optional(),
});

export const updateMeSchema = z.object({
  name: z.string().min(2).max(100).refine(isSafeTextInput, 'Invalid characters in name').optional(),
  email: z.string().email().max(320).optional(),
  password: z.string().min(8).max(128).optional(),
});

export const confirmUserEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must have 6 digits'),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UpdateMeDto = z.infer<typeof updateMeSchema>;
export type ConfirmUserEmailDto = z.infer<typeof confirmUserEmailSchema>;
