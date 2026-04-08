import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.component.spec.ts', 'src/app/app.spec.ts', 'node_modules', 'dist'],
  },
});
