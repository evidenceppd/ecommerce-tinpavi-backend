import { Router } from 'express';
import { requireAdmin } from '@/shared/middleware/require-admin';
import { validate } from '@/shared/middleware/validate';
import {
  createUserController,
  deleteUserController,
  getMeUserController,
  listUsersController,
  confirmUserEmailController,
  sendUserConfirmationController,
  updateMeUserController,
  updateUserController,
} from './users.controller';
import { confirmUserEmailSchema, createUserSchema, updateMeSchema, updateUserSchema } from './users.schemas';

export const usersRouter = Router();

usersRouter.get('/me', getMeUserController);
usersRouter.put('/me', validate(updateMeSchema), updateMeUserController);

usersRouter.use(requireAdmin);
usersRouter.get('/', listUsersController);
usersRouter.post('/', validate(createUserSchema), createUserController);
usersRouter.post('/:id/send-confirmation', sendUserConfirmationController);
usersRouter.post('/:id/confirm-email', validate(confirmUserEmailSchema), confirmUserEmailController);
usersRouter.patch('/:id', validate(updateUserSchema), updateUserController);
usersRouter.delete('/:id', deleteUserController);
