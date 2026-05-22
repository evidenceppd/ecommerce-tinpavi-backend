import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckout,
  mockListMyOrders,
  mockGetOrderAsCustomer,
  mockCancelAsCustomer,
  mockListAdminOrders,
  mockGetOrderAsAdmin,
  mockUpdateStatusAsAdmin,
  mockCheckoutSchemaParse,
  mockUpdateOrderStatusSchemaParse,
  mockListOrdersQuerySchemaParse,
  mockWithAbort,
  mockParseFieldsParam,
  mockSelectFields,
} = vi.hoisted(() => ({
  mockCheckout: vi.fn(),
  mockListMyOrders: vi.fn(),
  mockGetOrderAsCustomer: vi.fn(),
  mockCancelAsCustomer: vi.fn(),
  mockListAdminOrders: vi.fn(),
  mockGetOrderAsAdmin: vi.fn(),
  mockUpdateStatusAsAdmin: vi.fn(),
  mockCheckoutSchemaParse: vi.fn(),
  mockUpdateOrderStatusSchemaParse: vi.fn(),
  mockListOrdersQuerySchemaParse: vi.fn(),
  mockWithAbort: vi.fn(),
  mockParseFieldsParam: vi.fn(),
  mockSelectFields: vi.fn(),
}));

vi.mock('../orders.service', () => ({
  OrdersService: class OrdersService {
    checkout = mockCheckout;
    listMyOrders = mockListMyOrders;
    getOrderAsCustomer = mockGetOrderAsCustomer;
    cancelAsCustomer = mockCancelAsCustomer;
    listAdminOrders = mockListAdminOrders;
    getOrderAsAdmin = mockGetOrderAsAdmin;
    updateStatusAsAdmin = mockUpdateStatusAsAdmin;
  },
}));

vi.mock('../orders.schemas', async () => {
  const actual = await vi.importActual<typeof import('../orders.schemas')>('../orders.schemas');

  return {
    ...actual,
    checkoutSchema: { parse: mockCheckoutSchemaParse },
    updateOrderStatusSchema: { parse: mockUpdateOrderStatusSchemaParse },
    listOrdersQuerySchema: { parse: mockListOrdersQuerySchemaParse },
  };
});

vi.mock('@/shared/infra/with-abort', () => ({
  withAbort: mockWithAbort,
}));

vi.mock('@/shared/http/response-fields', () => ({
  parseFieldsParam: mockParseFieldsParam,
  selectFields: mockSelectFields,
}));

import {
  adminListOrdersController,
  checkoutController,
  getMyOrderController,
  listMyOrdersController,
} from '../orders.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
}

describe('orders.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAbort.mockImplementation(async (_signal: unknown, promise: Promise<unknown>) => promise);
    mockParseFieldsParam.mockReturnValue(undefined);
    mockSelectFields.mockImplementation((payload: unknown) => payload);
    mockCheckoutSchemaParse.mockImplementation((body: unknown) => body);
    mockUpdateOrderStatusSchemaParse.mockImplementation((body: unknown) => body);
    mockListOrdersQuerySchemaParse.mockImplementation((query: unknown) => query);
  });

  it('checkoutController returns 201 with order payload', async () => {
    const req = { body: { items: [] }, user: { id: 'cust-1' }, abortSignal: undefined };
    const res = createResponse();
    mockCheckout.mockResolvedValue({ id: 'order-1' });

    await checkoutController(req as any, res as any);

    expect(mockCheckoutSchemaParse).toHaveBeenCalledWith(req.body);
    expect(mockCheckout).toHaveBeenCalledWith(req.body, 'cust-1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('checkoutController maps SHIPPING_QUOTE_INVALID to 422', async () => {
    const req = { body: { items: [] }, user: { id: 'cust-1' }, abortSignal: undefined };
    const res = createResponse();
    mockCheckout.mockRejectedValue(new Error('SHIPPING_QUOTE_INVALID'));

    await checkoutController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'SHIPPING_QUOTE_INVALID' }),
      }),
    );
  });

  it('listMyOrdersController applies fields selection and pagination meta', async () => {
    const req = {
      query: { page: '2', limit: '5', fields: 'id,status' },
      user: { id: 'cust-1' },
      abortSignal: undefined,
    };
    const res = createResponse();
    mockListMyOrders.mockResolvedValue({
      items: [{ id: 'order-1', status: 'PENDING' }],
      total: 11,
      page: 2,
      limit: 5,
    });
    mockParseFieldsParam.mockReturnValue(['id', 'status']);
    mockSelectFields.mockReturnValue([{ id: 'order-1', status: 'PENDING' }]);

    await listMyOrdersController(req as any, res as any);

    expect(mockListMyOrders).toHaveBeenCalledWith('cust-1', { page: 2, limit: 5 });
    expect(mockParseFieldsParam).toHaveBeenCalledWith('id,status');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meta: expect.objectContaining({ total: 11, page: 2, limit: 5 }),
      }),
    );
  });

  it('getMyOrderController maps ORDER_NOT_FOUND to 404', async () => {
    const req = {
      params: { id: 'missing' },
      query: {},
      user: { id: 'cust-1' },
      abortSignal: undefined,
    };
    const res = createResponse();
    mockGetOrderAsCustomer.mockRejectedValue(new Error('ORDER_NOT_FOUND'));

    await getMyOrderController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'ORDER_NOT_FOUND' }),
      }),
    );
  });

  it('adminListOrdersController uses parsed query and returns payload', async () => {
    const req = { query: { page: '1', limit: '20', status: 'PENDING' } };
    const res = createResponse();
    mockListOrdersQuerySchemaParse.mockReturnValue({ page: 1, limit: 20, status: 'PENDING' });
    mockListAdminOrders.mockResolvedValue({ items: [{ id: 'o-1' }], total: 1, page: 1, limit: 20 });

    await adminListOrdersController(req as any, res as any);

    expect(mockListOrdersQuerySchemaParse).toHaveBeenCalledWith(req.query);
    expect(mockListAdminOrders).toHaveBeenCalledWith({ page: 1, limit: 20, status: 'PENDING' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
