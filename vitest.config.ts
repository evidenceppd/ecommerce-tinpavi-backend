import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: 'mysql://root:@localhost:3306/ecommerce_tinpavi',
    },
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/modules/**/*.service.ts'],
    },
  },
});
