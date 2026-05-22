import type { Request, Response } from 'express';
import { fail, ok } from '@/shared/http/response-envelope';
import { UsersService } from './users.service';
import type { ConfirmUserEmailDto, CreateUserDto, UpdateMeDto, UpdateUserDto } from './users.schemas';

const usersService = new UsersService();

function requireAdminActor(req: Request, res: Response): { id: string; role: string } | null {
  if (!req.user?.id || !req.user.role) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return null;
  }
  return { id: req.user.id, role: req.user.role };
}

function requireAdminUser(req: Request, res: Response): { id: string; role: string } | null {
  if (!req.user?.id || req.user.subjectType !== 'USER') {
    res.status(401).json(fail('UNAUTHORIZED', 'Admin user authentication required'));
    return null;
  }
  return { id: req.user.id, role: req.user.role };
}

export async function listUsersController(req: Request, res: Response): Promise<void> {
  const actor = requireAdminActor(req, res);
  if (!actor) return;

  const users = await usersService.listUsers();
  res.status(200).json(ok(users));
}

export async function getMeUserController(req: Request, res: Response): Promise<void> {
  const actor = requireAdminUser(req, res);
  if (!actor) return;

  try {
    const user = await usersService.getMe(actor.id);
    res.status(200).json(ok(user));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('NOT_FOUND', e.message));
  }
}

export async function createUserController(req: Request, res: Response): Promise<void> {
  const actor = requireAdminActor(req, res);
  if (!actor) return;

  try {
    const created = await usersService.createUser(req.body as CreateUserDto, actor.role);
    res.status(201).json(ok(created));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 409 ? 'CONFLICT' : e.statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function updateUserController(req: Request, res: Response): Promise<void> {
  const actor = requireAdminActor(req, res);
  if (!actor) return;

  try {
    const updated = await usersService.updateUser(
      String(req.params['id'] ?? ''),
      req.body as UpdateUserDto,
      actor.id,
      actor.role,
    );
    res.status(200).json(ok(updated));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 409 ? 'CONFLICT' : e.statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function sendUserConfirmationController(req: Request, res: Response): Promise<void> {
  const actor = requireAdminActor(req, res);
  if (!actor) return;

  try {
    const result = await usersService.sendEmailConfirmation(String(req.params['id'] ?? ''));
    res.status(200).json(ok(result));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function confirmUserEmailController(req: Request, res: Response): Promise<void> {
  const actor = requireAdminActor(req, res);
  if (!actor) return;

  try {
    const user = await usersService.confirmEmail(String(req.params['id'] ?? ''), req.body as ConfirmUserEmailDto);
    res.status(200).json(ok(user));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 404 ? 'NOT_FOUND' : e.statusCode === 401 ? 'UNAUTHORIZED' : e.statusCode === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function updateMeUserController(req: Request, res: Response): Promise<void> {
  const actor = requireAdminUser(req, res);
  if (!actor) return;

  try {
    const updated = await usersService.updateMe(actor.id, req.body as UpdateMeDto);
    res.status(200).json(ok(updated));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function deleteUserController(req: Request, res: Response): Promise<void> {
  const actor = requireAdminActor(req, res);
  if (!actor) return;

  try {
    await usersService.deleteUser(String(req.params['id'] ?? ''), actor.id, actor.role);
    res.status(204).send();
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}
