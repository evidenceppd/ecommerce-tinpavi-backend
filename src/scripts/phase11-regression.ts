import { readFileSync } from 'fs';
import { join } from 'path';

function mustContain(filePath: string, expected: string): void {
  const content = readFileSync(filePath, 'utf8');
  if (!content.includes(expected)) {
    throw new Error(`Missing expected content in ${filePath}: ${expected}`);
  }
}

function mustNotContain(filePath: string, forbidden: string): void {
  const content = readFileSync(filePath, 'utf8');
  if (content.includes(forbidden)) {
    throw new Error(`Unexpected content in ${filePath}: ${forbidden}`);
  }
}

function run(): void {
  const root = process.cwd();

  mustContain(join(root, 'src/modules/orders/orders.schemas.ts'), 'quoteId');
  mustNotContain(join(root, 'src/modules/orders/orders.schemas.ts'), 'shippingCost: z.number().nonnegative()');

  mustContain(join(root, 'src/modules/orders/orders.service.ts'), 'updateMany({');
  mustContain(join(root, 'src/modules/orders/orders.service.ts'), 'SHIPPING_SELECTION_KEY_PREFIX');

  mustContain(join(root, 'src/modules/payments/payments.controller.ts'), 'WEBHOOK_INVALID_SIGNATURE');
  mustContain(join(root, 'src/modules/payments/payments.service.ts'), 'payment:webhook:done:');

  mustContain(join(root, 'src/shared/middleware/rate-limit.ts'), 'RedisStore');
  mustContain(join(root, 'src/app.ts'), 'x-request-id');

  console.log('phase11-regression: OK');
}

run();
