import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/api/src/**/*.db.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 15_000,
    fileParallelism: false,
  },
});
