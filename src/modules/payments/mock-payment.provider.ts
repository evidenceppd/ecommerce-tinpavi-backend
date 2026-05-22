import { randomUUID } from 'crypto';
import type {
  PaymentProvider,
  PaymentInitiationInput,
  PaymentInitiationResult,
  PaymentStatusResult,
  NormalizedWebhookPayload,
} from './payment-provider.interface';

const VALID_STATUSES = [
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'FAILED',
  'REFUNDED',
  'CANCELLED',
] as const;

type ValidStatus = (typeof VALID_STATUSES)[number];

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK';

  async initiatePayment(_input: PaymentInitiationInput): Promise<PaymentInitiationResult> {
    // Mock: simula aprovação instantânea retornando PAID
    return {
      externalId: `mock_${randomUUID()}`,
      status: 'PAID',
    };
  }

  async getPaymentStatus(externalId: string): Promise<PaymentStatusResult> {
    return {
      externalId,
      status: 'PAID',
      paidAt: new Date(),
    };
  }

  async processWebhook(payload: NormalizedWebhookPayload): Promise<PaymentStatusResult> {
    const upper = payload.status.toUpperCase();
    const resolved: ValidStatus = VALID_STATUSES.includes(upper as ValidStatus)
      ? (upper as ValidStatus)
      : 'PENDING';

    return {
      externalId: payload.externalId,
      status: resolved,
      paidAt: resolved === 'PAID' ? new Date() : undefined,
    };
  }
}
