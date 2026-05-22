import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockQuoteForCustomer,
  mockShippingQuoteSafeParse,
} = vi.hoisted(() => ({
  mockQuoteForCustomer: vi.fn(),
  mockShippingQuoteSafeParse: vi.fn(),
}));

vi.mock('../shipping.service', () => ({
  ShippingService: class ShippingService {
    quoteForCustomer = mockQuoteForCustomer;
  },
}));

vi.mock('../shipping.schemas', async () => {
  const actual = await vi.importActual<typeof import('../shipping.schemas')>('../shipping.schemas');
  return {
    ...actual,
    shippingQuoteSchema: { safeParse: mockShippingQuoteSafeParse },
  };
});

import { quoteShippingController } from '../shipping.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  return res;
}

describe('shipping.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShippingQuoteSafeParse.mockReturnValue({ success: true, data: { addressId: 'a1', items: [] } });
  });

  it('quoteShippingController returns 400 on validation failure', async () => {
    const req = { body: {}, user: { id: 'cust-1' } };
    const res = createResponse();
    mockShippingQuoteSafeParse.mockReturnValue({
      success: false,
      error: { flatten: () => ({ fieldErrors: { items: ['Required'] } }) },
    });

    await quoteShippingController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockQuoteForCustomer).not.toHaveBeenCalled();
  });

  it('quoteShippingController returns 200 on success', async () => {
    const req = { body: { addressId: 'a1', items: [] }, user: { id: 'cust-1' } };
    const res = createResponse();
    mockQuoteForCustomer.mockResolvedValue({ options: [] });

    await quoteShippingController(req as any, res as any);

    expect(mockQuoteForCustomer).toHaveBeenCalledWith({ addressId: 'a1', items: [] }, 'cust-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('quoteShippingController maps typed service error to status/code', async () => {
    const req = { body: { addressId: 'a1', items: [] }, user: { id: 'cust-1' } };
    const res = createResponse();
    mockQuoteForCustomer.mockRejectedValue({
      statusCode: 404,
      code: 'SHIPPING_ADDRESS_NOT_FOUND',
      message: 'Address not found',
    });

    await quoteShippingController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'SHIPPING_ADDRESS_NOT_FOUND' }),
      }),
    );
  });
});
