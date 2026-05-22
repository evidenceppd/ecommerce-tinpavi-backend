import { prisma } from '@/shared/infra/prisma';

export class CartRepository {
  getOrCreate(customerId: string) {
    return prisma.cart.upsert({
      where: { customerId },
      create: { customerId },
      update: {},
      include: { items: { include: { product: true }, orderBy: { createdAt: 'asc' } } },
    });
  }

  getWithItems(customerId: string) {
    return prisma.cart.findUnique({
      where: { customerId },
      include: { items: { include: { product: true }, orderBy: { createdAt: 'asc' } } },
    });
  }

  upsertItem(cartId: string, productId: string, quantity: number, variantId?: string) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.upsert({
        where: { cartId_productId: { cartId, productId } },
        create: { cartId, productId, quantity, variantId: variantId ?? null },
        update: { quantity, variantId: variantId ?? null },
      });
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
      return item;
    });
  }

  updateQuantity(cartId: string, productId: string, quantity: number) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.update({
        where: { cartId_productId: { cartId, productId } },
        data: { quantity },
      });
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
      return item;
    });
  }

  removeItem(cartId: string, productId: string, variantId?: string) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.cartItem.deleteMany({
        where: { cartId, productId, ...(variantId ? { variantId } : {}) },
      });
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
      return result;
    });
  }

  clearItems(cartId: string) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.cartItem.deleteMany({ where: { cartId } });
      await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
      return result;
    });
  }
}
