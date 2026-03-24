import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app'),
      '@magam/cli': path.resolve(__dirname, 'libs/cli/src/index.ts'),
      '@magam/core': path.resolve(__dirname, 'libs/core/src/index.ts'),
      '@magam/runtime': path.resolve(__dirname, 'libs/runtime/src/index.ts'),
      '@magam/shared': path.resolve(__dirname, 'libs/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
