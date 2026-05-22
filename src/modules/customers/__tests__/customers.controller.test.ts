import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetProfile,
  mockUpdateProfile,
  mockListAddresses,
  mockCreateAddress,
  mockDeleteAddress,
  mockGetOrderHistory,
  mockListAdminCustomers,
  mockGetAdminCustomer,
  mockUpdateCustomerAsAdmin,
  mockCreateCustomerAsAdmin,
  mockDeleteCustomerAsAdmin,
  mockAdminListCustomersQueryParse,
} = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockUpdateProfile: vi.fn(),
  mockListAddresses: vi.fn(),
  mockCreateAddress: vi.fn(),
  mockDeleteAddress: vi.fn(),
  mockGetOrderHistory: vi.fn(),
  mockListAdminCustomers: vi.fn(),
  mockGetAdminCustomer: vi.fn(),
  mockUpdateCustomerAsAdmin: vi.fn(),
  mockCreateCustomerAsAdmin: vi.fn(),
  mockDeleteCustomerAsAdmin: vi.fn(),
  mockAdminListCustomersQueryParse: vi.fn(),
}));

vi.mock('../customers.schemas', async () => {
  const actual = await vi.importActual<typeof import('../customers.schemas')>('../customers.schemas');

  return {
    ...actual,
    adminListCustomersQuerySchema: {
      parse: mockAdminListCustomersQueryParse,
    },
  };
});

vi.mock('../customers.service', () => ({
  CustomersService: class CustomersService {
    getProfile = mockGetProfile;
    updateProfile = mockUpdateProfile;
    listAddresses = mockListAddresses;
    createAddress = mockCreateAddress;
    deleteAddress = mockDeleteAddress;
    getOrderHistory = mockGetOrderHistory;
    listAdminCustomers = mockListAdminCustomers;
    getAdminCustomer = mockGetAdminCustomer;
    updateCustomerAsAdmin = mockUpdateCustomerAsAdmin;
    createCustomerAsAdmin = mockCreateCustomerAsAdmin;
    deleteCustomerAsAdmin = mockDeleteCustomerAsAdmin;
  },
}));

import {
  adminCreateCustomerController,
  adminDeleteCustomerController,
  adminListCustomersController,
  getProfileController,
  listAddressesController,
} from '../customers.controller';

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
}

describe('customers.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminListCustomersQueryParse.mockReturnValue({ page: 1, limit: 10, search: undefined });
  });

  it('getProfileController returns 401 when subject is not CUSTOMER', async () => {
    const req = { user: { id: 'actor-1', role: 'ADMIN', subjectType: 'USER' } };
    const res = createResponse();

    await getProfileController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    );
  });

  it('getProfileController returns 200 with profile payload', async () => {
    const req = { user: { id: 'cust-1', role: 'CUSTOMER', subjectType: 'CUSTOMER' } };
    const res = createResponse();
    mockGetProfile.mockResolvedValue({ id: 'cust-1', email: 'c@x.com' });

    await getProfileController(req as any, res as any);

    expect(mockGetProfile).toHaveBeenCalledWith('cust-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('listAddressesController returns 200 with address list for authenticated customer', async () => {
    const req = { user: { id: 'cust-1', role: 'CUSTOMER', subjectType: 'CUSTOMER' } };
    const res = createResponse();
    mockListAddresses.mockResolvedValue([{ id: 'addr-1' }]);

    await listAddressesController(req as any, res as any);

    expect(mockListAddresses).toHaveBeenCalledWith('cust-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('adminListCustomersController returns paginated metadata', async () => {
    const req = { query: { page: '1', limit: '10' } };
    const res = createResponse();
    mockListAdminCustomers.mockResolvedValue({
      items: [{ id: 'cust-1' }],
      total: 25,
    });

    await adminListCustomersController(req as any, res as any);

    expect(mockAdminListCustomersQueryParse).toHaveBeenCalledWith(req.query);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meta: expect.objectContaining({ total: 25, totalPages: 3, page: 1, limit: 10 }),
      }),
    );
  });

  it('adminCreateCustomerController maps duplicate email to CONFLICT', async () => {
    const req = { body: { email: 'dup@example.com' } };
    const res = createResponse();
    mockCreateCustomerAsAdmin.mockRejectedValue(
      Object.assign(new Error('Customer email already in use'), { statusCode: 409 }),
    );

    await adminCreateCustomerController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'CONFLICT' }),
      }),
    );
  });

  it('adminDeleteCustomerController returns 401 when request has no actor', async () => {
    const req = { params: { id: 'cust-1' }, user: undefined };
    const res = createResponse();

    await adminDeleteCustomerController(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockDeleteCustomerAsAdmin).not.toHaveBeenCalled();
  });

  it('adminDeleteCustomerController returns 204 on success', async () => {
    const req = { params: { id: 'cust-1' }, user: { id: 'admin-1', role: 'ADMIN' } };
    const res = createResponse();
    mockDeleteCustomerAsAdmin.mockResolvedValue(undefined);

    await adminDeleteCustomerController(req as any, res as any);

    expect(mockDeleteCustomerAsAdmin).toHaveBeenCalledWith('cust-1', 'admin-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
  });
});
