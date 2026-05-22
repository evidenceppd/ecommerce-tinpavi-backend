import type { Address, Customer } from '@/generated/prisma/client';
import { prisma } from '@/shared/infra/prisma';
import type {
  AdminListCustomersQueryDto,
  AdminUpdateCustomerDto,
  CreateAddressDto,
  UpdateAddressDto,
  UpdateProfileDto,
} from './customers.schemas';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizePagination(page: number, limit: number): { skip: number; limit: number } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
  const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : DEFAULT_LIMIT;
  const safeLimit = Math.min(Math.max(normalizedLimit, 1), MAX_LIMIT);
  return { skip: (safePage - 1) * safeLimit, limit: safeLimit };
}

export class CustomersRepository {
  async findByEmail(email: string): Promise<Customer | null> {
    return prisma.customer.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<Customer | null> {
    return prisma.customer.findUnique({ where: { id } });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<Customer> {
    return prisma.customer.update({
      where: { id },
      data: { ...dto },
    });
  }

  async createAddress(customerId: string, dto: CreateAddressDto): Promise<Address> {
    if (dto.isDefault) {
      await prisma.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }
    return prisma.address.create({
      data: { ...dto, customerId },
    });
  }

  async findAddressesByCustomerId(customerId: string): Promise<Address[]> {
    return prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findAddressById(id: string, customerId: string): Promise<Address | null> {
    return prisma.address.findFirst({ where: { id, customerId } });
  }

  async deleteAddress(id: string, customerId: string): Promise<void> {
    await prisma.address.deleteMany({ where: { id, customerId } });
  }

  async updatePassword(id: string, password: string): Promise<void> {
    await prisma.customer.update({ where: { id }, data: { password } });
  }

  async setMfaEnabled(id: string, mfaEnabled: boolean): Promise<Customer> {
    return prisma.customer.update({ where: { id }, data: { mfaEnabled } });
  }

  async updateAddress(id: string, customerId: string, dto: UpdateAddressDto): Promise<Address> {
    if (dto.isDefault) {
      await prisma.address.updateMany({
        where: { customerId, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.address.update({
      where: { id },
      data: dto,
    });
  }

  async listAdminCustomers(query: AdminListCustomersQueryDto): Promise<{
    items: Array<{
      id: string;
      email: string;
      name: string;
      phone: string | null;
      company: string | null;
      document: string | null;
      role: Customer['role'];
      createdAt: Date;
      updatedAt: Date;
      addressesCount: number;
      ordersCount: number;
    }>;
    total: number;
  }> {
    const { skip, limit } = normalizePagination(query.page, query.limit);
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search } },
              { name: { contains: query.search } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          company: true,
          document: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              addresses: true,
              orders: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items: items.map((customer) => ({
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        company: customer.company,
        document: customer.document,
        role: customer.role,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        addressesCount: customer._count.addresses,
        ordersCount: customer._count.orders,
      })),
      total,
    };
  }

  async findAdminById(id: string): Promise<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
    company: string | null;
    document: string | null;
    role: Customer['role'];
    createdAt: Date;
    updatedAt: Date;
    addresses: Address[];
    orders: Array<{
      id: string;
      status: string;
      totalAmount: number;
      paymentStatus: string;
      paymentMethod: string | null;
      couponCode: string | null;
      createdAt: Date;
      items: Array<{
        id: string;
        productId: string;
        variantId: string | null;
        variantName: string | null;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        product: {
          id: string;
          title: string;
          code: string;
        };
      }>;
    }>;
  } | null> {
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        company: true,
        document: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            paymentStatus: true,
            paymentMethod: true,
            couponCode: true,
            createdAt: true,
            items: {
              select: {
                id: true,
                productId: true,
                variantId: true,
                variantName: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true,
                product: {
                  select: {
                    id: true,
                    title: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return null;
    }

    return {
      ...customer,
      orders: customer.orders.map((order) => ({
        ...order,
        totalAmount: Number(order.totalAmount),
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
      })),
    };
  }

  async updateCustomerAsAdmin(
    id: string,
    dto: Omit<AdminUpdateCustomerDto, 'password'> & { password?: string },
  ): Promise<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
    company: string | null;
    document: string | null;
    role: Customer['role'];
    createdAt: Date;
    updatedAt: Date;
  }> {
    return prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        document: dto.document,
        role: dto.role,
        ...(dto.password ? { password: dto.password } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        company: true,
        document: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createCustomerAsAdmin(data: {
    name: string;
    email: string;
    password: string;
    role: Customer['role'];
    phone?: string | null;
    company?: string | null;
    document?: string | null;
  }): Promise<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
    company: string | null;
    document: string | null;
    role: Customer['role'];
    createdAt: Date;
    updatedAt: Date;
  }> {
    return prisma.customer.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        company: true,
        document: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteCustomerAsAdmin(id: string): Promise<void> {
    await prisma.customer.delete({ where: { id } });
  }

  async listOrderHistoryByCustomer(customerId: string): Promise<
    Array<{
      id: string;
      status: string;
      subtotal: number;
      shippingCost: number;
      discountAmount: number;
      totalAmount: number;
      paymentStatus: string;
      paymentMethod: string | null;
      createdAt: Date;
      items: Array<{
        id: string;
        productId: string;
        variantId: string | null;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }>
  > {
    const orders = await prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        subtotal: true,
        shippingCost: true,
        discountAmount: true,
        totalAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            product: {
              select: {
                title: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return orders.map((order) => ({
      ...order,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      discountAmount: Number(order.discountAmount),
      totalAmount: Number(order.totalAmount),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        productName: item.product.title,
        productCode: item.product.code,
      })),
    }));
  }
}

