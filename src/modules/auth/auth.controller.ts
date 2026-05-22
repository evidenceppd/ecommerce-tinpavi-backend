import type { Request, Response } from 'express';
import { fail, ok } from '@/shared/http/response-envelope';
import { AuthService } from './auth.service';
import type { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto, VerifyAdminMfaDto, VerifyCustomerMfaDto } from './auth.schemas';

const authService = new AuthService();

export async function registerController(req: Request, res: Response): Promise<void> {
  try {
    const tokens = await authService.register(req.body as RegisterDto);
    res.status(201).json(ok(tokens));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(
      fail(e.statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR', e.message),
    );
  }
}

export async function loginController(req: Request, res: Response): Promise<void> {
  try {
    const tokens = await authService.login(req.body as LoginDto);
    res.status(200).json(ok(tokens));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('UNAUTHORIZED', e.message));
  }
}

export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
  try {
    await authService.forgotPassword(req.body as ForgotPasswordDto);
    res.status(200).json(ok({ sent: true }));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('INTERNAL_ERROR', e.message));
  }
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
  try {
    await authService.resetPassword(req.body as ResetPasswordDto);
    res.status(200).json(ok({ reset: true }));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('UNAUTHORIZED', e.message));
  }
}

export async function verifyAdminMfaController(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.verifyAdminMfa(req.body as VerifyAdminMfaDto);
    res.status(200).json(ok(result));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('UNAUTHORIZED', e.message));
  }
}

export async function verifyCustomerMfaController(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.verifyCustomerMfa(req.body as VerifyCustomerMfaDto);
    res.status(200).json(ok(result));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('UNAUTHORIZED', e.message));
  }
}

export async function refreshController(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.refresh(req.body as RefreshDto);
    res.status(200).json(ok(result));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('UNAUTHORIZED', e.message));
  }
}

export async function logoutController(req: Request, res: Response): Promise<void> {
  await authService.logout(req.body as RefreshDto);
  res.status(204).send();
}
