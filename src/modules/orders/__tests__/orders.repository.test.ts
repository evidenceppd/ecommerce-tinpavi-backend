import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockOrderFindMany, mockOrderCount, mockOrderCreate, mockOrderUpdate, mockOrderFindUnique } = vi.hoisted(() => ({
  mockOrderFindMany: vi.fn(),
  mockOrderCount: vi.fn(),
  mockOrderCreate: vi.fn(),
  mockOrderUpdate: vi.fn(),
  mockOrderFindUnique: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    order: {
      findMany: mockOrderFindMany,
      count: mockOrderCount,
      create: mockOrderCreate,
      update: mockOrderUpdate,
      findUnique: mockOrderFindUnique,
    },
  },
}));

import { OrdersRepository } from '../orders.repository';

describe('OrdersRepository listing behavior', () => {
  let repository: OrdersRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new OrdersRepository();
    mockOrderFindMany.mockResolvedValue([]);
    mockOrderCount.mockResolvedValue(0);
    mockOrderCreate.mockResolvedValue({ id: 'ord-1', items: [] });
    mockOrderUpdate.mockResolvedValue({ id: 'ord-1' });
    mockOrderFindUnique.mockResolvedValue({ id: 'ord-1', statusHistory: [] });
  });

  it('caps admin list limit to 100', async () => {
    await repository.listAdmin({ page: 1, limit: 1000 });

    const args = mockOrderFindMany.mock.calls[0]?.[0] as { take: number };
    expect(args.take).toBe(100);
  });

  it('caps customer list limit to 100', async () => {
    await repository.listByCustomer('cust-1', { page: 1, limit: 500 });

    const args = mockOrderFindMany.mock.calls[0]?.[0] as { take: number };
    expect(args.take).toBe(100);
  });

  it('maps checkout payload into order.create with shipping, totals and item pricing fields', async () => {
    await repository.create({
      customerId: 'cust-1',
      subtotal: 200,
      shippingCost: 20,
      discountAmount: 10,
      totalAmount: 210,
      couponId: 'coupon-1',
      couponCode: 'SAVE10',
      shippingStreet: 'Rua A',
      shippingNumber: '10',
      shippingComplement: 'Apto 12',
      shippingNeighborhood: 'Centro',
      shippingCity: 'Sao Paulo',
      shippingState: 'SP',
      shippingZipCode: '01001000',
      shippingAddressRef: 'addr-1',
      items: [
        {
          productId: 'prod-1',
          variantId: 'var-1',
          quantity: 2,
          unitPrice: 100,
          totalPrice: 200,
        },
      ],
    });

    expect(mockOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust-1',
          subtotal: 200,
          shippingCost: 20,
          discountAmount: 10,
          totalAmount: 210,
          couponId: 'coupon-1',
          couponCode: 'SAVE10',
          shippingStreet: 'Rua A',
          shippingNumber: '10',
          shippingComplement: 'Apto 12',
          shippingNeighborhood: 'Centro',
          shippingCity: 'Sao Paulo',
          shippingState: 'SP',
          shippingZipCode: '01001000',
          shippingAddressRef: 'addr-1',
          items: {
            create: [
              expect.objectContaining({
                productId: 'prod-1',
                variantId: 'var-1',
                quantity: 2,
                unitPrice: 100,
                totalPrice: 200,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('records status history audit with changedBy when updating status', async () => {
    await repository.updateStatus('ord-1', 'PAID', 'admin-1');

    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-1' },
        data: {
          status: 'PAID',
          statusHistory: {
            create: { status: 'PAID', changedBy: 'admin-1' },
          },
        },
      }),
    );
  });

  it('loads status history ordered by changedAt in findById', async () => {
    await repository.findById('ord-1');

    expect(mockOrderFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-1' },
        include: expect.objectContaining({
          statusHistory: { orderBy: { changedAt: 'asc' } },
        }),
      }),
    );
  });
});
