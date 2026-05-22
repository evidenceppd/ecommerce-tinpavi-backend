import { Router } from 'express';
import { authenticate } from '@/shared/middleware/authenticate';
import { validate } from '@/shared/middleware/validate';
import { forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema, verifyAdminMfaSchema, verifyCustomerMfaSchema } from './auth.schemas';
import {
  forgotPasswordController,
  loginController,
  logoutController,
  refreshController,
  registerController,
  resetPasswordController,
  verifyAdminMfaController,
  verifyCustomerMfaController,
} from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), registerController);
authRouter.post('/login', validate(loginSchema), loginController);
authRouter.post('/forgot-password', validate(forgotPasswordSchema), forgotPasswordController);
authRouter.post('/reset-password', validate(resetPasswordSchema), resetPasswordController);
authRouter.post('/login/admin/verify', validate(verifyAdminMfaSchema), verifyAdminMfaController);
authRouter.post('/login/customer/verify', validate(verifyCustomerMfaSchema), verifyCustomerMfaController);
authRouter.post('/refresh', validate(refreshSchema), refreshController);
authRouter.post('/logout', authenticate, validate(refreshSchema), logoutController);
