# Summary 06-01: Deploy & PWA (local prep)

**Completed:** 2026-07-04 (local prep only per user instruction — no deploy executed)

## What shipped
- `vite-plugin-pwa` (`registerType: 'prompt'`): precache = app shell only (10 entries, ~709 KB). `globIgnores` keeps the Rolldown-emitted ort-* chunks / 24 MB fallback WASM out of the precache — at runtime imgly overrides `wasmPaths` to its CDN, so those local copies are dead-weight fallbacks.
- Runtime caching: `CacheFirst` on `https://staticimgly.com/*` (model + WASM, 1-year expiry) → second visit is free (BGR-07, C7); `StaleWhileRevalidate` on Google Fonts.
- Update flow (M14): `onNeedRefresh` → "New version available" toast with Refresh action. `?nosw=1` emergency bypass unregisters workers (m4).
- Build ID: git short SHA via Vite `define` → footer "· Build <sha>" next to the Open source link.
- Manifest + generated icons (192/512/maskable/apple-touch, `scripts/generate-icons.mjs`), theme color, standalone display.
- Verified locally: build green, `vite preview` serves `/`, `/sw.js`, `/manifest.webmanifest` (200s).

## Deviations / notes
- `workbox-window` added as a devDependency (pnpm doesn't hoist the plugin's peer).
- dist contains ~30 MB of unused ort fallback assets (under DanubeData's 100 MB storage cap; only fetched if imgly's CDN override ever failed). Trimming them is listed in PRODUCTIONISE.md as an optimization.
- Actual DanubeData deploy, domain, and cache-header verification are documented in PRODUCTIONISE.md, not executed.

## Verification
`pnpm typecheck` / `lint` / `test` (33) / `build` green; preview smoke-tested.
