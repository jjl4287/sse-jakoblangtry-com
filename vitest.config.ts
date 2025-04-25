import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['node_modules', 'tests/**', 'vitest.config.ts'],
    }
  },
}); 