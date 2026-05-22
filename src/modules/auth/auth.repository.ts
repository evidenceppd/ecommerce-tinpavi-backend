import type { Customer } from '@/generated/prisma/client';
import { prisma } from '@/shared/infra/prisma';

export interface AuthAdminUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'EDITOR' | 'ADMIN' | 'MASTER';
  isActive: boolean;
  firstLogin: boolean;
}

export class AuthRepository {
  async findAdminUserByEmail(email: string): Promise<AuthAdminUser | null> {
    const rows = await prisma.$queryRaw<AuthAdminUser[]>`
      SELECT id, email, password, name, role, isActive, firstLogin
      FROM \`User\`
      WHERE email = ${email}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async findAdminUserById(id: string): Promise<AuthAdminUser | null> {
    const rows = await prisma.$queryRaw<AuthAdminUser[]>`
      SELECT id, email, password, name, role, isActive, firstLogin
      FROM \`User\`
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    return prisma.customer.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<Customer | null> {
    return prisma.customer.findUnique({ where: { id } });
  }

  async updatePassword(id: string, password: string): Promise<void> {
    await prisma.customer.update({ where: { id }, data: { password } });
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<Customer> {
    return prisma.customer.create({ data });
  }
}
