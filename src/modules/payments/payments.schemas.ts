import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  orderId: z.string().cuid(),
  paymentMethod: z.enum(['MOCK', 'PIX', 'CREDIT_CARD', 'BOLETO']),
});

export const webhookPayloadSchema = z
  .object({
    eventId: z.string().min(1).optional(),
    externalId: z.string().min(1),
    status: z.string().min(1),
  })
  .passthrough();

export type InitiatePaymentDto = z.infer<typeof initiatePaymentSchema>;
export type WebhookPayloadDto = z.infer<typeof webhookPayloadSchema>;
