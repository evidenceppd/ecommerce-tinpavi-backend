import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTransaction, mockCartItemUpsert, mockCartItemUpdate, mockCartItemDeleteMany, mockCartUpdate } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockCartItemUpsert: vi.fn(),
  mockCartItemUpdate: vi.fn(),
  mockCartItemDeleteMany: vi.fn(),
  mockCartUpdate: vi.fn(),
}));

vi.mock('@/shared/infra/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

import { CartRepository } from '../cart.repository';

describe('CartRepository', () => {
  let repository: CartRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation((callback) =>
      callback({
        cartItem: {
          upsert: mockCartItemUpsert,
          update: mockCartItemUpdate,
          deleteMany: mockCartItemDeleteMany,
        },
        cart: {
          update: mockCartUpdate,
        },
      }),
    );
    repository = new CartRepository();
  });

  it('touches cart updatedAt when upserting an item', async () => {
    mockCartItemUpsert.mockResolvedValue({ id: 'item-1' });

    await repository.upsertItem('cart-1', 'product-1', 2, 'variant-1');

    expect(mockCartItemUpsert).toHaveBeenCalledWith({
      where: { cartId_productId: { cartId: 'cart-1', productId: 'product-1' } },
      create: { cartId: 'cart-1', productId: 'product-1', quantity: 2, variantId: 'variant-1' },
      update: { quantity: 2, variantId: 'variant-1' },
    });
    expect(mockCartUpdate).toHaveBeenCalledWith({
      where: { id: 'cart-1' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('touches cart updatedAt when changing quantity, removing and clearing items', async () => {
    mockCartItemUpdate.mockResolvedValue({ id: 'item-1' });
    mockCartItemDeleteMany.mockResolvedValue({ count: 1 });

    await repository.updateQuantity('cart-1', 'product-1', 3);
    await repository.removeItem('cart-1', 'product-1', 'variant-1');
    await repository.clearItems('cart-1');

    expect(mockCartItemDeleteMany).toHaveBeenNthCalledWith(1, {
      where: { cartId: 'cart-1', productId: 'product-1', variantId: 'variant-1' },
    });
    expect(mockCartItemDeleteMany).toHaveBeenNthCalledWith(2, {
      where: { cartId: 'cart-1' },
    });
    expect(mockCartUpdate).toHaveBeenCalledTimes(3);
    expect(mockCartUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'cart-1' },
      data: { updatedAt: expect.any(Date) },
    });
    expect(mockCartUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'cart-1' },
      data: { updatedAt: expect.any(Date) },
    });
    expect(mockCartUpdate).toHaveBeenNthCalledWith(3, {
      where: { id: 'cart-1' },
      data: { updatedAt: expect.any(Date) },
    });
  });
});
