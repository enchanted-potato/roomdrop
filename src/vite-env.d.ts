/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.css';

/** Git short SHA injected at build time (vite.config define). */
declare const __BUILD_ID__: string;
