import { describe, expect, it } from 'vitest';
import { initiatePaymentSchema, webhookPayloadSchema } from '../payments.schemas';

describe('payments.schemas', () => {
  it('accepts valid initiate payment payload', () => {
    const parsed = initiatePaymentSchema.parse({
      orderId: 'ck0abc1230000000000000000',
      paymentMethod: 'PIX',
    });

    expect(parsed.paymentMethod).toBe('PIX');
  });

  it('rejects invalid paymentMethod', () => {
    expect(() =>
      initiatePaymentSchema.parse({
        orderId: 'ck0abc1230000000000000000',
        paymentMethod: 'CASH',
      }),
    ).toThrow();
  });

  it('accepts webhook payload with additional fields (passthrough)', () => {
    const parsed = webhookPayloadSchema.parse({
      externalId: 'ext-1',
      status: 'PAID',
      anyProviderField: 'ok',
    });

    expect((parsed as Record<string, unknown>)['anyProviderField']).toBe('ok');
  });

  it('rejects webhook payload without required externalId/status', () => {
    expect(() => webhookPayloadSchema.parse({ status: 'PAID' })).toThrow();
    expect(() => webhookPayloadSchema.parse({ externalId: 'ext-1' })).toThrow();
  });
});
