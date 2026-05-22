import 'dotenv/config';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { prisma } from '@/shared/infra/prisma';

const BCRYPT_ROUNDS = 12;

function requireEnvOrDefault(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

async function main() {
  const email = requireEnvOrDefault('MASTER_SEED_EMAIL', 'master@tinpavi.local');
  const password = requireEnvOrDefault('MASTER_SEED_PASSWORD', 'Master@123');
  const name = requireEnvOrDefault('MASTER_SEED_NAME', 'Usuario Master');
  const userId = randomUUID();

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.$executeRaw`
    INSERT INTO \`User\` (id, email, password, name, role, isActive, firstLogin, createdAt, updatedAt)
    VALUES (${userId}, ${email}, ${hashedPassword}, ${name}, ${'MASTER'}, ${true}, ${false}, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      password = VALUES(password),
      name = VALUES(name),
      role = VALUES(role),
      isActive = VALUES(isActive),
      firstLogin = VALUES(firstLogin),
      updatedAt = NOW()
  `;

  console.log(`Master seed applied for ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((error) => {
    console.error('Failed to seed master user');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });