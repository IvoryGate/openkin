import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/script/test_*.ts'],
    testTimeout: 30000,
  },
});
