import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The real module only exists inside the VS Code extension host.
    alias: { vscode: fileURLToPath(new URL('./src/tests/mocks/vscode.ts', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
});
