import { Router } from 'express';
import { validate } from '@/shared/middleware/validate';
import { addItemSchema, updateItemSchema } from './cart.schemas';
import {
  getCartController,
  addItemController,
  updateItemController,
  removeItemController,
  clearCartController,
} from './cart.controller';

// /me/cart/* — authenticate applied in app.ts
export const cartRouter = Router();

cartRouter.get('/', getCartController);
cartRouter.post('/items', validate(addItemSchema), addItemController);
cartRouter.patch('/items/:productId', validate(updateItemSchema), updateItemController);
cartRouter.delete('/items/:productId', removeItemController);
cartRouter.delete('/', clearCartController);
