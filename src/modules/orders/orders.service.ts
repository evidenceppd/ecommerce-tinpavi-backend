import { prisma } from '@/shared/infra/prisma';
import { cache } from '@/shared/infra/memory-cache';
import { cachePrefixes } from '@/shared/infra/cache-keys';
import type { Order, OrderItem } from '@/generated/prisma/client';
import type {
  CheckoutDto,
  CheckoutShippingAddressDto,
  UpdateOrderStatusDto,
  ListOrdersQueryDto,
  ValidateCouponDto,
} from './orders.schemas';
import { OrdersRepository } from './orders.repository';
import { CouponsService } from './coupons.service';

const repo = new OrdersRepository();
const couponsService = new CouponsService();

const SHIPPING_SELECTION_KEY_PREFIX = 'shipping:selection:';

type ShippingSelectionSnapshot = {
  customerId: string;
  shippingAddressId: string | null;
  shippingAddress?: CheckoutShippingAddressDto;
  price: number;
  carrier: string;
  service: string;
  estimatedDays: number;
};

type NormalizedShippingAddress = {
  zipCode: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  country: string;
};

type ResolvedCheckoutAddress = {
  shippingAddressId: string | null;
  shippingAddress: NormalizedShippingAddress;
  fromSavedAddress: boolean;
};

function normalizeZipCode(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeShippingAddress(address: CheckoutShippingAddressDto): NormalizedShippingAddress {
  return {
    zipCode: normalizeZipCode(address.zipCode),
    street: address.street.trim(),
    number: address.number.trim(),
    complement: address.complement?.trim() || null,
    district: address.district.trim(),
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
    country: address.country.trim().toUpperCase(),
  };
}

function addressesMatch(a: NormalizedShippingAddress, b: NormalizedShippingAddress): boolean {
  return (
    a.zipCode === b.zipCode &&
    a.street === b.street &&
    a.number === b.number &&
    (a.complement ?? null) === (b.complement ?? null) &&
    a.district === b.district &&
    a.city === b.city &&
    a.state === b.state &&
    a.country === b.country
  );
}

export class OrdersService {
  // ---- Checkout ----

  async validateCouponForCheckout(
    dto: ValidateCouponDto,
    customerId: string,
  ): Promise<{
    code: string;
    type: string;
    value: number;
    discountAmount: number;
    totalAmount: number;
  }> {
    const coupon = await couponsService.validateCoupon(dto.code, customerId);
    const base = dto.subtotal + dto.shippingCost;
    const discountAmount = coupon.type === 'PERCENTAGE'
      ? (base * Number(coupon.value)) / 100
      : Number(coupon.value);

    if (discountAmount >= base) {
      throw new Error('COUPON_EXCEEDS_ORDER_TOTAL');
    }

    return {
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discountAmount,
      totalAmount: base - discountAmount,
    };
  }

  async checkout(dto: CheckoutDto, customerId: string): Promise<Order & { items: OrderItem[] }> {
    // 1. Resolve shipping address from saved address or inline payload
    const resolvedAddress = await this.resolveCheckoutAddress(dto, customerId);

    // 2. Resolve selected shipping quote from server-side snapshot
    const quoteRaw = cache.get<ShippingSelectionSnapshot>(`${SHIPPING_SELECTION_KEY_PREFIX}${dto.quoteId}`);
    if (!quoteRaw) throw new Error('SHIPPING_QUOTE_INVALID');

    let shippingSelection: ShippingSelectionSnapshot;
    try {
      shippingSelection = quoteRaw;
    } catch {
      throw new Error('SHIPPING_QUOTE_INVALID');
    }

    if (shippingSelection.customerId !== customerId) {
      throw new Error('SHIPPING_QUOTE_INVALID');
    }

    if (resolvedAddress.fromSavedAddress) {
      if (shippingSelection.shippingAddressId !== resolvedAddress.shippingAddressId) {
        throw new Error('SHIPPING_QUOTE_INVALID');
      }
    } else {
      if (!shippingSelection.shippingAddress) {
        throw new Error('SHIPPING_QUOTE_INVALID');
      }

      const selectionAddress = normalizeShippingAddress(shippingSelection.shippingAddress);
      if (!addressesMatch(selectionAddress, resolvedAddress.shippingAddress)) {
        throw new Error('SHIPPING_QUOTE_INVALID');
      }
    }

    // 3. Resolve items: load product/variant, resolve unit price
    type ResolvedItem = {
      productId: string;
      variantId: string | null;
      variantName: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    };

    const resolvedItems: ResolvedItem[] = [];
    for (const item of dto.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, pricing: true, quantity_stock: true, variants: true },
      });
      if (!product) throw new Error('PRODUCT_NOT_FOUND');

      const unitPrice = Number(product.pricing);

      let variantName: string | null = null;
      if (item.variantId && Array.isArray(product.variants)) {
        const variants = product.variants as Array<{ id?: string; attributes?: unknown }>;
        const found = variants.find((v) => v.id === item.variantId);
        if (found?.attributes && typeof found.attributes === 'object') {
          const parts = Object.entries(found.attributes as Record<string, unknown>)
            .filter(([, value]) => value != null && value !== '')
            .map(([key, value]) => `${key}: ${String(value)}`);
          variantName = parts.length > 0 ? parts.join(' | ') : null;
        } else if (found?.attributes) {
          variantName = String(found.attributes);
        }
      }

      resolvedItems.push({
        productId: item.productId,
        variantId: item.variantId ?? null,
        variantName,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      });
    }

    // 4. Compute subtotal
    const subtotal = resolvedItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const shippingCost = Number(shippingSelection.price);

    // 5. Validate coupon (if provided)
    let coupon = null;
    if (dto.couponCode) {
      coupon = await couponsService.validateCoupon(dto.couponCode, customerId);
    }

    // 6. Apply D-01 discount calculation: base = subtotal + shippingCost
    const base = subtotal + shippingCost;
    let discountAmount = 0;
    if (coupon) {
      if (coupon.type === 'PERCENTAGE') {
        discountAmount = (base * Number(coupon.value)) / 100;
      } else {
        discountAmount = Number(coupon.value);
      }
    }

    // 7. D-03: coupon discount cannot exceed or equal order total
    if (coupon && discountAmount >= base) {
      throw new Error('COUPON_EXCEEDS_ORDER_TOTAL');
    }

    // 8. Final total
    const totalAmount = base - discountAmount;

    // 9. Atomic transaction: guarded stock decrement + guarded coupon increment + create order
    const createdOrder = await prisma.$transaction(async (tx) => {
      let shippingAddressRef = resolvedAddress.shippingAddressId;

      if (!resolvedAddress.fromSavedAddress && dto.saveAddress) {
        if (dto.setAsDefaultAddress) {
          await tx.address.updateMany({
            where: { customerId },
            data: { isDefault: false },
          });
        }

        const savedAddress = await tx.address.create({
          data: {
            customerId,
            zipCode: resolvedAddress.shippingAddress.zipCode,
            street: resolvedAddress.shippingAddress.street,
            number: resolvedAddress.shippingAddress.number,
            complement: resolvedAddress.shippingAddress.complement,
            district: resolvedAddress.shippingAddress.district,
            city: resolvedAddress.shippingAddress.city,
            state: resolvedAddress.shippingAddress.state,
            country: resolvedAddress.shippingAddress.country,
            isDefault: Boolean(dto.setAsDefaultAddress),
          },
        });
        shippingAddressRef = savedAddress.id;
      }

      // Guarded stock decrement (contention-safe)
      for (const item of resolvedItems) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, quantity_stock: { gte: item.quantity } },
          data: { quantity_stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) throw new Error('INSUFFICIENT_STOCK');
      }

      // Guarded coupon increment in same transaction
      if (coupon) {
        if (coupon.maxUses !== null) {
          const increment = await tx.coupon.updateMany({
            where: { id: coupon.id, usedCount: { lt: coupon.maxUses } },
            data: { usedCount: { increment: 1 } },
          });
          if (increment.count === 0) throw new Error('COUPON_MAX_USES_REACHED');
        } else {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      // Create order inline (D-04: snapshot address fields)
      return tx.order.create({
        data: {
          customerId,
          subtotal,
          shippingCost,
          discountAmount,
          totalAmount,
          couponId: coupon?.id ?? null,
          couponCode: coupon?.code ?? null,
          shippingStreet: resolvedAddress.shippingAddress.street,
          shippingNumber: resolvedAddress.shippingAddress.number,
          shippingComplement: resolvedAddress.shippingAddress.complement,
          shippingNeighborhood: resolvedAddress.shippingAddress.district,
          shippingCity: resolvedAddress.shippingAddress.city,
          shippingState: resolvedAddress.shippingAddress.state,
          shippingZipCode: resolvedAddress.shippingAddress.zipCode,
          shippingAddressRef,
          statusHistory: {
            create: { status: 'PENDING_PAYMENT' },
          },
          items: {
            create: resolvedItems.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              variantName: i.variantName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
            })),
          },
        },
        include: { items: true, statusHistory: true },
      });
    });

    cache.delByPrefix(cachePrefixes.catalog);
    return createdOrder as Order & { items: OrderItem[] };
  }

  private async resolveCheckoutAddress(dto: CheckoutDto, customerId: string): Promise<ResolvedCheckoutAddress> {
    if (dto.shippingAddressId) {
      const address = await prisma.address.findUnique({
        where: { id: dto.shippingAddressId },
        select: {
          id: true,
          customerId: true,
          zipCode: true,
          street: true,
          number: true,
          complement: true,
          district: true,
          city: true,
          state: true,
          country: true,
        },
      });

      if (!address || address.customerId !== customerId) {
        throw new Error('ADDRESS_NOT_FOUND');
      }

      return {
        shippingAddressId: address.id,
        fromSavedAddress: true,
        shippingAddress: normalizeShippingAddress({
          zipCode: address.zipCode,
          street: address.street,
          number: address.number,
          complement: address.complement ?? undefined,
          district: address.district,
          city: address.city,
          state: address.state,
          country: address.country,
        }),
      };
    }

    if (!dto.shippingAddress) {
      throw new Error('SHIPPING_ADDRESS_REQUIRED');
    }

    return {
      shippingAddressId: null,
      fromSavedAddress: false,
      shippingAddress: normalizeShippingAddress(dto.shippingAddress),
    };
  }

  // ---- Order lifecycle ----

  async updateStatusAsAdmin(
    orderId: string,
    dto: UpdateOrderStatusDto,
    adminId: string,
  ): Promise<Order> {
    const order = await repo.findById(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    const updated = await repo.updateStatus(orderId, dto.status, adminId);
    cache.delByPrefix(cachePrefixes.catalog);
    return updated;
  }

  async cancelAsCustomer(orderId: string, customerId: string): Promise<Order> {
    const order = await repo.findById(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.customerId !== customerId) throw new Error('ORDER_NOT_FOUND'); // prevent enumeration
    if (order.status !== 'PENDING_PAYMENT') throw new Error('ORDER_CANCEL_NOT_ALLOWED');
    const updated = await repo.updateStatus(orderId, 'CANCELLED', customerId);
    cache.delByPrefix(cachePrefixes.catalog);
    return updated;
  }

  // ---- Queries ----

  async getOrderAsCustomer(
    orderId: string,
    customerId: string,
  ): Promise<Order & { items: OrderItem[] }> {
    const order = await repo.findById(orderId);
    if (!order || order.customerId !== customerId) throw new Error('ORDER_NOT_FOUND');
    return order;
  }

  async getOrderAsAdmin(orderId: string): Promise<Order & { items: OrderItem[] }> {
    const order = await repo.findById(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    return order;
  }

  async listMyOrders(
    customerId: string,
    query: { page: number; limit: number },
  ): Promise<{ items: Order[]; total: number; page: number; limit: number }> {
    const { items, total } = await repo.listByCustomer(customerId, query);
    return { items, total, page: query.page, limit: query.limit };
  }

  async listAdminOrders(
    query: ListOrdersQueryDto,
  ): Promise<{ items: Order[]; total: number; page: number; limit: number }> {
    const { items, total } = await repo.listAdmin(query);
    return { items, total, page: query.page, limit: query.limit };
  }
}
