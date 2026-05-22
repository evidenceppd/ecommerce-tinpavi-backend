import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';
import { initiatePaymentSchema, webhookPayloadSchema } from './payments.schemas';
import { ok, fail } from '@/shared/http/response-envelope';

const service = new PaymentsService();

// POST /orders/:id/pay — cliente autenticado inicia pagamento
export async function initiatePaymentController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const orderId = req.params['id'] as string;
    const parsed = initiatePaymentSchema.safeParse({ orderId, ...req.body });
    if (!parsed.success) {
      res.status(400).json(fail('VALIDATION_ERROR', 'Invalid input', parsed.error.flatten()));
      return;
    }
    const customerId = req.user!.id;
    const result = await service.initiatePayment(parsed.data, customerId);
    res.status(200).json(ok(result));
  } catch (err) {
    next(err);
  }
}

// POST /webhooks/payment — endpoint público para callbacks do gateway
export async function paymentWebhookController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const signature = req.headers['x-webhook-signature'];
    const secret = process.env['PAYMENT_WEBHOOK_SECRET'];

    if (!secret) {
      res.status(500).json(fail('WEBHOOK_SECRET_NOT_CONFIGURED', 'Webhook secret is not configured'));
      return;
    }

    if (typeof signature !== 'string' || signature.length === 0) {
      res.status(401).json(fail('WEBHOOK_INVALID_SIGNATURE', 'Invalid webhook signature'));
      return;
    }

    if (!req.rawBody || !Buffer.isBuffer(req.rawBody)) {
      res.status(400).json(fail('WEBHOOK_INVALID_BODY', 'Invalid webhook body'));
      return;
    }

    const expected = createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    const isValidSignature =
      sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);

    if (!isValidSignature) {
      res.status(401).json(fail('WEBHOOK_INVALID_SIGNATURE', 'Invalid webhook signature'));
      return;
    }

    const parsed = webhookPayloadSchema.safeParse(req.body);
    const payload = parsed.success
      ? (parsed.data as Record<string, unknown>)
      : (req.body as Record<string, unknown>);
    const result = await service.processWebhook(payload);
    res.status(200).json(ok(result));
  } catch (err) {
    next(err);
  }
}
