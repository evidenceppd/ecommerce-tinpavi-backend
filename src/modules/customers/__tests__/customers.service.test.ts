import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindById,
  mockUpdateProfile,
  mockCreateAddress,
  mockFindAddressesByCustomerId,
  mockFindAddressById,
  mockDeleteAddress,
  mockListOrderHistoryByCustomer,
  mockListAdminCustomers,
  mockFindAdminById,
  mockUpdateCustomerAsAdmin,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockUpdateProfile: vi.fn(),
  mockCreateAddress: vi.fn(),
  mockFindAddressesByCustomerId: vi.fn(),
  mockFindAddressById: vi.fn(),
  mockDeleteAddress: vi.fn(),
  mockListOrderHistoryByCustomer: vi.fn(),
  mockListAdminCustomers: vi.fn(),
  mockFindAdminById: vi.fn(),
  mockUpdateCustomerAsAdmin: vi.fn(),
}));

vi.mock('../customers.repository', () => ({
  CustomersRepository: class CustomersRepository {
    findById = mockFindById;
    updateProfile = mockUpdateProfile;
    createAddress = mockCreateAddress;
    findAddressesByCustomerId = mockFindAddressesByCustomerId;
    findAddressById = mockFindAddressById;
    deleteAddress = mockDeleteAddress;
    listOrderHistoryByCustomer = mockListOrderHistoryByCustomer;
    listAdminCustomers = mockListAdminCustomers;
    findAdminById = mockFindAdminById;
    updateCustomerAsAdmin = mockUpdateCustomerAsAdmin;
  },
}));

import { CustomersService } from '../customers.service';

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust-1',
    email: 'user@example.com',
    name: 'User',
    phone: null,
    role: 'CUSTOMER',
    password: 'secret-hash',
    createdAt: new Date('2026-05-06T10:00:00.000Z'),
    updatedAt: new Date('2026-05-06T10:00:00.000Z'),
    ...overrides,
  };
}

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAddressesByCustomerId.mockResolvedValue([]);
    service = new CustomersService();
  });

  it('throws 404 when profile does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(service.getProfile('missing')).rejects.toMatchObject({
      message: 'Customer not found',
      statusCode: 404,
    });
  });

  it('returns profile without password', async () => {
    mockFindById.mockResolvedValue(makeCustomer());
    const result = await service.getProfile('cust-1');
    expect(result).not.toHaveProperty('password');
    expect(result).toMatchObject({ id: 'cust-1', email: 'user@example.com', address: null });
  });

  it('returns formatted default address with profile', async () => {
    mockFindById.mockResolvedValue(makeCustomer());
    mockFindAddressesByCustomerId.mockResolvedValue([
      {
        id: 'addr-1',
        customerId: 'cust-1',
        street: 'Av. Paulista',
        number: '1000',
        complement: null,
        district: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01310100',
        country: 'BR',
        isDefault: true,
      },
    ]);

    const result = await service.getProfile('cust-1');

    expect(result.address).toBe('Av. Paulista, 1000 - Bela Vista, Sao Paulo - SP - 01310100');
    expect(result.defaultAddress).toMatchObject({ id: 'addr-1' });
  });

  it('throws 404 when updating non-existing profile', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(service.updateProfile('missing', { name: 'New' } as any)).rejects.toMatchObject({
      message: 'Customer not found',
      statusCode: 404,
    });
  });

  it('updates profile and strips password', async () => {
    mockFindById.mockResolvedValue(makeCustomer());
    mockUpdateProfile.mockResolvedValue(makeCustomer({ name: 'Updated', company: 'Empresa' }));
    const result = await service.updateProfile('cust-1', { name: 'Updated', company: 'Empresa' } as any);
    expect(mockUpdateProfile).toHaveBeenCalledWith('cust-1', { name: 'Updated', company: 'Empresa' });
    expect(result).not.toHaveProperty('password');
    expect(result).toMatchObject({ id: 'cust-1', name: 'Updated', company: 'Empresa' });
  });

  it('throws 404 when deleting unknown address', async () => {
    mockFindAddressById.mockResolvedValue(null);
    await expect(service.deleteAddress('cust-1', 'addr-404')).rejects.toMatchObject({
      message: 'Address not found',
      statusCode: 404,
    });
  });

  it('deletes address when address belongs to customer', async () => {
    mockFindAddressById.mockResolvedValue({ id: 'addr-1' });
    mockDeleteAddress.mockResolvedValue(undefined);

    await service.deleteAddress('cust-1', 'addr-1');

    expect(mockDeleteAddress).toHaveBeenCalledWith('addr-1', 'cust-1');
  });

  it('throws 404 when admin customer lookup fails', async () => {
    mockFindAdminById.mockResolvedValue(null);
    await expect(service.getAdminCustomer('cust-404')).rejects.toMatchObject({
      message: 'Customer not found',
      statusCode: 404,
    });
  });

  it('updates customer as admin after existence check', async () => {
    mockFindAdminById.mockResolvedValue({ id: 'cust-1', email: 'u@example.com' });
    mockUpdateCustomerAsAdmin.mockResolvedValue({ id: 'cust-1', role: 'ADMIN' });

    const result = await service.updateCustomerAsAdmin('cust-1', { role: 'ADMIN' } as any);

    expect(mockFindAdminById).toHaveBeenCalledWith('cust-1');
    expect(mockUpdateCustomerAsAdmin).toHaveBeenCalledWith('cust-1', { role: 'ADMIN' });
    expect(result).toMatchObject({ id: 'cust-1', role: 'ADMIN' });
  });

  it('creates and lists addresses through repository delegates', async () => {
    mockCreateAddress.mockResolvedValue({ id: 'addr-1', label: 'Casa', city: 'Sao Paulo' });
    mockFindAddressesByCustomerId.mockResolvedValue([{ id: 'addr-1' }]);

    const created = await service.createAddress('cust-1', { label: 'Casa', city: 'Sao Paulo' } as any);
    const listed = await service.listAddresses('cust-1');

    expect(mockCreateAddress).toHaveBeenCalledWith('cust-1', { label: 'Casa', city: 'Sao Paulo' });
    expect(created).toMatchObject({ id: 'addr-1' });
    expect(created).toMatchObject({ label: 'Casa' });
    expect(mockFindAddressesByCustomerId).toHaveBeenCalledWith('cust-1');
    expect(listed).toEqual([{ id: 'addr-1' }]);
  });

  it('returns order history and admin list via repository delegates', async () => {
    mockListOrderHistoryByCustomer.mockResolvedValue([{ id: 'ord-1' }]);
    mockListAdminCustomers.mockResolvedValue({ items: [{ id: 'cust-1' }], total: 1 });

    const history = await service.getOrderHistory('cust-1');
    const adminList = await service.listAdminCustomers({ page: 1, limit: 10 } as any);

    expect(mockListOrderHistoryByCustomer).toHaveBeenCalledWith('cust-1');
    expect(history).toEqual([{ id: 'ord-1' }]);
    expect(mockListAdminCustomers).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(adminList).toEqual({ items: [{ id: 'cust-1' }], total: 1 });
  });

  it('returns admin customer payload when found', async () => {
    mockFindAdminById.mockResolvedValue({ id: 'cust-1', email: 'user@example.com', addresses: [] });

    const result = await service.getAdminCustomer('cust-1');

    expect(result).toMatchObject({ id: 'cust-1', email: 'user@example.com' });
  });
});
