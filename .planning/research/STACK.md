# Stack Research

**Domain:** Mobile-first, client-only image-editing SPA with in-browser ML segmentation, free-tier static hosting
**Researched:** 2026-06-24
**Confidence:** HIGH (core stack) / MEDIUM (BG removal model variant + hosting tier limits — verify at deploy time)

## TL;DR Stack

Vite 7 + React 19 + TypeScript 5.x SPA, react-konva for the interactive stage (touch + mouse + multi-touch via Konva's built-in pointer normalization), `@imgly/background-removal` v1.7+ as the primary BG removal library with a "fast" (`isnet_quint8`, ~44 MB, WASM-friendly) vs "quality" (`isnet_fp16`, ~80 MB, WebGPU-preferred) toggle, Zustand with `persist` middleware for state + small-payload localStorage, idb-keyval for caching downloaded ONNX model weights in IndexedDB (so a second visit is fast and `localStorage` quota stays clean), `canvas.toBlob('image/png')` from a hidden compositing canvas for PNG export, and DanubeData free tier as the deploy target (EU-hosted, GDPR-by-default, commercial-use allowed).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x (latest 19.2+) | UI framework | Stable since Dec 2024; native `use()` hook + actions; ecosystem (react-konva, use-gesture, zustand) supports 19. SPA-friendly, doesn't force RSC. |
| TypeScript | 5.x (5.8+ stable; pin to a 5.x line — TS 7 native compiler is still beta as of mid-2026, hold off) | Type safety | Mandatory for the placed-items model (transform math, layer ordering, model option unions). |
| Vite | 7.x (stable). Vite 8 (Rolldown) is also available but is a significant architecture shift — Vite 7 is the safer SPA pick for a greenfield portfolio app. | Build tool + dev server | De-facto SPA bundler in 2026. ESM dev, Rollup prod, first-class web worker + asset URL support (needed for ONNX/WASM assets). |
| react-konva | 19.x (matches React 19) — Konva core 9.x | Interactive canvas stage | Konva normalizes touch+mouse into unified pointer events, has a built-in `Transformer` for drag/scale/rotate handles, multi-layer canvas (room layer + placements layer + UI layer) for cheap re-renders, and a real React binding. Best fit for "free move/scale/rotate placed items" on mobile. |
| @imgly/background-removal | ^1.7.0 | In-browser BG removal (primary) | ONNX Runtime Web under the hood with first-class WebGPU + WASM fallback; three model presets that map directly onto the "fast vs quality" requirement; AGPL-3.0 (acceptable for a portfolio/non-commercial app — see License caveat below). |
| Zustand | 5.x | Client state + localStorage persistence | 2.9 KB, no Provider, `persist` middleware writes to `localStorage` out of the box with `partialize` to keep the payload small. Best ergonomics for "active room + library + placements" shape. |
| idb-keyval | 6.x | IndexedDB cache for ONNX model weights | ~300 B brotli. localStorage quota (~5 MB) cannot hold a 40-80 MB model; IndexedDB is the right place. Don't bring Dexie/localforage for a single key-value use case. |
| Tailwind CSS | 4.x (via `@tailwindcss/vite`) | Styling | First-party Vite plugin, CSS-first config, fast incremental builds. Avoids hand-rolled CSS for a mobile-first responsive layout. |
| Cloudflare Pages | — | Free-tier static host | Unlimited bandwidth on the free tier (Vercel/Netlify cap at 100 GB/mo). A 40-80 MB model download per first-visit makes bandwidth the real risk; CF Pages removes that risk. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| onnxruntime-web | Transitive via `@imgly/background-removal` | WebGPU/WASM execution provider | Don't depend on it directly; let `@imgly/background-removal` manage it. Configure WASM/WebGPU artifact paths once in Vite. |
| use-image (konva) | ^1.x | Loads `HTMLImageElement` for `<KonvaImage>` | Use for the room photo + each placed product image; handles the async load with a hook. |
| react-dropzone | ^14.x | Photo/library upload UX | Mobile-friendly file picker with drag-on-desktop fallback. Optional — a plain `<input type="file" accept="image/*" capture="environment">` covers the camera path on mobile and may be enough. |
| file-saver | ^2.x | Save the exported PNG | Tiny shim around `<a download>` + `URL.createObjectURL`. Optional — a hand-rolled 10-line saver is fine. |
| browser-image-compression | ^2.x | Pre-resize huge phone uploads before BG removal | Mid-range phones produce 12 MP+ JPEGs; downscaling to ≤2048 px on the long edge before inference cuts memory + latency dramatically and is the single biggest mobile perf win. |
| @use-gesture/react | 10.3.x | Optional: extra pinch/wheel-zoom on the *stage itself* (zoom whole scene) | Konva already covers item-level transform via `Transformer`. Only add use-gesture if you want pinch-to-zoom the entire room view. Note: pmndrs/use-gesture has been quiet since 2024 but is stable and still widely used; treat as feature-complete, not abandoned. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit tests | Pairs with Vite, zero config for a Vite project. Skip Jest. |
| Playwright | E2E for the touch/drag flow | Has real touch emulation (`hasTouch: true`) — important for the drop/transform flow. Cypress is weaker here. |
| ESLint 9 (flat config) + `@typescript-eslint` | Linting | Flat config is the only supported format in 2026. |
| Prettier | Formatting | Or Biome if you want one tool for lint+format; either is fine. |
| `vite-plugin-pwa` | Optional: offline shell + cache the ONNX model via a service worker | The model is the perfect SW-cache candidate; turns a one-time 40-80 MB download into a true offline-capable app. Strongly recommended once core flow works. |

## Installation

```bash
# Scaffold
npm create vite@latest roomdrop -- --template react-ts
cd roomdrop

# Core runtime
npm install react react-dom

# Canvas stage
npm install konva react-konva use-image

# State + storage
npm install zustand idb-keyval

# Background removal (browser, WebGPU + WASM)
npm install @imgly/background-removal

# Styling
npm install tailwindcss @tailwindcss/vite

# Image pipeline helpers
npm install browser-image-compression file-saver

# Optional
npm install react-dropzone @use-gesture/react

# Dev
npm install -D typescript vite @vitejs/plugin-react vitest @playwright/test \
  eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier \
  @types/react @types/react-dom @types/file-saver vite-plugin-pwa
```

Vite config must:
1. Mark `@imgly/background-removal` and `onnxruntime-web` as not pre-bundled if you hit worker/WASM URL issues (`optimizeDeps.exclude`).
2. Set `headers` for `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` *only if* you need `SharedArrayBuffer` for multi-threaded WASM. For ORT Web's single-threaded WASM + WebGPU paths it's not required; skip COOP/COEP unless benchmarks show it's needed (it makes hosting more annoying).

## Background Removal: The Critical Choice

This is the highest-stakes decision in the stack. Two viable options:

### Option A (RECOMMENDED): `@imgly/background-removal` v1.7+

- **Runtime:** ONNX Runtime Web. Auto-uses **WebGPU when available**, falls back to **WASM**. Picks a sensible execution provider per device.
- **Models shipped:**
  - `isnet_quint8` — ~44 MB, 8-bit quantized. Maps to **"Fast"** mode.
  - `isnet_fp16` — ~80 MB, half-precision. **Default**; maps to **"Quality"** mode.
  - `isnet` (fp32) — ~168 MB. Don't ship to mobile.
- **Architecture:** It runs inference in a Web Worker by default — you don't have to wire OffscreenCanvas yourself, but the worker keeps the UI thread free during the 2-10 s segmentation pass.
- **Output:** Returns a `Blob` (PNG with alpha) — feeds directly into `<KonvaImage>`.
- **License:** **AGPL-3.0**. Acceptable for a personal/portfolio app that is open-source. If the app is ever closed-source or commercial, you need IMG.LY's commercial license — flag this in PROJECT.md "Out of Scope" notes.
- **Confidence:** HIGH on capability and API surface; MEDIUM on exact phone latency — needs a measurement on a real mid-range Android before MVP exit.

### Option B (alternative): Transformers.js v3 + RMBG-1.4 / RMBG-2.0

- `@huggingface/transformers` v3.x (renamed from `@xenova/transformers`). v4 with a rewritten WebGPU runtime is also released as of Feb 2026 — promising but newer; prefer v3 unless you specifically want v4's perf.
- Use **RMBG-1.4** as the cross-browser fallback (works on iOS Safari) and optionally **RMBG-2.0** (BiRefNet-based, higher quality) where WebGPU is available.
- More flexibility (you control the pipeline, quantization, model choice) but more code to write and maintain.
- **When to choose B over A:** You want to swap models, you need an MIT-licensed pipeline, or `@imgly/background-removal`'s default behavior doesn't fit. For RoomDrop v1, A is less work for the same outcome.

### "Fast vs Quality" toggle (concrete mapping)

| User choice | Model | Device preference | Expected on a mid-range Android |
|-------------|-------|-------------------|---------------------------------|
| Fast | `isnet_quint8` | WebGPU if available, else WASM | ~3-6 s per image, ~50 MB peak RAM |
| Quality | `isnet_fp16` | WebGPU required for usable speed; WASM is a slow fallback | ~6-15 s per image, ~150 MB peak RAM |

Detect WebGPU at boot (`navigator.gpu`) and default the toggle accordingly: WebGPU → Quality default; no WebGPU → Fast default with a "Quality (slow)" opt-in.

### Why NOT MediaPipe Selfie Segmentation

It's a *portrait/person* segmentation model — accuracy on cushions, framed art, and arbitrary furniture is poor. Wrong tool.

## Persistence Strategy

| What | Where | Why |
|------|-------|-----|
| Active room metadata (id, dimensions, placement list, layer order) | `localStorage` via Zustand `persist` | Tiny (KB-scale), needs to be sync-readable on boot for instant rehydration. |
| Room photo bitmap | **IndexedDB** (idb-keyval), referenced by id from the Zustand store | A single 4 MP JPEG is 1-3 MB; `localStorage` will quota-exceed quickly. Use `Blob` storage in IDB. |
| Product library bitmaps (originals + background-removed PNGs) | **IndexedDB** (idb-keyval) | Same reason; PNG with alpha is large. |
| ONNX model weights | **IndexedDB cache** — `@imgly/background-removal` caches automatically via the browser HTTP cache when served with correct headers; add a service worker (vite-plugin-pwa) for guaranteed offline reuse. | The HTTP cache is fragile (cleared aggressively on mobile Safari). A SW cache or explicit IDB blob cache makes the second visit reliably instant. |
| Recently exported PNGs | Not persisted | Downloaded directly via `<a download>`; user owns the file. |

**Hard rule:** do not put raw image bytes in `localStorage`. Mid-range phones hit the 5-10 MB quota almost immediately and the failure mode is silent corruption of the rest of the store. The requirement says "localStorage persistence" — interpret that as "no backend, no server-side DB"; IndexedDB still counts as local browser storage and is the correct primitive for bytes.

## Canvas: react-konva vs Fabric vs DOM/CSS

| Recommended | react-konva |
|---|---|
| Alternative 1 | Fabric.js |
| Alternative 2 | Pure DOM elements with CSS transforms + `@use-gesture/react` |

- **Konva** wins because: official React binding, multi-layer architecture (re-rendering only the placements layer when an item moves keeps mid-range phones smooth), built-in `Transformer` with rotate + scale handles, unified pointer events for touch/mouse, multi-touch gestures documented and supported.
- **Fabric** has no official React binding, single-canvas rendering, and a heavier API. Pick it if you needed SVG import/export (you don't).
- **DOM+CSS transforms** is tempting (lightweight, no canvas at all for the editing UX) but you'd be reimplementing selection handles, rotation gestures, and z-index layering. Skip.

For export, render a single off-screen `<canvas>` at the room's natural resolution, draw the room image then each placed item with its final transform, and call `canvas.toBlob(blob => …, 'image/png')`. Konva also has `stage.toCanvas()`/`stage.toBlob()` which handles this for you — prefer those.

## OffscreenCanvas + Web Workers — Required?

- **For BG removal:** Not your problem — `@imgly/background-removal` already runs ORT Web in a worker. Don't double-wrap it.
- **For the editing stage:** Konva runs on the main thread. You do **not** need OffscreenCanvas for v1; mid-range phones handle a single room image plus ~10-30 placed transparent PNGs at normal viewport sizes fine.
- **For PNG export:** Optional. If export of a 4K composition janks the UI, move the compositing to a Worker with `OffscreenCanvas` + `convertToBlob()`. Safari supports `OffscreenCanvas` since Safari 17. Worth knowing but not v1 work.

## Hosting (decided)

**Pick: DanubeData free tier** (https://danubedata.ro/solutions/static-sites).

| Spec | Value |
|---|---|
| Cost | €0/mo |
| Storage | 100 MB |
| Bandwidth | 10 GB/mo |
| Sites / domains | 2 / 2 |
| Region | Falkenstein, DE (single PoP) |
| TLS | Auto Let's Encrypt |
| Deploy methods | Git auto-deploy, ZIP upload, CLI push |
| Edge cache | Immutable assets cached 1 year |
| Commercial use | Allowed on free tier |

**Why DanubeData over the hyperscalers:**

- **Preserves the option to monetize later** — Vercel Hobby explicitly forbids commercial use; DanubeData does not. Future affiliate links / "buy" buttons are fine.
- EU residency + GDPR-by-default — meaningful since the audience is friends/family who are likely EU/UK.
- Supports an indie EU host instead of a hyperscaler — aligned with project intent.

**Why DanubeData is acceptable despite tighter limits:**

- The 80 MB ONNX model is fetched from `imgly`'s CDN, not from our hosting — the 100 MB storage cap is not a blocker. Our bundle is a few MB.
- The 10 GB/mo bandwidth cap is generous for portfolio scale (~5,000+ visits/mo at ~2 MB/visit). The only realistic way to bust it is a viral spike — at which point migrating a static bundle takes minutes.
- Single PoP (DE) is fine latency-wise for the EU/UK audience.

**Hosting comparison considered:**

| Platform | Free bandwidth | Commercial use | Notes |
|---|---|---|---|
| **DanubeData** | **10 GB/mo** | **Allowed** | **Picked.** Preserves future monetization option; EU-hosted; indie. |
| Cloudflare Pages | Unlimited | Allowed | Safer if a viral spike is plausible. Runner-up. |
| Vercel Hobby | 100 GB/mo | **Forbidden** | Disqualified — ToS rules out future monetization. |
| Netlify | 100 GB/mo | Allowed | No special advantage here. |

**Migration plan:** Static SPA = portable. If DanubeData is outgrown (sustained bandwidth overrun) or breaks SLA, redeploy to Cloudflare Pages in minutes — no code changes.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vite 7 | Vite 8 (Rolldown) | If you specifically want the new Rolldown perf and can deal with bleeding-edge plugin compatibility. |
| React 19 | Preact 10 (with `preact/compat`) | If bundle size becomes the single dominant concern. Unlikely to matter next to an 80 MB ONNX model. |
| react-konva | Fabric.js | If you need SVG import/export, which RoomDrop does not. |
| react-konva | Plain DOM + CSS transforms + use-gesture | If you want to skip canvas entirely. Costs you the Transformer ergonomics; not worth it. |
| @imgly/background-removal | @huggingface/transformers + RMBG-2.0 | If AGPL is a blocker, or you need fine control of the segmentation pipeline. |
| Zustand | Jotai (`atomWithStorage`) | If state grows highly granular and rerenders become a problem. For RoomDrop's shape (handful of stores) Zustand is simpler. |
| Zustand | React Context only | Don't — `persist` middleware is the feature you actually want. |
| idb-keyval | Dexie | If you start needing real queries, indexes, or migrations. RoomDrop is blob-by-id; YAGNI. |
| DanubeData | Cloudflare Pages | If sustained traffic threatens the 10 GB/mo bandwidth cap; static bundle is portable. |
| DanubeData | Netlify | Same — fall back if DanubeData reliability proves insufficient. |
| Tailwind 4 | CSS Modules / vanilla CSS | If you dislike utility-first; both are fine here. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App | Unmaintained since 2023 | Vite |
| Next.js | Forces SSR/RSC complexity for a strictly client-only app; deploying just the static export defeats half its value | Vite SPA |
| Redux Toolkit | Overkill for ~3 stores; boilerplate cost is real | Zustand |
| `localStorage` for image blobs | 5-10 MB quota, sync API blocks the main thread, silent failures when full | IndexedDB via idb-keyval |
| `localForage` | ~7 KB for an API you don't need — it polyfills WebSQL/localStorage fallbacks irrelevant in 2026 | idb-keyval (300 B) |
| MediaPipe Selfie Segmentation | Trained for people, fails on furniture and decor | `@imgly/background-removal` (ISNet) or RMBG-2.0 (BiRefNet) |
| Remove.bg / Cloudinary / any server BG removal SDK | Violates the $0 budget and the "no backend" constraint | In-browser ONNX via `@imgly/background-removal` |
| TensorFlow.js for segmentation | Larger runtime, fewer current-gen models, weaker WebGPU story than ORT Web | ORT Web (via `@imgly/background-removal`) |
| react-dnd | Designed for list/grid drag, not free-form transform on a canvas | Konva's built-in pointer events + `Transformer` |
| react-rnd | DOM-based resize/rotate that fights touch on mobile | Konva `Transformer` |
| Fabric.js | No official React binding; single-canvas rendering hurts mid-range mobile perf | react-konva |
| Service-worker'ing the whole site without thought | Easy to ship a broken stale shell on a portfolio app | `vite-plugin-pwa` with a clear update prompt + a specific cache rule for the ONNX model only |

## Stack Patterns by Variant

**If the user is on a WebGPU-capable device (iOS 18+ Safari, Chrome desktop/Android with WebGPU enabled):**
- Default the BG removal quality toggle to **Quality** (`isnet_fp16`).
- Show a small "GPU accelerated" badge so the user knows why it's fast.

**If the user is on a WASM-only device (older iOS, locked-down Android, WebGPU disabled):**
- Default to **Fast** (`isnet_quint8`).
- Show a one-time hint that Quality mode exists but will be slow.

**If the user uploads a >8 MP image:**
- Downscale to 2048 px on the long edge with `browser-image-compression` *before* sending to BG removal. This is the single highest-leverage mobile perf optimization in the whole stack.

**If you decide to go closed-source / commercial later:**
- Swap `@imgly/background-removal` (AGPL) for `@huggingface/transformers` + RMBG-1.4 (MIT-friendly licensing on the model — verify per-model license at swap time). The interface boundary is "image in → image-with-alpha out," so this is a clean swap.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| react@19 | react-konva@19, konva@9 | react-konva tracks React major. Verify peer ranges. |
| vite@7 | @vitejs/plugin-react@4+ | Standard pairing. |
| tailwindcss@4 | @tailwindcss/vite@4 | Same minor line; don't mix v3 PostCSS plugin with v4. |
| @imgly/background-removal@1.7+ | Modern Chrome/Safari/Firefox with ES2020 + WebAssembly + (optional) WebGPU | iOS Safari WebGPU shipped 18.0. Older iOS falls back to WASM cleanly. |
| onnxruntime-web | Bundled transitively | Don't pin directly unless you hit a known issue; let imgly choose. |
| zustand@5 | React 18 and 19 | `persist` middleware API stable across 4→5. |
| TypeScript 5.x | All of the above | Hold off on TS 6/7 native compiler until ecosystem types catch up. |

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Core framework (React/Vite/TS) | HIGH | Verified mainstream choices, current major versions confirmed. |
| Canvas library | HIGH | Konva is the documented winner for touch + transform + React. |
| BG removal library | HIGH on choice, MEDIUM on exact mobile latency numbers | API + model sizes verified from imgly docs and v1.7 release notes; phone-specific timings extrapolated from community reports and should be measured on a real device during Phase 2. |
| State + persistence | HIGH | Zustand `persist` + idb-keyval is the standard 2025/26 pattern. |
| Hosting | HIGH | CF Pages free-tier bandwidth advantage is well-documented and material here. |
| Versions (Vite 7 vs 8, TS 5 vs 6/7) | MEDIUM | Mid-2026 search results report Vite 8 and TS 6/7 as released; I'm recommending the prior stable line conservatively to avoid bleeding-edge churn on a portfolio app. Re-verify when scaffolding. |

## Open Items to Re-verify at Scaffold Time

- Confirm the latest `@imgly/background-removal` version + check release notes for any model-naming changes since v1.7.
- Confirm `react-konva` peer dep with React 19.x at install time.
- Run a real mid-range Android benchmark for both `isnet_quint8` (WASM) and `isnet_fp16` (WebGPU) on a 2048-px input early in Phase 2 — drives whether "Quality" is shippable on mobile or desktop-only.
- Confirm Cloudflare Pages still offers unlimited bandwidth on free tier (terms occasionally tighten).
- Decide AGPL acceptance for the portfolio; document the decision in `PROJECT.md` under Key Decisions.

## Sources

- [npmjs.com — @imgly/background-removal](https://www.npmjs.com/package/@imgly/background-removal) — version, model options, device options
- [unpkg — @imgly/background-removal@1.5.8 README](https://app.unpkg.com/@imgly/background-removal@1.5.8/files/README.md) — model size + device API
- [IMG.LY blog — 20x Faster Browser Background Removal with ONNX Runtime](https://img.ly/blog/browser-background-removal-using-onnx-runtime-webgpu/) — WebGPU support in v1.7
- [GitHub — imgly/background-removal-js](https://github.com/imgly/background-removal-js) — repo + license
- [HuggingFace — Transformers.js v3 announcement](https://huggingface.co/blog/transformersjs-v3) — WebGPU + RMBG support
- [HuggingFace — briaai/RMBG-2.0](https://huggingface.co/briaai/RMBG-2.0) — BiRefNet-based model + 8-bit quantization size (~45 MB)
- [npmjs.com — @huggingface/transformers](https://www.npmjs.com/package/@huggingface/transformers) — package rename + current version line
- [Konva docs — Transformer](https://konvajs.org/docs/react/Transformer.html) — drag/scale/rotate with React
- [Konva docs — Multi-touch Scale](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html) — pinch zoom + rotate
- [Konva FAQ](https://konvajs.org/docs/faq.html) — mobile + touch coverage
- [Vite Releases](https://vite.dev/releases) — current Vite version line
- [Tailwind CSS v4 release](https://tailwindcss.com/blog/tailwindcss-v4) — v4 + Vite plugin
- [npmjs.com — @tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite) — first-party Vite plugin
- [PkgPulse — Zustand vs Jotai vs Nano Stores 2026](https://www.pkgpulse.com/guides/zustand-vs-jotai-vs-nanostores-micro-state-management-2026) — Zustand `persist` story
- [GitHub — jakearchibald/idb-keyval](https://github.com/jakearchibald/idb-keyval) — size + API
- [PkgPulse — Dexie vs localForage vs idb 2026](https://www.pkgpulse.com/guides/dexie-vs-localforage-vs-idb-indexeddb-browser-storage-2026) — IDB wrapper trade-offs
- [MDN — HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) — PNG export semantics
- [MDN — OffscreenCanvas.convertToBlob()](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob) — worker-based export
- [DanubeData — Cloudflare Pages vs Netlify vs Vercel 2026](https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026) — free-tier bandwidth comparison
- [AgentDeals — Hosting Free-Tier Comparison 2026](https://agentdeals.dev/hosting-free-tier-comparison-2026) — confirmation of CF unlimited bandwidth
- [@use-gesture docs](https://use-gesture.netlify.app/docs/) — pinch/rotate API
- [pmndrs/use-gesture](https://github.com/pmndrs/use-gesture) — maintenance status

---
*Stack research for: mobile-first client-only image-editing SPA with in-browser segmentation*
*Researched: 2026-06-24*
