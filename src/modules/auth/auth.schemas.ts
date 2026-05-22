import { z } from 'zod';
import { isSafeTextInput } from '@/shared/security/input-guards';

export const registerSchema = z.object({
  name: z.string().min(2).max(100).refine(isSafeTextInput, 'Invalid characters in name'),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  requireMfa: z.boolean().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(128),
});

export const verifyAdminMfaSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export const verifyCustomerMfaSchema = verifyAdminMfaSchema;

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type VerifyAdminMfaDto = z.infer<typeof verifyAdminMfaSchema>;
export type VerifyCustomerMfaDto = z.infer<typeof verifyCustomerMfaSchema>;
