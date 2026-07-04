/// <reference types="vitest" />
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID ?? buildId()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' + update toast: no silently swapped shell (Pitfall M14).
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'RoomDrop',
        short_name: 'RoomDrop',
        description:
          'Preview furniture, cushions and wall art in a photo of your own room — entirely in your browser.',
        theme_color: '#f1ebe1',
        background_color: '#f1ebe1',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Only the app shell is precached. The ONNX model + WASM come from
        // imgly's CDN and are runtime-cached so the SECOND visit is free
        // (BGR-07, Pitfall C7) — never precached, never on our bandwidth.
        // The ort-* chunks/wasm that Rolldown emits are imgly's local
        // FALLBACKS (runtime overrides wasmPaths to its CDN) — keep them out
        // of the precache so every visitor doesn't pay for BG-removal glue.
        globIgnores: ['**/ort*', '**/*.wasm', '**/*.map'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/staticimgly\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'imgly-model',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
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
