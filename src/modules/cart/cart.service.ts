import { prisma } from '@/shared/infra/prisma';
import { CartRepository } from './cart.repository';
import type { Cart, CartItem, Product } from '@/generated/prisma/client';

type CartWithItems = Cart & {
  items: (CartItem & { product: Product; variantId?: string | null })[];
};

const cartRepo = new CartRepository();

function formatCart(cart: CartWithItems) {
  const items = cart.items.map((item) => {
    const images = Array.isArray(item.product.carousel_image)
      ? (item.product.carousel_image as string[])
      : [];
    let variantName: string | undefined;
    if (item.variantId && Array.isArray(item.product.variants)) {
      const variant = (item.product.variants as Array<{ id?: string; attributes?: unknown }>).find((candidate) => candidate.id === item.variantId);
      if (variant?.attributes && typeof variant.attributes === 'object') {
        const parts = Object.entries(variant.attributes as Record<string, unknown>)
          .filter(([, value]) => value != null && value !== '')
          .map(([key, value]) => `${key}: ${String(value)}`);
        variantName = parts.join(' · ') || undefined;
      } else if (variant?.attributes) {
        variantName = String(variant.attributes);
      }
    }

    return {
      productId: item.productId,
      variantId: item.variantId ?? undefined,
      variantName,
      name: item.product.title,
      code: item.product.code,
      quantity: item.quantity,
      unitPrice: item.product.pricing,
      pixPrice: item.product.pix_pricing,
      total: item.product.pricing * item.quantity,
      image: images[0] ?? null,
      stock: item.product.quantity_stock,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return { id: cart.id, items, itemCount, subtotal };
}

export class CartService {
  async getCart(customerId: string) {
    const cart = await cartRepo.getOrCreate(customerId);
    return formatCart(cart);
  }

  async addItem(customerId: string, productId: string, quantity: number, variantId?: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw Object.assign(new Error('Produto não encontrado'), { statusCode: 404 });
    }
    if (product.quantity_stock < quantity) {
      throw Object.assign(
        new Error(`Estoque insuficiente — disponível: ${product.quantity_stock}`),
        { statusCode: 422 },
      );
    }

    const cart = await cartRepo.getOrCreate(customerId);
    const existing = cart.items.find((i) => i.productId === productId);
    const newQty = (existing?.quantity ?? 0) + quantity;

    if (product.quantity_stock < newQty) {
      throw Object.assign(
        new Error(`Estoque insuficiente — disponível: ${product.quantity_stock}`),
        { statusCode: 422 },
      );
    }

    await cartRepo.upsertItem(cart.id, productId, newQty, variantId);
    return this.getCart(customerId);
  }

  async setItemQuantity(customerId: string, productId: string, quantity: number) {
    const cart = await cartRepo.getWithItems(customerId);
    if (!cart) throw Object.assign(new Error('Carrinho não encontrado'), { statusCode: 404 });

    const item = cart.items.find((i) => i.productId === productId);
    if (!item) throw Object.assign(new Error('Item não encontrado no carrinho'), { statusCode: 404 });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (product && product.quantity_stock < quantity) {
      throw Object.assign(
        new Error(`Estoque insuficiente — disponível: ${product.quantity_stock}`),
        { statusCode: 422 },
      );
    }

    await cartRepo.updateQuantity(cart.id, productId, quantity);
    return this.getCart(customerId);
  }

  async removeItem(customerId: string, productId: string, variantId?: string) {
    const cart = await cartRepo.getWithItems(customerId);
    if (cart) await cartRepo.removeItem(cart.id, productId, variantId);
    return this.getCart(customerId);
  }

  async clearCart(customerId: string) {
    const cart = await cartRepo.getWithItems(customerId);
    if (cart) await cartRepo.clearItems(cart.id);
    return this.getCart(customerId);
  }
}
