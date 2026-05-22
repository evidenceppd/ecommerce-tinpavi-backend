import { Router } from 'express';
import { initiatePaymentController, paymentWebhookController } from './payments.controller';

// Montado em /me/orders — authenticate aplicado no app.ts
// mergeParams: true para herdar o :id da rota pai
export const orderPaymentRouter = Router({ mergeParams: true });
orderPaymentRouter.post('/:id/pay', initiatePaymentController);

// Montado em /webhooks — público (sem authenticate)
export const paymentWebhookRouter = Router();
paymentWebhookRouter.post('/payment', paymentWebhookController);
