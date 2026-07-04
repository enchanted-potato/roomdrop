/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // ONNX runtime ships worker/WASM assets that esbuild pre-bundling mangles
  // in dev (STACK.md note) — leave the package to native ESM resolution.
  optimizeDeps: {
    exclude: ['@imgly/background-removal'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
