import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockOrderFindUnique,
  mockOrderFindFirst,
  mockOrderUpdate,
  mockCacheSetNX,
  mockCacheDel,
  mockPaymentWebhookFindUnique,
  mockPaymentWebhookUpsert,
  mockInitiatePayment,
  mockProcessWebhook,
} = vi.hoisted(() => ({
  mockOrderFindUnique: vi.fn(),
  mockOrderFindFirst: vi.fn(),
  mockOrderUpdate: vi.fn(),
  mockCacheSetNX: vi.fn(),
  mockCacheDel: vi.fn(),
  mockPaymentWebhookFindUnique: vi.fn(),
  mockPaymentWebhookUpsert: vi.fn(),
  mockInitiatePayment: vi.fn(),
  mockProcessWebhook: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    order: {
      findUnique: mockOrderFindUnique,
      findFirst: mockOrderFindFirst,
      update: mockOrderUpdate,
    },
    paymentWebhookEvent: {
      findUnique: mockPaymentWebhookFindUnique,
      upsert: mockPaymentWebhookUpsert,
    },
  },
}));

vi.mock('@/shared/infra/memory-cache', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    setNX: mockCacheSetNX,
    del: mockCacheDel,
    delByPrefix: vi.fn(),
  },
}));

vi.mock('../mock-payment.provider', () => ({
  MockPaymentProvider: class MockPaymentProvider {
    name = 'MOCK';
    initiatePayment = mockInitiatePayment;
    processWebhook = mockProcessWebhook;
    getPaymentStatus = vi.fn();
  },
}));

import { PaymentsService } from '../payments.service';

describe('PaymentsService.initiatePayment', () => {
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService();

    mockOrderUpdate.mockResolvedValue({ id: 'ord-1' });
    mockInitiatePayment.mockResolvedValue({
      externalId: 'mock_ext_1',
      status: 'PAID',
      checkoutUrl: 'https://checkout.local/mock',
    });
  });

  it('throws ORDER_NOT_FOUND when order does not exist', async () => {
    mockOrderFindUnique.mockResolvedValue(null);
    await expect(
      service.initiatePayment({ orderId: 'ord-1', paymentMethod: 'MOCK' } as any, 'cust-1'),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
  });

  it('throws ORDER_NOT_FOUND when order belongs to another customer', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      customerId: 'other-customer',
      totalAmount: 100,
      paymentStatus: 'PENDING',
    });

    await expect(
      service.initiatePayment({ orderId: 'ord-1', paymentMethod: 'MOCK' } as any, 'cust-1'),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
  });

  it('throws ORDER_ALREADY_PAID when order is already paid', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      customerId: 'cust-1',
      totalAmount: 100,
      paymentStatus: 'PAID',
    });

    await expect(
      service.initiatePayment({ orderId: 'ord-1', paymentMethod: 'MOCK' } as any, 'cust-1'),
    ).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID', statusCode: 409 });
  });

  it('initiates payment and updates order status', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      customerId: 'cust-1',
      totalAmount: 150,
      paymentStatus: 'PENDING',
    });

    const result = await service.initiatePayment(
      { orderId: 'ord-1', paymentMethod: 'MOCK' } as any,
      'cust-1',
    );

    expect(result).toEqual({
      orderId: 'ord-1',
      paymentStatus: 'PAID',
      externalId: 'mock_ext_1',
      checkoutUrl: 'https://checkout.local/mock',
    });
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-1' },
        data: expect.objectContaining({
          paymentMethod: 'MOCK',
          paymentStatus: 'PAID',
          paymentExternalId: 'mock_ext_1',
          paidAt: expect.any(Date),
        }),
      }),
    );
  });

  it('throws PAYMENT_PROVIDER_NOT_FOUND when payment method is unsupported', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      customerId: 'cust-1',
      totalAmount: 150,
      paymentStatus: 'PENDING',
    });

    await expect(
      service.initiatePayment({ orderId: 'ord-1', paymentMethod: 'UNKNOWN' } as any, 'cust-1'),
    ).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_NOT_FOUND', statusCode: 400 });
  });

  it('updates order without paid status history when provider returns non-PAID', async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: 'ord-1',
      customerId: 'cust-1',
      totalAmount: 150,
      paymentStatus: 'PENDING',
    });
    mockInitiatePayment.mockResolvedValue({
      externalId: 'mock_ext_2',
      status: 'PENDING',
      checkoutUrl: 'https://checkout.local/mock-2',
    });

    const result = await service.initiatePayment(
      { orderId: 'ord-1', paymentMethod: 'MOCK' } as any,
      'cust-1',
    );

    expect(result).toMatchObject({ paymentStatus: 'PENDING', externalId: 'mock_ext_2' });
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'PENDING',
          paidAt: null,
        }),
      }),
    );
  });
});

describe('PaymentsService.processWebhook', () => {
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService();
    mockPaymentWebhookFindUnique.mockResolvedValue(null);
    mockPaymentWebhookUpsert.mockResolvedValue({ id: 'evt-1' });
    mockCacheSetNX.mockReturnValue(true);
    mockCacheDel.mockImplementation(() => {});
  });

  it('returns processed false when required payload fields are missing', async () => {
    const result = await service.processWebhook({ eventId: 'evt-1' });
    expect(result).toEqual({ processed: false });
  });

  it('returns processed true when event was already handled', async () => {
    mockPaymentWebhookFindUnique.mockResolvedValue({ id: 'evt-1' });
    const result = await service.processWebhook({ eventId: 'evt-1', externalId: 'ext-1', status: 'PAID' });
    expect(result).toEqual({ processed: true });
    expect(mockOrderFindFirst).not.toHaveBeenCalled();
  });

  it('returns processed true when webhook lock is not acquired', async () => {
    mockCacheSetNX.mockReturnValueOnce(false);

    const result = await service.processWebhook({ eventId: 'evt-2', externalId: 'ext-2', status: 'PAID' });

    expect(result).toEqual({ processed: true });
    expect(mockOrderFindFirst).not.toHaveBeenCalled();
  });

  it('returns processed false when external order cannot be found', async () => {
    mockOrderFindFirst.mockResolvedValue(null);
    const result = await service.processWebhook({ eventId: 'evt-1', externalId: 'ext-1', status: 'PAID' });
    expect(result).toEqual({ processed: false });
    expect(mockCacheDel).toHaveBeenCalled();
  });

  it('updates payment and marks webhook as processed', async () => {
    mockOrderFindFirst.mockResolvedValue({ id: 'ord-1', paymentStatus: 'PENDING', status: 'PENDING_PAYMENT' });
    mockProcessWebhook.mockResolvedValue({ externalId: 'ext-1', status: 'PAID', paidAt: new Date('2026-05-06T10:00:00Z') });

    const result = await service.processWebhook({ eventId: 'evt-1', externalId: 'ext-1', status: 'PAID' });

    expect(result).toEqual({ processed: true });
    expect(mockOrderUpdate).toHaveBeenCalled();
    expect(mockPaymentWebhookUpsert).toHaveBeenCalled();
    expect(mockCacheDel).toHaveBeenCalled();

    expect(mockPaymentWebhookUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventKey: 'payment:webhook:done:evt-1' },
        create: expect.objectContaining({
          eventKey: 'payment:webhook:done:evt-1',
          externalId: 'ext-1',
          status: 'PAID',
        }),
      }),
    );
    expect(mockPaymentWebhookUpsert).toHaveBeenCalledWith(
      expect.not.objectContaining({
        create: expect.objectContaining({ processedAt: expect.anything() }),
      }),
    );
  });

  it('updates webhook without appending status history when order status is already aligned', async () => {
    mockOrderFindFirst.mockResolvedValue({ id: 'ord-1', paymentStatus: 'PAID', status: 'PAID' });
    mockProcessWebhook.mockResolvedValue({ externalId: 'ext-1', status: 'PAID' });

    await service.processWebhook({ eventId: 'evt-3', externalId: 'ext-1', status: 'PAID' });

    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-1' },
        data: expect.objectContaining({
          status: 'PAID',
        }),
      }),
    );
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({
        data: expect.objectContaining({ statusHistory: expect.anything() }),
      }),
    );
  });

  it('maps webhook REFUNDED status and appends status history when order status changes', async () => {
    mockOrderFindFirst.mockResolvedValue({ id: 'ord-1', paymentStatus: 'PAID', status: 'PAID' });
    mockProcessWebhook.mockResolvedValue({ externalId: 'ext-1', status: 'REFUNDED' });

    await service.processWebhook({ eventId: 'evt-4', externalId: 'ext-1', status: 'REFUNDED' });

    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-1' },
        data: expect.objectContaining({
          paymentStatus: 'REFUNDED',
          status: 'REFUNDED',
          statusHistory: { create: { status: 'REFUNDED' } },
        }),
      }),
    );
  });
});
