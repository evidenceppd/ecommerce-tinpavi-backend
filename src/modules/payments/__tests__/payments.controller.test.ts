import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockInitiatePayment,
  mockProcessWebhook,
  mockInitiatePaymentSafeParse,
  mockWebhookPayloadSafeParse,
} = vi.hoisted(() => ({
  mockInitiatePayment: vi.fn(),
  mockProcessWebhook: vi.fn(),
  mockInitiatePaymentSafeParse: vi.fn(),
  mockWebhookPayloadSafeParse: vi.fn(),
}));

vi.mock('../payments.service', () => ({
  PaymentsService: class PaymentsService {
    initiatePayment = mockInitiatePayment;
    processWebhook = mockProcessWebhook;
  },
}));

vi.mock('../payments.schemas', async () => {
  const actual = await vi.importActual<typeof import('../payments.schemas')>('../payments.schemas');
  return {
    ...actual,
    initiatePaymentSchema: { safeParse: mockInitiatePaymentSafeParse },
    webhookPayloadSchema: { safeParse: mockWebhookPayloadSafeParse },
  };
});

import { initiatePaymentController, paymentWebhookController } from '../payments.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('payments.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['PAYMENT_WEBHOOK_SECRET'];
    mockInitiatePaymentSafeParse.mockReturnValue({ success: true, data: { orderId: 'o1', paymentMethod: 'pix' } });
    mockWebhookPayloadSafeParse.mockReturnValue({ success: true, data: { externalId: 'ext-1', status: 'PAID' } });
  });

  it('initiatePaymentController returns 400 on invalid payload', async () => {
    const req = { params: { id: 'o1' }, body: { paymentMethod: '' }, user: { id: 'cust-1' } };
    const res = createResponse();
    const next = vi.fn();
    mockInitiatePaymentSafeParse.mockReturnValue({
      success: false,
      error: { flatten: () => ({ fieldErrors: { paymentMethod: ['Required'] } }) },
    });

    await initiatePaymentController(req as any, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('initiatePaymentController calls service and returns 200', async () => {
    const req = { params: { id: 'o1' }, body: { paymentMethod: 'pix' }, user: { id: 'cust-1' } };
    const res = createResponse();
    const next = vi.fn();
    mockInitiatePayment.mockResolvedValue({ status: 'PENDING' });

    await initiatePaymentController(req as any, res as any, next as any);

    expect(mockInitiatePayment).toHaveBeenCalledWith({ orderId: 'o1', paymentMethod: 'pix' }, 'cust-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('paymentWebhookController returns 500 when secret is missing', async () => {
    const req = { headers: {}, rawBody: Buffer.from('{}'), body: {} };
    const res = createResponse();
    const next = vi.fn();

    await paymentWebhookController(req as any, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('paymentWebhookController returns 401 when signature is invalid', async () => {
    process.env['PAYMENT_WEBHOOK_SECRET'] = 'secret-123';
    const req = {
      headers: { 'x-webhook-signature': 'bad' },
      rawBody: Buffer.from('{"externalId":"ext-1"}'),
      body: { externalId: 'ext-1', status: 'PAID' },
    };
    const res = createResponse();
    const next = vi.fn();

    await paymentWebhookController(req as any, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('paymentWebhookController validates signature and returns 200', async () => {
    const secret = 'secret-123';
    process.env['PAYMENT_WEBHOOK_SECRET'] = secret;
    const rawBody = Buffer.from('{"externalId":"ext-1","status":"PAID"}');
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    const req = {
      headers: { 'x-webhook-signature': signature },
      rawBody,
      body: { externalId: 'ext-1', status: 'PAID' },
    };
    const res = createResponse();
    const next = vi.fn();
    mockProcessWebhook.mockResolvedValue({ processed: true });

    await paymentWebhookController(req as any, res as any, next as any);

    expect(mockProcessWebhook).toHaveBeenCalledWith({ externalId: 'ext-1', status: 'PAID' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });
});
