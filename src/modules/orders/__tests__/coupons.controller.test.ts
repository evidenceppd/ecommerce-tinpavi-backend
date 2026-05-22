import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreate,
  mockList,
  mockGetById,
  mockUpdate,
  mockDelete,
  mockCreateCouponSchemaParse,
  mockUpdateCouponSchemaParse,
  mockListCouponsQuerySchemaParse,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockList: vi.fn(),
  mockGetById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockCreateCouponSchemaParse: vi.fn(),
  mockUpdateCouponSchemaParse: vi.fn(),
  mockListCouponsQuerySchemaParse: vi.fn(),
}));

vi.mock('../coupons.service', () => ({
  CouponsService: class CouponsService {
    create = mockCreate;
    list = mockList;
    getById = mockGetById;
    update = mockUpdate;
    delete = mockDelete;
  },
}));

vi.mock('../coupons.schemas', async () => {
  const actual = await vi.importActual<typeof import('../coupons.schemas')>('../coupons.schemas');

  return {
    ...actual,
    createCouponSchema: { parse: mockCreateCouponSchemaParse },
    updateCouponSchema: { parse: mockUpdateCouponSchemaParse },
    listCouponsQuerySchema: { parse: mockListCouponsQuerySchemaParse },
  };
});

import {
  createCouponController,
  deleteCouponController,
  getCouponController,
  listCouponsController,
} from '../coupons.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
}

describe('coupons.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCouponSchemaParse.mockImplementation((body: unknown) => body);
    mockUpdateCouponSchemaParse.mockImplementation((body: unknown) => body);
    mockListCouponsQuerySchemaParse.mockImplementation((query: unknown) => query);
  });

  it('createCouponController returns 201 with created coupon', async () => {
    const req = { body: { code: 'PROMO10' } };
    const res = createResponse();
    mockCreate.mockResolvedValue({ id: 'coupon-1', code: 'PROMO10' });

    await createCouponController(req as any, res as any);

    expect(mockCreateCouponSchemaParse).toHaveBeenCalledWith(req.body);
    expect(mockCreate).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('listCouponsController returns paginated payload', async () => {
    const req = { query: { page: '1', limit: '10' } };
    const res = createResponse();
    mockList.mockResolvedValue({ items: [{ id: 'coupon-1' }], total: 1, page: 1, limit: 10 });

    await listCouponsController(req as any, res as any);

    expect(mockListCouponsQuerySchemaParse).toHaveBeenCalledWith(req.query);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meta: expect.objectContaining({ total: 1, page: 1, limit: 10 }),
      }),
    );
  });

  it('getCouponController maps COUPON_NOT_FOUND to 404', async () => {
    const req = { params: { id: 'missing' } };
    const res = createResponse();
    mockGetById.mockRejectedValue(new Error('COUPON_NOT_FOUND'));

    await getCouponController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'COUPON_NOT_FOUND' }),
      }),
    );
  });

  it('deleteCouponController returns 204 on success', async () => {
    const req = { params: { id: 'coupon-1' } };
    const res = createResponse();
    mockDelete.mockResolvedValue(undefined);

    await deleteCouponController(req as any, res as any);

    expect(mockDelete).toHaveBeenCalledWith('coupon-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
  });
});
