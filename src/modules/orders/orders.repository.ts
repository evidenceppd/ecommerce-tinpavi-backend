import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/infra/prisma';
import type { Order, OrderItem, OrderStatus } from '@/generated/prisma/client';
import type { ListOrdersQueryDto } from './orders.schemas';

const ADMIN_ORDER_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          title: true,
          code: true,
          variants: true,
        },
      },
    },
  },
  statusHistory: { orderBy: { changedAt: 'asc' as const } },
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.OrderInclude;

const CUSTOMER_ORDER_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          title: true,
          code: true,
          variants: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizePagination(page: number, limit: number): { skip: number; limit: number } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
  const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : DEFAULT_LIMIT;
  const safeLimit = Math.min(Math.max(normalizedLimit, 1), MAX_LIMIT);
  return { skip: (safePage - 1) * safeLimit, limit: safeLimit };
}

export type CreateOrderData = {
  customerId: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  couponId?: string;
  couponCode?: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingComplement?: string;
  shippingNeighborhood: string;
  shippingCity: string;
  shippingState: string;
  shippingZipCode: string;
  shippingAddressRef?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    variantName?: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};

export class OrdersRepository {
  async create(data: CreateOrderData): Promise<Order & { items: OrderItem[] }> {
    return prisma.order.create({
      data: {
        customerId: data.customerId,
        subtotal: data.subtotal,
        shippingCost: data.shippingCost,
        discountAmount: data.discountAmount,
        totalAmount: data.totalAmount,
        couponId: data.couponId ?? null,
        couponCode: data.couponCode ?? null,
        shippingStreet: data.shippingStreet,
        shippingNumber: data.shippingNumber,
        shippingComplement: data.shippingComplement ?? null,
        shippingNeighborhood: data.shippingNeighborhood,
        shippingCity: data.shippingCity,
        shippingState: data.shippingState,
        shippingZipCode: data.shippingZipCode,
        shippingAddressRef: data.shippingAddressRef ?? null,
        statusHistory: {
          create: { status: 'PENDING_PAYMENT' },
        },
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            variantName: item.variantName ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: { items: true, statusHistory: true },
    }) as Promise<Order & { items: OrderItem[] }>;
  }

  async findById(id: string): Promise<(Order & { items: OrderItem[] }) | null> {
    return prisma.order.findUnique({
      where: { id },
      include: ADMIN_ORDER_INCLUDE,
    }) as Promise<(Order & { items: OrderItem[] }) | null>;
  }

  async listByCustomer(
    customerId: string,
    query: { page: number; limit: number },
  ): Promise<{ items: Order[]; total: number }> {
    const { skip, limit } = normalizePagination(query.page, query.limit);
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: CUSTOMER_ORDER_INCLUDE,
      }),
      prisma.order.count({ where: { customerId } }),
    ]);
    return { items, total };
  }

  async listAdmin(query: ListOrdersQueryDto): Promise<{ items: Order[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...((query.dateFrom || query.dateTo)
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { id: { contains: query.search } },
              { couponCode: { contains: query.search } },
              {
                customer: {
                  is: {
                    email: { contains: query.search },
                  },
                },
              },
              {
                customer: {
                  is: {
                    name: { contains: query.search },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const { skip, limit } = normalizePagination(query.page, query.limit);
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: ADMIN_ORDER_INCLUDE,
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total };
  }

  async updateStatus(id: string, status: OrderStatus, changedBy?: string): Promise<Order> {
    return prisma.order.update({
      where: { id },
      data: {
        status,
        statusHistory: {
          create: { status, changedBy: changedBy ?? null },
        },
      },
    });
  }
}

