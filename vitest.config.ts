import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'istanbul',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/types.ts'],
      reportsDirectory: '../.dataarm-artifacts/coverage/unit',
      reporter: ['json'],
    },
  },
});
