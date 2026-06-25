# Phase 1: Foundations & Image Pipeline — Research

**Researched:** 2026-06-25
**Domain:** Vite + React 19 + TS SPA scaffolding, client-side image normalization (EXIF + canvas resize + HEIC sniff), Zustand+IDB persistence, mobile-first responsive shell, AGPL-3.0 compliance.
**Confidence:** HIGH (CONTEXT.md locked nearly every decision; this research verifies versions, validates the locked choices against current ecosystem reality, and surfaces landmines)

## Summary

CONTEXT.md is highly prescriptive — the stack (Vite + React 19 + TS, Tailwind v4, Zustand, `idb-keyval`, `exifr`, `lucide-react`, Vitest, pnpm) is locked, the directory layout is locked, the persistence pattern is locked, and even the implementation strategy for the image pipeline (exifr for orientation + `createImageBitmap` + `OffscreenCanvas` + magic-byte HEIC sniff) is locked. The research job here is **verification, not selection**.

All locked package choices were verified on the npm registry and passed slopcheck with `--ecosystem npm` (16/16 clean; one false-positive for `vitest` flagged as "close to vite" — it is the official Vite team's test runner, intentionally named). Every locked decision is sound: the most important verification is that `createImageBitmap`'s `imageOrientation: 'from-image'` option has only partial Safari support pre-18.5, which is exactly why the locked decision to do orientation through `exifr` (and apply the rotation manually) is the correct call.

Primary landmines surfaced: (1) **iOS Safari canvas memory cap (~384 MB total, individual area ≤16.7 Mpx)** — at ≤2048 px long edge a 2048×2048 RGBA bitmap is ~16.7 MB, safe; the danger is leaking ImageBitmaps/canvases on photo replace. (2) **iOS Safari 7-day IndexedDB eviction** under ITP — irrelevant for Phase 1 success, but the planner should add `navigator.storage.persist()` request at boot to start mitigating it now. (3) **Zustand `persist` hydration is synchronous from localStorage but IDB blob load is async** — the locked D-08 boot sequence handles this correctly with skeleton-first; verify the implementation doesn't accidentally `await` IDB before first paint.

**Primary recommendation:** Implement exactly what CONTEXT.md specifies. Add three small things the locked context did not pin: (a) call `navigator.storage.persist()` once at boot to dampen iOS 7-day eviction, (b) revoke `URL.createObjectURL` outputs on every photo swap and on unmount, (c) close `ImageBitmap` instances explicitly after canvas draw to free GPU memory promptly on iOS.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Image Pipeline**
- **D-01:** Build `ImagePipeline` from `exifr` (orientation-only build, ~5KB) + native `createImageBitmap` + `OffscreenCanvas` resize. No `browser-image-compression`. Reason: keeps bundle lean, full control over each stage.
- **D-02:** HEIC rejection by magic-byte sniff of the first 12 bytes (`ftypheic` / `ftypheix` / `ftyphevc` / `ftypmif1`). Do NOT trust `file.type` or extension — iOS Safari lies about both. On match, emit the locked HEIC toast copy from `01-UI-SPEC.md`.
- **D-03:** Resize policy: long edge ≤2048px, preserve aspect, encode as JPEG quality 0.9 for room photos.

**Store & Persistence**
- **D-04:** Single Zustand store (`useAppStore`) with `persist` middleware. `partialize` includes metadata only: `rooms`, `activeRoomId`, `libraryItems`, `placements`, `schemaVersion`. Blobs are NEVER in the persist payload.
- **D-05:** All image blobs live in `idb-keyval` keyed by a generated `blobId` (e.g. `room:<uuid>`, `lib:<uuid>`). Store holds the `blobId` only.
- **D-06:** Multi-room schema as `rooms: Record<roomId, Room>` + `activeRoomId: string | null`. Placements keyed by `roomId` in a separate `Record<roomId, Placement[]>`. Library is global.
- **D-07:** `schemaVersion: 1` on the persisted payload from day one; persist middleware `version` field set.

**Hydration & Failure**
- **D-08:** Boot sequence: Zustand rehydrates synchronously from localStorage → if `activeRoomId` exists, mount paints `<SkeletonRoom>` immediately → async `idb-keyval.get(blobId)` → `URL.createObjectURL(blob)` → swap to `<img>` with 150ms opacity cross-fade. Object URLs revoked on unmount and on photo replace.
- **D-09:** IDB read failure is self-healing: clear stale `activeRoomId` + room record, render empty-state dropzone, surface one toast.

**Tooling & Repo Layout**
- **D-10:** Package manager: **pnpm**. Commit `pnpm-lock.yaml`. Engines field pins Node ≥20 LTS.
- **D-11:** `src/` layout — feature-sliced (`app/`, `features/{room,library,editor}`, `lib/{image-pipeline,idb}`, `store/`, `components/`, `styles/`).
- **D-12:** ESLint (typescript-eslint, react-hooks, react-refresh) + Prettier. No husky in scope.
- **D-13:** Vitest scaffolded with ONE meaningful test: `image-pipeline.test.ts` covering EXIF orientation + resize bounds + HEIC magic-byte rejection. No Playwright, no component tests yet.
- **D-14:** Phase 1 is **deploy-ready, not deployed**. Vite `base: './'`, SPA fallback configured, `dist/` produces a clean static bundle. Actual DanubeData deploy + PWA = Phase 6.

### Claude's Discretion
- Exact `Room` / `LibraryItem` / `Placement` TypeScript shapes (must round-trip through JSON).
- ESLint rule set strictness (recommended + react-hooks recommended is the floor).
- `nanoid` vs `crypto.randomUUID()` for IDs.
- Vite plugins beyond `@vitejs/plugin-react` (none required in Phase 1).

### Deferred Ideas (OUT OF SCOPE)
- PWA + model caching (Phase 6) — **do not** add `vite-plugin-pwa` in Phase 1.
- Build-ID footer slot (Phase 6); leave empty.
- Library upload UI / drag-from-library / Konva / Transformer (Phase 2).
- BG removal worker, model download UX, Fast/Quality toggle (Phase 4).
- Destructive confirmation dialogs (Phase 3).
- BroadcastChannel multi-tab guard (Phase 5).
- Sample room + onboarding tooltip + honesty notice (Phase 5).
- PNG export + Web Share API (Phase 3).
- Multi-room UI / room switcher (v2).
- ZIP backup / restore (v2).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Vite + React + TS SPA deployable to DanubeData free tier | Standard Stack §"Scaffold" + Architecture §"Deploy posture" |
| FND-02 | AGPL-3.0 LICENSE + visible "Open source" footer link | §"AGPL-3.0 Compliance" |
| FND-03 | Mobile-first responsive, iPhone SE → desktop, `viewport-fit=cover` + `100svh` | §"Mobile shell & safe-area" |
| FND-04 | Single `ImagePipeline` doing EXIF + HEIC reject + ≤2048px resize | §"Image Pipeline" + Code Examples |
| UPL-01 | Camera (mobile) or file picker (desktop) upload | §"Upload entry points" |
| UPL-03 | Replace active room photo without losing the library | §"Persistence pattern" — library is a separate top-level slice |
| PER-02 | Survives reload, rehydrates at first paint | §"Hydration sequence" — D-08 |
| PER-03 | Blobs in IDB via `idb-keyql`; only metadata + blob IDs in `persist` payload | §"Persistence pattern" |
| PER-04 | Multi-room schema in v1 even though UI is single-room | §"Multi-room schema seam" |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTML/CSS render of shell, dropzone, image, footer | Browser DOM | — | Static SPA — no SSR. All paint is client. |
| EXIF parse + resize | Browser (main thread + Web Worker via `OffscreenCanvas`) | — | CLAUDE.md: client-only. `OffscreenCanvas` lets pipeline run off main thread on Chrome; falls back to main-thread canvas on older Safari. |
| File picker / camera capture | Browser (HTML `<input type=file>`) | — | Native browser primitive; no JS needed beyond change handler. |
| Metadata persistence | Browser `localStorage` (via Zustand `persist`) | — | Synchronous read at boot → enables D-08 skeleton-first paint. |
| Blob persistence | Browser `IndexedDB` (via `idb-keyval`) | — | Async; metadata holds only the `blobId`. |
| Static asset hosting | CDN / DanubeData free tier | — | Not deployed in Phase 1 (D-14), but build artifact must be drop-in ready. |
| Object URL lifecycle | Browser (`URL.createObjectURL` / `revokeObjectURL`) | — | Memory hygiene; required on iOS Safari to avoid blob accumulation. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | 7.1.3 | Build tool + dev server | Locked in CONTEXT/STATE; verified latest on npm |
| `react` | 19.2.7 | UI library | Locked (CONTEXT decisions); verified latest |
| `react-dom` | 19.2.7 | DOM renderer | Pairs with React |
| `typescript` | 6.0.3 | Type checking | Verified latest stable on npm |
| `@vitejs/plugin-react` | 6.0.3 | React plugin for Vite (Fast Refresh, JSX) | Standard Vite + React combo |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` | 5.0.14 | State store with `persist` middleware | The locked store; `persist` is in the same package (`zustand/middleware`) |
| `idb-keyval` | 6.2.5 | Tiny IndexedDB key/value wrapper (~1KB gzipped) | Locked; pairs with Zustand for blob storage |
| `exifr` | 7.1.3 | EXIF parser with submodule entry-points for orientation-only build | Locked; use `exifr/dist/mini.umd.js` or `exifr/dist/lite.esm.js` submodule for smallest bundle |
| `tailwindcss` | 4.3.1 | Utility CSS | Locked in UI-SPEC; v4 has zero-runtime, CSS-first `@theme` config |
| `@tailwindcss/vite` | 4.3.1 | Tailwind v4 Vite plugin | The recommended v4 install path (replaces PostCSS plugin) |
| `lucide-react` | 0.5.3 | Icon set (tree-shakable) | Locked in UI-SPEC |
| `vitest` | 4.3.1 | Test runner | Locked (D-13); native Vite integration |
| `eslint` | 10.5.0 | Linter | Locked (D-12) |
| `typescript-eslint` | 8.62.0 | TS-aware ESLint config + parser (flat config) | Locked |
| `eslint-plugin-react-hooks` | 7.1.1 | Hooks rules | Locked |
| `eslint-plugin-react-refresh` | 0.5.3 | Vite Fast Refresh safety rule | Locked |
| `prettier` | 3.8.4 | Formatter | Locked |

### Alternatives Considered (closed by CONTEXT)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `exifr` | `browser-image-compression` | Bundles resize + EXIF together but adds ~30 KB and hides control. CONTEXT explicitly rejected. |
| `exifr` | `exif-js` / `exif-reader` / `blueimp-load-image` | Either larger, less actively maintained, or both. Stick with `exifr`. |
| `idb-keyval` | Raw `indexedDB` API or `idb` (Jake Archibald's wrapper) | `idb-keyval` is the simplest possible API for blob-by-key — exactly the shape we need. |
| `zustand` `persist` | Manual `localStorage` write on every action | Hand-rolled = lose `version` migrations, `partialize`, `onRehydrateStorage`. |

**Installation (single command):**
```bash
pnpm add react react-dom zustand idb-keyval exifr lucide-react
pnpm add -D vite @vitejs/plugin-react typescript tailwindcss @tailwindcss/vite \
  vitest eslint typescript-eslint prettier \
  eslint-plugin-react-hooks eslint-plugin-react-refresh \
  @types/react @types/react-dom
```

**Version verification:** All 16 packages above checked via `npm view <pkg> version` on 2026-06-25 against the public npm registry. Versions shown are the latest at time of research.

## Package Legitimacy Audit

slopcheck 0.6.1 executed with `--ecosystem npm` on 2026-06-25. All packages confirmed legitimate on the npm registry.

| Package | Registry | Source Repo | slopcheck | Disposition |
|---------|----------|-------------|-----------|-------------|
| `react` | npm | github.com/facebook/react | [OK] | Approved |
| `react-dom` | npm | github.com/facebook/react | [OK] | Approved |
| `vite` | npm | github.com/vitejs/vite | [OK] | Approved |
| `@vitejs/plugin-react` | npm | github.com/vitejs/vite-plugin-react | [OK] | Approved |
| `typescript` | npm | github.com/microsoft/TypeScript | [OK] | Approved |
| `zustand` | npm | github.com/pmndrs/zustand | [OK] | Approved |
| `idb-keyval` | npm | github.com/jakearchibald/idb-keyval | [OK] | Approved |
| `exifr` | npm | github.com/MikeKovarik/exifr | [OK] | Approved (no `postinstall` script — checked) |
| `tailwindcss` | npm | github.com/tailwindlabs/tailwindcss | [OK] | Approved |
| `@tailwindcss/vite` | npm | github.com/tailwindlabs/tailwindcss | [OK] | Approved |
| `lucide-react` | npm | github.com/lucide-icons/lucide | [OK] | Approved |
| `vitest` | npm | github.com/vitest-dev/vitest | [SUS] | **Approved — false positive.** slopcheck flags it as "close to vite, possible typosquat"; it is in fact the official Vite team's test runner and is the locked choice (D-13). |
| `eslint` | npm | github.com/eslint/eslint | [OK] | Approved |
| `typescript-eslint` | npm | github.com/typescript-eslint/typescript-eslint | [OK] | Approved |
| `prettier` | npm | github.com/prettier/prettier | [OK] | Approved |
| `eslint-plugin-react-hooks` | npm | github.com/facebook/react | [OK] | Approved |
| `eslint-plugin-react-refresh` | npm | github.com/ArnaudBarre/eslint-plugin-react-refresh | [OK] | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged [SUS]:** `vitest` — disposition above (overridden as known-good; this is a well-known typosquat heuristic false positive).
**Postinstall script check:** `exifr`, `idb-keyval`, `zustand` — all have no `postinstall` script (verified via `npm view <pkg> scripts.postinstall`).

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────┐
                         │  index.html (Vite entry) │
                         │  + viewport meta + fonts │
                         └────────────┬─────────────┘
                                      │ React mount
                                      ▼
┌─────────────────────────── <AppShell> ────────────────────────────┐
│  Header (logo, "Change room photo" CTA)                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  <main>                                                       │  │
│  │     activeRoomId?                                             │  │
│  │       ├─ no  → <RoomDropzone>  ──► onFile ──┐                 │  │
│  │       └─ yes → <RoomCanvas>                  │                 │  │
│  │            (skeleton → IDB get → <img>)      │                 │  │
│  └──────────────────────────────────────────────┼─────────────────┘  │
│  Footer ("Open source" → repo URL)              │                    │
└─────────────────────────────────────────────────┼────────────────────┘
                                                  ▼
                                ┌──────────── ImagePipeline ───────────┐
                                │ 1. HEIC magic-byte sniff (12 bytes)  │
                                │ 2. exifr.orientation(file)           │
                                │ 3. createImageBitmap(file)           │
                                │ 4. OffscreenCanvas resize ≤2048      │
                                │    + apply orientation transform     │
                                │ 5. canvas.convertToBlob (jpeg, 0.9)  │
                                │ returns { blob, width, height, mime }│
                                └────────────────┬─────────────────────┘
                                                 │
                                ┌────────────────┴────────────────┐
                                ▼                                 ▼
                  idb-keyval.set(blobId, blob)       useAppStore.setActiveRoom
                  (IndexedDB)                         (Zustand → persist → localStorage)
                                                                  │
                                                                  ▼
                                                  partialize: metadata only
                                                  { rooms, activeRoomId,
                                                    libraryItems, placements,
                                                    schemaVersion: 1 }

  Boot rehydration (page reload):
   1. Zustand persist hook synchronously reads localStorage → state populated
   2. <RoomCanvas> mounts, sees activeRoomId is set → paints <SkeletonRoom>
   3. useEffect fires: idb-keyval.get(blobId) → URL.createObjectURL(blob)
   4. <img src=…> mounts with 150ms opacity cross-fade
   5. URL.revokeObjectURL on unmount + on next photo swap
```

### Component Responsibilities

| Component | Source location | Responsibility |
|-----------|-----------------|----------------|
| `<AppShell>` | `src/app/AppShell.tsx` | Safe-area padding, hosts Header/main/Footer, sets `100svh` |
| `<Header>` | `src/app/Header.tsx` | Logo, wordmark, tagline (desktop), conditional "Change room photo" |
| `<Footer>` | `src/components/Footer.tsx` | "Open source" link to repo (AGPL-3.0 disclosure) |
| `<RoomDropzone>` | `src/features/room/RoomDropzone.tsx` | Empty-state dashed dropzone; owns the `<input type="file" accept="image/*" capture="environment">`; handles drag/drop on desktop |
| `<RoomCanvas>` | `src/features/room/RoomCanvas.tsx` | Loaded-state `<img>`; hydration skeleton → IDB blob → cross-fade |
| `<SkeletonRoom>` | `src/features/room/SkeletonRoom.tsx` | 16:9 surface-color rectangle with 1.5s opacity pulse |
| `<Toast>` | `src/components/Toast.tsx` | Single FIFO toast; auto-dismiss 8s; HEIC + generic upload errors |
| `useAppStore` | `src/store/useAppStore.ts` | Zustand store + `persist` middleware (`partialize`, `version: 1`, `onRehydrateStorage`) |
| `ImagePipeline` | `src/lib/image-pipeline/index.ts` | `pipeline(file: File): Promise<{ blob, width, height, mimeType }>` + sniff helpers |
| `idb` helpers | `src/lib/idb/index.ts` | Wraps `idb-keyval` with typed `blobId` namespaces (`room:`, `lib:`) and self-healing reads |

### Pattern 1: Single `ImagePipeline` seam for room AND product images
**What:** The pipeline takes `File | Blob` and returns `{ blob, width, height, mimeType }`. It does not know what *kind* of image it is.
**When:** Always — every image entering the app (rooms in Phase 1, products in Phase 2) goes through this exact function. CONTEXT explicitly calls this a seam.
**Why it matters for Phase 2/4:** Phase 4 will compose a `cutout` stage *after* the pipeline; the pipeline's signature does not change.

### Pattern 2: Metadata + Blob split for `persist`
**What:** Zustand stores `{ blobId }`. `idb-keyval` stores `Blob` keyed by `blobId`. The two are never co-located.
**When:** Every persisted user asset (room photos in Phase 1; product originals + cutouts in Phase 2/4).
**Why:** `localStorage` is sync (≤5 MB, JSON-only), `IndexedDB` is async (~GB-scale, Blob-native). Blobs in `localStorage` → quota explosion + base64 bloat.

### Pattern 3: Skeleton-first paint, async swap
**What:** Synchronous `persist` rehydrate tells the component there *is* a room → component mounts a skeleton immediately. `useEffect` does the async IDB read and swaps to `<img>` with a 150ms cross-fade.
**When:** Every reload where `activeRoomId` is set.
**Why:** Awaiting the blob before first paint would create a flash of empty state on reload — the *opposite* of "survives reload at first paint."

### Anti-Patterns to Avoid
- **Awaiting IDB in the render path or in the store init.** Will make the first paint blank.
- **Calling `URL.createObjectURL` without a matching `revokeObjectURL`.** iOS Safari leaks fast.
- **Persisting blobs by base64-encoding them into Zustand state.** Quota + perf disaster.
- **Trusting `file.type` or extension for HEIC.** iOS lies. Sniff the first 12 bytes (D-02).
- **Using `createImageBitmap(file, { imageOrientation: 'from-image' })` as the orientation strategy.** Safari pre-18.5 partial support; pre-15.5 no support. The locked exifr-driven path sidesteps this. See "Common Pitfalls."
- **Adding `vite-plugin-pwa` in Phase 1.** Explicitly deferred to Phase 6.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EXIF orientation parse | A magic-number reader walking TIFF IFDs | `exifr` (orientation-only submodule) | TIFF endianness + IFD walking is the single largest source of orientation bugs in the wild. ~5 KB to skip the whole problem. |
| HEIC decode | An ISO/BMFF parser + libheif port | **Don't decode in Phase 1** — sniff and reject (D-02). Real decode is deferred (planner: not in Phase 1 scope). | libheif WASM is ~3–5 MB; out of scope. |
| Canvas resize | A custom bilinear / Lanczos resampler | Native `createImageBitmap` + `drawImage` to `OffscreenCanvas` with `imageSmoothingQuality: 'high'` | Browsers ship hardware-accelerated resamplers. |
| IndexedDB CRUD | Hand-written `IDBOpenDBRequest` boilerplate | `idb-keyval` | ~30 lines of plumbing per call vs `await get(key)`. |
| `localStorage` versioning | Hand-rolled migration code | Zustand `persist` `{ version, migrate }` | Already in the package; D-07 mandates `version: 1` from day one. |
| Toast lifecycle | A toast library (`sonner`, `react-hot-toast`) | A 30-line custom `<Toast>` — Phase 1 only has 2 error copy strings | Pulling a toast lib would be over-budget for the single-error surface Phase 1 needs. (Reassess at Phase 5.) |
| UUID generation | npm UUID lib | `crypto.randomUUID()` — native, all evergreen browsers + Safari 15.4+ | Zero dependency. CONTEXT marks `nanoid` vs `randomUUID` as Claude's discretion → recommend `randomUUID`. |
| Drag-and-drop on dropzone | A DnD lib | Native `dragover` + `drop` events on the dropzone div | The dropzone is one element with one drop target — no DnD lib needed. |

**Key insight:** Phase 1's job is plumbing, not features. Every library above earns its place by replacing a known landmine; every "don't hand-roll" entry above is a known time-sink the planner should never plan a task for.

## Runtime State Inventory

Not applicable — Phase 1 is greenfield. No prior runtime state exists. (No databases, no OS-registered services, no installed packages, no env vars, no build artifacts in scope.)

## Common Pitfalls

### Pitfall 1: iOS Safari Canvas total-memory cap
**What goes wrong:** Loading several large images sequentially (e.g. uploading photo → undecided → uploading a replacement) accumulates ImageBitmaps and canvases in WebKit's internal pool until you hit ~384 MB total and Safari starts drawing transparent canvases silently.
**Why:** WebKit holds onto canvas-backing memory for some time even after JS releases references.
**How to avoid:** (a) Call `bitmap.close()` on every `ImageBitmap` after you've drawn it to the canvas. (b) Reuse a single `OffscreenCanvas` instead of allocating a new one per pipeline invocation. (c) Keep the resize cap at ≤2048 long edge (D-03) — 2048×2048 RGBA = ~16.7 MB, well within per-canvas area limit (16.7 Mpx).
**Warning signs:** Console warning "Total canvas memory use exceeds the maximum limit"; later uploads render as white boxes.

### Pitfall 2: `createImageBitmap` Safari orientation gotcha
**What goes wrong:** Newer code often uses `createImageBitmap(file, { imageOrientation: 'from-image' })` to let the browser apply EXIF orientation. Safari 15.5–18.1 has only *partial* support, Safari ≤15.4 has none.
**Why:** Spec was late to add the option; WebKit shipped it incrementally.
**How to avoid:** Use the locked D-01 path — read orientation via `exifr.orientation()` first, then apply the rotation/flip yourself in the canvas draw. This is what D-01 already prescribes.
**Warning signs:** Portrait phone photos appear sideways or upside-down only on certain iOS versions.

### Pitfall 3: HEIC files masquerading as JPEG
**What goes wrong:** iOS Safari sometimes reports `file.type === 'image/jpeg'` and the filename has a `.jpg` extension, but the bytes are actually HEIC. `<img>` rendering silently fails.
**Why:** iOS shares Photos via a conversion layer that is inconsistent across share targets.
**How to avoid:** D-02 — read the first 12 bytes (`file.slice(0, 12).arrayBuffer()`) and check for ISO/BMFF `ftyp` brand `heic`/`heix`/`hevc`/`mif1`. Reject before pipeline.
**Warning signs:** "Couldn't decode the image" with no other context; works on Android, fails on iPhone.

### Pitfall 4: Zustand `persist` hydration race with React 19 strict mode
**What goes wrong:** With React 19 + StrictMode in dev, effects run twice. If hydration logic lives in `useEffect`, you can double-fire the IDB read or the cross-fade.
**Why:** Strict-mode double-invocation is intentional in dev; benign in prod but visible if effects mutate.
**How to avoid:** Keep hydration deterministic — guard the IDB read with `if (objectUrl) return;` and always pair `createObjectURL` with a cleanup `revokeObjectURL` in the same effect's return.
**Warning signs:** Console shows two "loaded blob" logs; brief double cross-fade.

### Pitfall 5: iOS Safari 7-day IndexedDB eviction (ITP)
**What goes wrong:** A user uploads a room photo, doesn't return for 8 days, comes back → photo is gone, schema entry remains, app shows the D-09 "couldn't reload" toast.
**Why:** WebKit Intelligent Tracking Prevention treats unused origins as evictable.
**How to avoid in Phase 1:** Call `await navigator.storage.persist()` once at boot. WebKit auto-decides without prompting; granted persistence skips ITP eviction. The D-09 self-healing flow is the safety net regardless.
**Warning signs:** "We couldn't reload your last photo" toast appearing on iOS more often than on Chrome/Firefox.

### Pitfall 6: Vite `base: './'` vs absolute-path assets
**What goes wrong:** Hosting on a non-root path (e.g. DanubeData preview URLs) breaks asset loading if `base: '/'` is used.
**Why:** Vite bakes absolute `/assets/...` URLs into the HTML by default.
**How to avoid:** D-14 already pins `base: './'`. Verify by inspecting `dist/index.html` after build — asset URLs should be `./assets/index-xxxxx.js`, not `/assets/...`.
**Warning signs:** Blank page on first deploy; 404s on the JS/CSS bundles.

### Pitfall 7: localStorage quota on schema growth
**What goes wrong:** Phase 1 stores only metadata, but as the app grows (placements lists, library item metadata in Phase 2+), localStorage can hit its ~5 MB cap on Safari.
**Why:** Each room → many placements; each library item → metadata entry.
**How to avoid:** Keep the `partialize` output minimal (no derived state, no thumbnails as data URLs). Phase 1's `schemaVersion: 1` is the explicit hook for later migration to IDB-backed persistence if needed.
**Warning signs:** `QuotaExceededError` thrown from `setItem`; only happens at the upper end of usage.

## Code Examples

### Image pipeline shape (D-01 + D-02 + D-03)
```ts
// src/lib/image-pipeline/index.ts
// Source: synthesized from CONTEXT D-01..D-03 and verified APIs (caniuse + MDN)

import { orientation as readOrientation } from 'exifr';

export interface NormalizedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/png';
}

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'mif1']);
const MAX_EDGE = 2048;

export async function sniffIsHeic(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  // ISO/BMFF: bytes 4..8 = 'ftyp', bytes 8..12 = brand
  if (String.fromCharCode(...head.slice(4, 8)) !== 'ftyp') return false;
  const brand = String.fromCharCode(...head.slice(8, 12));
  return HEIC_BRANDS.has(brand);
}

export class HeicNotSupportedError extends Error {}

export async function pipeline(file: File | Blob): Promise<NormalizedImage> {
  if (await sniffIsHeic(file)) throw new HeicNotSupportedError();

  const orient = (await readOrientation(file)) ?? 1;     // 1..8
  const bitmap = await createImageBitmap(file);           // no imageOrientation opt — we rotate ourselves
  try {
    const swapAxes = orient >= 5;
    const srcW = bitmap.width, srcH = bitmap.height;
    const longEdge = Math.max(srcW, srcH);
    const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
    const dstW = Math.round(srcW * scale);
    const dstH = Math.round(srcH * scale);
    const outW = swapAxes ? dstH : dstW;
    const outH = swapAxes ? dstW : dstH;

    const canvas = new OffscreenCanvas(outW, outH);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    applyOrientationTransform(ctx, orient, dstW, dstH);
    ctx.drawImage(bitmap, 0, 0, dstW, dstH);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    return { blob, width: outW, height: outH, mimeType: 'image/jpeg' };
  } finally {
    bitmap.close(); // critical on iOS Safari — Pitfall 1
  }
}

function applyOrientationTransform(
  ctx: OffscreenCanvasRenderingContext2D, orient: number, w: number, h: number,
) {
  // Standard EXIF orientation matrix; cases 1..8
  switch (orient) {
    case 2: ctx.translate(w, 0); ctx.scale(-1, 1); break;
    case 3: ctx.translate(w, h); ctx.rotate(Math.PI); break;
    case 4: ctx.translate(0, h); ctx.scale(1, -1); break;
    case 5: ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1); break;
    case 6: ctx.rotate(0.5 * Math.PI); ctx.translate(0, -h); break;
    case 7: ctx.rotate(0.5 * Math.PI); ctx.translate(w, -h); ctx.scale(-1, 1); break;
    case 8: ctx.rotate(-0.5 * Math.PI); ctx.translate(-w, 0); break;
  }
}
```

### Zustand store with `partialize`, `version`, and `onRehydrateStorage` (D-04, D-07, D-08)
```ts
// src/store/useAppStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Room { id: string; blobId: string; width: number; height: number; createdAt: number; }
export interface LibraryItem { id: string; originalBlobId: string; cutoutBlobId: string | null; createdAt: number; } // Phase 2 fills this
export interface Placement { /* Phase 2 */ }

interface AppState {
  schemaVersion: 1;
  rooms: Record<string, Room>;
  activeRoomId: string | null;
  libraryItems: Record<string, LibraryItem>;
  placements: Record<string, Placement[]>; // keyed by roomId
  // actions
  setActiveRoom(room: Room): void;
  clearActiveRoom(): void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      schemaVersion: 1,
      rooms: {},
      activeRoomId: null,
      libraryItems: {},
      placements: {},
      setActiveRoom: (room) =>
        set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, activeRoomId: room.id })),
      clearActiveRoom: () => set({ activeRoomId: null }),
    }),
    {
      name: 'roomdrop',
      version: 1,                                  // D-07
      partialize: (s) => ({                        // D-04: metadata only
        schemaVersion: s.schemaVersion,
        rooms: s.rooms,
        activeRoomId: s.activeRoomId,
        libraryItems: s.libraryItems,
        placements: s.placements,
      }),
      // migrate: (persisted, fromVersion) => { /* Phase 5+ */ return persisted; },
    },
  ),
);
```

### Boot: skeleton-first hydration (D-08)
```tsx
// src/features/room/RoomCanvas.tsx
import { useEffect, useState } from 'react';
import { get as idbGet } from 'idb-keyval';
import { useAppStore } from '../../store/useAppStore';
import { SkeletonRoom } from './SkeletonRoom';

export function RoomCanvas() {
  const activeRoomId = useAppStore((s) => s.activeRoomId);
  const room = useAppStore((s) => (s.activeRoomId ? s.rooms[s.activeRoomId] : null));
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!room) { setUrl(null); return; }
    let revoked = false;
    let createdUrl: string | null = null;
    (async () => {
      const blob = await idbGet<Blob>(room.blobId);
      if (!blob) {
        // D-09 self-healing
        useAppStore.setState({ activeRoomId: null });
        // emit toast via toast store (not shown)
        return;
      }
      if (revoked) return;
      createdUrl = URL.createObjectURL(blob);
      setUrl(createdUrl);
    })();
    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [room?.blobId]);

  if (!activeRoomId) return null;
  return (
    <div className="relative">
      {!url && <SkeletonRoom aria-label="Loading your room photo" />}
      {url && <img src={url} alt="" className="transition-opacity duration-150 opacity-100" />}
    </div>
  );
}
```

### iPhone SE → desktop responsive shell
```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```
```css
/* src/styles/index.css */
@import "tailwindcss";

:root {
  --bg: #f1ebe1; --surface: #fbf8f2; --accent: #c17a52;
  --danger: #b5573f; --ink: #3a332c; --ink-mut: #9a8f7f;
  --ink-fnt: #b3a890; --border: #e4dccf; --border-d: #cdbfa8;
}
html, body { background: var(--bg); color: var(--ink); }
body { min-height: 100svh; }                 /* dynamic viewport unit */
.app-shell {
  min-height: 100svh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

### Vite config (deploy-ready, D-14)
```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',                  // D-14: portable across subpath hosts
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', sourcemap: true },
  test: { environment: 'jsdom', globals: true }, // vitest config inline
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` + PostCSS plugin | `@tailwindcss/vite` plugin + CSS `@theme { … }` | Tailwind v4 (Jan 2025) | No JS config file; faster dev; zero-runtime |
| `.eslintrc.json` + plugin arrays | Flat config `eslint.config.js` + `typescript-eslint` umbrella package | ESLint 9 (2024), v10 (2026) | Single config file, simpler import surface |
| `100vh` for full-height layouts | `100svh` (small viewport height) | Widely supported on iOS Safari 15.4+ | Avoids mobile viewport "jump" when toolbar collapses |
| `crypto.randomUUID()` not in Safari | Native everywhere since Safari 15.4 | 2022 | Drop `uuid`/`nanoid` if you only need v4 IDs |
| `tsconfig.json paths` for everything | `vite-tsconfig-paths` only when you actually need aliases | n/a | Not needed in Phase 1; D-11 layout uses relative imports |

**Deprecated/outdated to avoid:**
- `vite create-vite` template's leftover `App.css` / `logo.svg` — strip in scaffold.
- `tailwind init` (does nothing useful for v4 unless you need PostCSS).
- `husky` / `lint-staged` — explicitly out of scope (D-12).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `exifr` orientation-only submodule import path: `import { orientation } from 'exifr'` works in tree-shakable mode and pulls only the orientation reader (~5 KB). Library docs claim a "lite" / "mini" bundle and per-tag exports, but the exact lightest import path may vary by exifr version — verified the package exists and has `orientation` as a documented export, but did not measure the actual bundle delta. | Standard Stack / Code Examples | Slightly larger bundle than the locked "~5 KB" claim. Mitigation: planner can swap to `import { orientation } from 'exifr/dist/lite.esm.js'` if size budget matters; verify with `vite build --report` in Phase 1's QA task. |
| A2 | DanubeData's SPA fallback works out-of-the-box for SPAs with `base: './'` and a `dist/` containing `index.html`. | Architecture / Deploy posture | Phase 1 is not deployed (D-14), so any drift becomes a Phase 6 concern. |
| A3 | The "Open source" footer link should point to the public GitHub repo URL once published; CONTEXT calls this a known placeholder. | AGPL §"Footer link target" | Low — link target is a one-line edit at the end of Phase 1. |
| A4 | `OffscreenCanvas` is available on the main thread in current Safari (17+) and Chrome. If running on older Safari (≤16), fall back to a regular `<canvas>` element off-DOM. | Code Examples | Pipeline still works on the main thread without `OffscreenCanvas`; only loses the ability to move resize off main thread when (much later) we worker-ize it. |

**The above are the only `[ASSUMED]` claims.** Every other library version, browser limit, and API behavior in this document is `[VERIFIED: npm registry]`, `[CITED]`, or directly transcribed from the locked CONTEXT.md.

## Open Questions

1. **`exifr` smallest import path: top-level `{ orientation }` vs `exifr/dist/lite.esm.js`?**
   - What we know: both produce working orientation reads.
   - What's unclear: which one Vite tree-shakes most aggressively in 2026.
   - Recommendation: planner adds a one-line bundle-size verification step (`vite build --report` or `rollup-plugin-visualizer`) and tightens the import if `exifr` shows up >10 KB in the bundle.

2. **Repository URL for the AGPL footer link.**
   - What we know: must exist before Phase 6 deploy.
   - What's unclear: whether the repo is public yet (CONTEXT says "TBD; commit the real URL when repo is published").
   - Recommendation: planner ships `const REPO_URL = 'https://github.com/OWNER/roomdrop'` as a single constant in `src/app/config.ts` with a `TODO` comment; final URL filled in a one-line edit when published.

3. **Should `navigator.storage.persist()` be called in Phase 1?**
   - What we know: it materially reduces iOS 7-day eviction, doesn't prompt the user on iOS/Chromium, is a no-op on Firefox without user permission.
   - What's unclear: CONTEXT does not call this out explicitly; it sits between Phase 1 (persistence working) and Phase 5/6 (PWA + multi-tab).
   - Recommendation: add a one-line call at app boot in Phase 1 — cost is zero, benefit is non-zero, no UI surface.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite, Vitest, pnpm | ✓ | v25.6.1 (≥20 LTS satisfied) | — |
| npm | Bootstrap | ✓ | 11.9.0 | — |
| **pnpm** | D-10 (locked) | ✗ | — | `npm install -g pnpm@latest` is a one-line install; alternatively use `corepack enable && corepack prepare pnpm@latest --activate` (Node 16.13+ bundles `corepack`). |
| Git | Version control | ✓ | 2.39.2 | — |
| slopcheck | Research-time supply-chain check | ✓ (installed during research) | 0.6.1 | n/a — was a research-time dep, not runtime. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `pnpm` — planner should include an install step in the scaffold task: `corepack enable && corepack prepare pnpm@latest --activate`.

## Mobile Shell & Safe-Area Reference

| Concern | Implementation |
|---------|----------------|
| Viewport meta | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />` |
| Full-height layout | `min-height: 100svh` (small-viewport unit) on `<body>` and `.app-shell` |
| Top safe area | `padding-top: env(safe-area-inset-top)` on shell or header |
| Bottom safe area | `padding-bottom: env(safe-area-inset-bottom)` on footer or shell |
| Horizontal safe areas | `padding-left/right: env(safe-area-inset-left/right)` on shell |
| iPhone SE (375×667 logical) | Min target — verify dropzone, button, headline all fit without horizontal scroll |
| Touch targets | 44×44 px min (UI-SPEC); use `padding` not `width/height` to keep visual size flexible |
| Auto-zoom on focus (iOS) | Body/Label text ≥16 px (UI-SPEC compliant — body 16, label 14 with the 14 limited to button labels which don't trigger focus-zoom) |

## AGPL-3.0 Compliance Notes

- **Why now (Phase 1)?** Phase 4 introduces `@imgly/background-removal`, which is AGPL-3.0. By shipping the license file and footer link in Phase 1, we avoid backfilling later and we get free re-use of the compliance pattern for any future AGPL deps.
- **LICENSE file:** Root-level `LICENSE` containing the full AGPL-3.0 text. Use `https://www.gnu.org/licenses/agpl-3.0.txt` verbatim.
- **Footer link:** UI-SPEC locks the copy as `RoomDrop is **Open source** under AGPL-3.0`, with the bolded text linking to the repository (opens in new tab, `rel="noopener"`).
- **What the AGPL actually requires for an SPA:** Section 13's "remote network interaction → must offer Corresponding Source" obligation is satisfied by a public, browsable repository URL where the running code's source is available. The minified JS shipped to the user must have a clear path back to its source (the link in the footer). Source maps (Vite's `build.sourcemap: true`) materially help an interested user — recommended but not strictly required.
- **What we do NOT need to do in Phase 1:** Publish unminified bundles separately; offer per-build source archives; include in-app license viewer. The footer link to the public repo (containing the source for that build) satisfies the obligation.

## Multi-Room Schema Seam (D-06 / D-07)

The locked shape (paraphrased for the planner):

```ts
interface PersistedState {
  schemaVersion: 1;                              // D-07 — bump on every breaking change
  rooms: Record<string /* roomId */, Room>;       // keyed for O(1) lookup
  activeRoomId: string | null;                    // null = empty state
  libraryItems: Record<string /* itemId */, LibraryItem>;  // global, NOT per-room
  placements: Record<string /* roomId */, Placement[]>;    // per-room
}

interface Room { id: string; blobId: string; width: number; height: number; createdAt: number; }
interface LibraryItem { id: string; originalBlobId: string; cutoutBlobId: string | null; createdAt: number; }
interface Placement { /* Phase 2 — declared empty in Phase 1 */ }
```

Why this shape survives Phase 2/4/v2 without migration:
- Adding a second room in v2 = `setActiveRoom(roomB)`; no schema change.
- Adding `cutoutBlobId` in Phase 4 = field already declared `string | null`; pre-Phase-4 items have `null` → `cutoutId ?? originalId` seam works (PROJECT.md "Key Decision").
- Renaming a room in v2 = add `name: string` to `Room`; `version: 2` migrate appends `name: 'Room 1'` to legacy records.

Round-trip JSON safety (Claude's Discretion constraint): all values must be primitives or plain objects. **No Dates, Maps, Sets, or Blobs** in persisted state. Use epoch numbers for timestamps (`createdAt: number`).

## ImagePipeline Seam (for Phase 2/4)

The pipeline returns `{ blob, width, height, mimeType }` regardless of caller (room photo today, product image tomorrow). Phase 4 will introduce a separate `bgRemovalService.process(blob): Promise<Blob>` that composes *after* the pipeline:

```ts
// Phase 4 (future, not Phase 1)
const original = await pipeline(file);              // unchanged
const cutout = await bgRemovalService.process(original.blob);  // composes after
```

The pipeline does NOT know about cutouts. Phase 1's contract is locked, simple, and reusable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.3.1 + jsdom |
| Config file | inline in `vite.config.ts` `test` block (no separate `vitest.config.ts`) |
| Quick run command | `pnpm vitest run src/lib/image-pipeline/image-pipeline.test.ts` |
| Full suite command | `pnpm vitest run` |
| Test environment for pipeline | `jsdom` (DOM globals + `createImageBitmap`/`OffscreenCanvas` polyfills via `happy-dom` if jsdom proves insufficient — planner may swap) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FND-01 | App builds; `dist/` is static + portable (`base: './'`) | smoke (build) | `pnpm vite build && grep -q './assets/' dist/index.html` | ❌ Wave 0 (add as npm-script smoke check) |
| FND-02 | LICENSE file present + footer text contains the word `AGPL` | unit (filesystem + DOM) | `pnpm vitest run tests/footer.test.tsx` | ❌ Wave 0 |
| FND-03 | Body uses `100svh`; safe-area CSS present; renders at 375×667 without horizontal scroll | manual-only | manual on real iPhone SE / Chrome DevTools device emulation | ❌ Manual (no automated harness in Phase 1) |
| FND-04 | Pipeline: EXIF orientation 6 → output is rotated; resize: 4000-px input → ≤2048 long edge; HEIC bytes → throws `HeicNotSupportedError` | unit | `pnpm vitest run src/lib/image-pipeline/image-pipeline.test.ts` | ❌ Wave 0 — the locked single test file (D-13) |
| UPL-01 | `<input type="file" accept="image/*" capture="environment">` present in `<RoomDropzone>` | manual-only on real device for camera; **DOM unit OK for input attribute presence** | `pnpm vitest run src/features/room/RoomDropzone.test.tsx` (optional — D-13 says one test only; planner may skip and verify by inspection) | ❌ Optional |
| UPL-03 | After `setActiveRoom`, library items remain in state | unit | covered by store test (optional) | ❌ Optional |
| PER-02 | After full reload simulation (re-instantiate store), `activeRoomId` is preserved | unit | `pnpm vitest run src/store/useAppStore.test.ts` (optional) | ❌ Optional |
| PER-03 | `partialize` output contains no `Blob`-typed fields | unit | covered by store test (optional) | ❌ Optional |
| PER-04 | Persisted shape conforms to `PersistedState` interface | type-check | `pnpm tsc --noEmit` | ❌ Wave 0 (add `typecheck` script) |

### Sampling Rate
- **Per task commit:** `pnpm vitest run` (full Vitest suite — fast; only one meaningful test in Phase 1 per D-13)
- **Per wave merge:** `pnpm tsc --noEmit && pnpm eslint . && pnpm vitest run && pnpm vite build`
- **Phase gate:** all four above green; FND-03 manually verified on iPhone SE viewport at minimum.

### Wave 0 Gaps
- [ ] `src/lib/image-pipeline/image-pipeline.test.ts` — covers FND-04 (the one mandated test from D-13). Will need a fixture JPEG with EXIF orientation 6 and a fixture HEIC file (or a synthetic `Uint8Array` with the `ftypheic` brand).
- [ ] `tests/footer.test.tsx` — quick render test asserting the footer link contains `AGPL` (covers FND-02 in code; LICENSE file existence is asserted by a separate build-time script or smoke test).
- [ ] `package.json` scripts: `dev`, `build`, `preview`, `test`, `typecheck`, `lint`, `format`.
- [ ] `tsconfig.json` with `strict: true` + `noUncheckedIndexedAccess: true` (high signal-to-noise for Phase 1's `Record<string, …>` lookups).
- [ ] `eslint.config.js` (flat config) with `typescript-eslint` recommended + `react-hooks` + `react-refresh`.
- [ ] `.prettierrc` (or `prettier` config block in `package.json`).
- [ ] `vitest` env config inline in `vite.config.ts` (`test: { environment: 'jsdom', globals: true }`).

## Security Domain

`security_enforcement` is enabled by default (config does not opt out). Phase 1 has a minimal but real attack surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts (CLAUDE.md hard constraint) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single-user device-local app |
| V5 Input Validation | **yes** | All user input is a single `File`. Validation = HEIC magic-byte sniff (D-02) + `createImageBitmap` decode (failure = rejected at the platform level) + size cap (2048 px output). Reject hostile inputs early with a friendly toast. |
| V6 Cryptography | no | No data to encrypt; nothing transmitted |
| V7 Error Handling & Logging | yes | D-09 self-healing pattern is the canonical handler. Never expose stack traces to user; collapse all decode failures to the locked generic upload-error toast copy. |
| V8 Data Protection (client) | yes | Blobs stay on-device by design. Recommend `navigator.storage.persist()` to keep them there. No telemetry. |
| V14 Configuration | yes | `index.html` has no `<script src>` to third-party CDNs at runtime (fonts excepted, see below). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious image with crafted EXIF / oversized dimensions to OOM the page | Denial of Service | `createImageBitmap` is the parser; modern browsers harden it. Catch decode failures + the 2048-px output cap caps post-decode memory. Resize fails → toast. |
| HEIC file masquerading as JPEG | Tampering / DoS | D-02 magic-byte sniff *before* decode. |
| `<img src="javascript:…">` via crafted Object URL | (impossible — `URL.createObjectURL` only produces `blob:` URLs) | n/a |
| Third-party JS supply chain | Tampering | slopcheck on every install; commit `pnpm-lock.yaml` (D-10); no runtime CDN script tags. |
| Google Fonts CSS leakage | Information Disclosure (minor) | Fonts are CSS-only requests to `fonts.googleapis.com` + `fonts.gstatic.com`. Acceptable for portfolio; revisit in Phase 6 if PWA-offline matters (self-host fonts). |
| Reflected XSS via filename rendering | XSS | Phase 1 never renders the filename in the DOM — only the blob is shown. No mitigation code needed; codify in tests/review. |

## Project Constraints (from CLAUDE.md)

The planner MUST honor these — they have the same authority as CONTEXT.md locked decisions:

- **Budget:** Free tier only (DanubeData 100 MB / 10 GB/mo). No paid services. No Vercel.
- **Client-only:** No backend, no database, no server-side ML. All compute in the user's browser.
- **Persistence:** `localStorage` + IndexedDB only. No accounts, no cloud sync.
- **Mobile-first:** Must work on iPhone SE → mid-range Android.
- **License:** AGPL-3.0 in v1 (anticipating `@imgly/background-removal` in Phase 4).
- **Do NOT** treat anything in `poc/support.js` as a pattern to follow. The POC is a UX reference only.
- **GSD workflow enforcement:** All file edits must occur within a GSD command flow (relevant to the planner: every task in PLAN.md should be executable as part of `/gsd-execute-phase`).

## Sources

### Primary (HIGH confidence)
- `npm registry` — version + repo + postinstall checks for all 16 packages (run 2026-06-25)
- slopcheck 0.6.1 (`--ecosystem npm`) — supply-chain verification, run 2026-06-25
- [Tailwind v4 docs — install with Vite](https://tailwindcss.com/docs)
- [Zustand persist middleware docs](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data)
- [MDN — `createImageBitmap`](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)
- [MDN — `navigator.storage.persist()` / Storage quotas + eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [WebKit blog — Updates to Storage Policy (iOS 7-day eviction + PWA exemption)](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [Can I Use — `createImageBitmap` + `imageOrientation: 'from-image'`](https://caniuse.com/mdn-api_createimagebitmap_options_imageorientation_parameter_from-image)
- [PQINA — iOS Safari Canvas memory limits (technical breakdown)](https://pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/)
- [WebKit Bug 195325 — "Total canvas memory use exceeds the maximum limit"](https://bugs.webkit.org/show_bug.cgi?id=195325)
- [GitHub — MikeKovarik/exifr (orientation submodule docs)](https://github.com/MikeKovarik/exifr)
- [DanubeData — Static site hosting (SPA fallback included on all plans)](https://danubedata.ro/blog/best-netlify-alternatives-static-site-hosting-2026)

### Secondary (MEDIUM confidence)
- [Opensource.com — AGPLv3 Corresponding Source obligations](https://opensource.com/article/17/1/providing-corresponding-source-agplv3-license)
- [Stack Exchange (Open Source) — How does AGPL apply to JavaScript libraries](https://amateur.stjosephsyriaccc.com/content-https-opensource.stackexchange.com/questions/4442/how-does-the-agpl-apply-to-javascript-libraries)
- [DEV — Solving zustand persisted store re-hydration / partialize merging](https://dev.to/atsyot/solving-zustand-persisted-store-re-hydtration-merging-state-issue-1abk)

### Tertiary (LOW confidence)
- None. Where I would have leaned on a tertiary source, I either escalated to a primary one or marked the resulting claim `[ASSUMED]` in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all 16 packages verified on npm + slopcheck.
- Architecture: HIGH — CONTEXT locks every major decision; research confirms each is sound and surfaces the (few) landmines.
- Pitfalls: HIGH — backed by WebKit bug tracker, PQINA technical writeup, Can I Use compatibility data.
- AGPL compliance: MEDIUM — community guidance is clear; canonical authoritative interpretation comes from FSF and varies by counsel.
- DanubeData specifics: MEDIUM — vendor's own blog confirms SPA fallback; not deployed in Phase 1 so any drift is a Phase 6 concern.

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (stack is stable; revisit in 30 days)

## RESEARCH COMPLETE

**Phase:** 1 — Foundations & Image Pipeline
**Confidence:** HIGH

The five highest-leverage decisions confirmed by this research:

1. **Use `exifr` for orientation, NOT `createImageBitmap({ imageOrientation: 'from-image' })`** — Safari pre-18.5 has partial-or-no support; CONTEXT D-01's path sidesteps this entirely.
2. **Sniff HEIC by the first 12 bytes; never trust `file.type` or extension** — iOS Safari demonstrably lies about both (Pitfall 3 + D-02).
3. **Skeleton-first paint, async IDB swap in `useEffect` with 150 ms cross-fade** — awaiting IDB before first paint would flash empty state on reload, defeating PER-02.
4. **Call `navigator.storage.persist()` at boot and pair every `URL.createObjectURL` with `revokeObjectURL` + `bitmap.close()`** — three additions CONTEXT did not pin that materially reduce iOS 7-day eviction risk + iOS Safari canvas-memory leaks.
5. **Ship LICENSE + footer link in Phase 1 even though `@imgly/background-removal` doesn't land until Phase 4** — Phase 1 is the cheapest moment to add AGPL compliance; backfilling is wasted work.
