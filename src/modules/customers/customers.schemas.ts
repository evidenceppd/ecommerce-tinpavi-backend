import { z } from 'zod';
import { isSafeTextInput } from '@/shared/security/input-guards';

// CEP brasileiro: 8 digitos sem hifen (per D-P2-03)
const zipCodeSchema = z
  .string()
  .regex(/^\d{8}$/, 'CEP deve conter exatamente 8 digitos numericos (sem hifen)');

const phoneSchema = z
  .string()
  .refine((value) => /^\D*(?:\d\D*){10,11}$/.test(value), 'Telefone deve conter 10 ou 11 digitos');

const documentSchema = z
  .string()
  .max(32)
  .refine((value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length === 11 || digits.length === 14;
  }, 'Documento deve ser um CPF ou CNPJ valido');

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).refine(isSafeTextInput, 'Invalid characters in name').optional(),
  phone: phoneSchema.optional().nullable(),
  company: z
    .string()
    .max(120)
    .refine(isSafeTextInput, 'Invalid characters in company')
    .optional()
    .nullable(),
  document: documentSchema.optional().nullable(),
});

export const createAddressSchema = z.object({
  label: z.string().max(50).refine(isSafeTextInput, 'Invalid characters in label').optional(),
  zipCode: zipCodeSchema,
  street: z.string().min(1).max(200).refine(isSafeTextInput, 'Invalid characters in street'),
  number: z.string().min(1).max(20).refine(isSafeTextInput, 'Invalid characters in number'),
  complement: z
    .string()
    .max(100)
    .refine(isSafeTextInput, 'Invalid characters in complement')
    .optional(),
  district: z.string().min(1).max(100).refine(isSafeTextInput, 'Invalid characters in district'),
  city: z.string().min(1).max(100).refine(isSafeTextInput, 'Invalid characters in city'),
  state: z.string().length(2, 'UF deve ter exatamente 2 caracteres').toUpperCase(),
  country: z.string().length(2).default('BR'),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'Informe ao menos um campo para atualizar',
);

export const adminListCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  role: z.enum(['CUSTOMER', 'ADMIN', 'MASTER']).optional(),
});

export const adminUpdateCustomerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().max(320).optional(),
  phone: z
    .string()
    .regex(/^\D*(?:\d\D*){10,11}$/, 'Telefone deve conter 10 ou 11 digitos')
    .optional()
    .nullable(),
  company: z.string().max(120).optional().nullable(),
  document: documentSchema.optional().nullable(),
  role: z.enum(['CUSTOMER', 'ADMIN', 'MASTER']).optional(),
  password: z.string().min(8).max(72).optional(),
});

export const adminCreateCustomerSchema = z.object({
  name: z.string().min(2).max(100).refine(isSafeTextInput, 'Invalid characters in name'),
  email: z.string().email().max(320),
  password: z.string().min(8).max(72),
  phone: z
    .string()
    .regex(/^\D*(?:\d\D*){10,11}$/, 'Telefone deve conter 10 ou 11 digitos')
    .optional()
    .nullable(),
  company: z.string().max(120).optional().nullable(),
  document: documentSchema.optional().nullable(),
  role: z.enum(['CUSTOMER', 'ADMIN', 'MASTER']).default('CUSTOMER'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const verifyMfaSetupSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type CreateAddressDto = z.infer<typeof createAddressSchema>;
export type UpdateAddressDto = z.infer<typeof updateAddressSchema>;
export type AdminListCustomersQueryDto = z.infer<typeof adminListCustomersQuerySchema>;
export type AdminUpdateCustomerDto = z.infer<typeof adminUpdateCustomerSchema>;
export type AdminCreateCustomerDto = z.infer<typeof adminCreateCustomerSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type VerifyMfaSetupDto = z.infer<typeof verifyMfaSetupSchema>;
