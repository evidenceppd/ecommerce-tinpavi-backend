import { prisma } from '@/shared/infra/prisma';

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  role: 'EDITOR' | 'ADMIN' | 'MASTER';
  isActive: boolean;
  firstLogin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UsersRepository {
  async listAll(): Promise<AdminUserRecord[]> {
    const rows = await prisma.$queryRaw<AdminUserRecord[]>`
      SELECT id, email, name, role, isActive, firstLogin, createdAt, updatedAt
      FROM \`User\`
      ORDER BY createdAt DESC
    `;
    return rows;
  }

  async findById(id: string): Promise<AdminUserRecord | null> {
    const rows = await prisma.$queryRaw<AdminUserRecord[]>`
      SELECT id, email, name, role, isActive, firstLogin, createdAt, updatedAt
      FROM \`User\`
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<AdminUserRecord | null> {
    const rows = await prisma.$queryRaw<AdminUserRecord[]>`
      SELECT id, email, name, role, isActive, firstLogin, createdAt, updatedAt
      FROM \`User\`
      WHERE email = ${email}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async create(data: {
    id: string;
    email: string;
    name: string;
    role: 'EDITOR' | 'ADMIN' | 'MASTER';
    isActive: boolean;
    firstLogin: boolean;
    password: string;
  }): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO \`User\` (id, email, password, name, role, isActive, firstLogin, createdAt, updatedAt)
      VALUES (${data.id}, ${data.email}, ${data.password}, ${data.name}, ${data.role}, ${data.isActive}, ${data.firstLogin}, NOW(), NOW())
    `;
  }

  async updateById(
    id: string,
    fields: {
      email?: string;
      name?: string;
      role?: 'EDITOR' | 'ADMIN' | 'MASTER';
      isActive?: boolean;
      firstLogin?: boolean;
      password?: string;
    },
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE \`User\`
      SET
        email = COALESCE(${fields.email ?? null}, email),
        name = COALESCE(${fields.name ?? null}, name),
        role = COALESCE(${fields.role ?? null}, role),
        isActive = COALESCE(${fields.isActive ?? null}, isActive),
        firstLogin = COALESCE(${fields.firstLogin ?? null}, firstLogin),
        password = COALESCE(${fields.password ?? null}, password),
        updatedAt = NOW()
      WHERE id = ${id}
    `;
  }

  async deleteById(id: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM \`User\` WHERE id = ${id}`;
  }
}
