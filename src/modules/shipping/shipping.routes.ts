import { Router } from 'express';

import { quoteShippingController } from './shipping.controller';

export const shippingRouter = Router();

shippingRouter.post('/quotes', quoteShippingController);
