# Walking Skeleton — RoomDrop

**Phase:** 1
**Generated:** 2026-06-25

## Capability Proven End-to-End

A visitor can open RoomDrop in any modern browser, tap a "Choose photo" button (which opens the native file picker), and the app reads + writes a record to IndexedDB on every mount — proving Vite + React + TS + Tailwind v4 + idb-keyval all work together as a deployable static SPA.

> Note: in Plan 01 the file picker only proves the click→input plumbing — the chosen file is **not** yet normalized, persisted, or rendered. Real upload pipeline + persistence land in Plans 03/04 (still Phase 1).

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Vite 7 + React 19 + TypeScript 6 (SPA, no SSR) | CONTEXT D-14; client-only mandate (CLAUDE.md). No backend ever. |
| Package manager | **pnpm** with committed `pnpm-lock.yaml`, engines `node>=20` | CONTEXT D-10; reproducible installs, free corepack activation. |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` plugin + CSS `@theme` tokens | UI-SPEC §"Design System"; v4 zero-runtime CSS-first config. |
| State | Zustand 5 with `persist` middleware (metadata only) | CONTEXT D-04, D-07. `partialize` excludes blobs; `version: 1` from day one. |
| Blob storage | IndexedDB via `idb-keyval` 6 | CONTEXT D-05. Smallest possible IDB wrapper; one `get`/`set` per blob. |
| Image normalization | `exifr` (orientation) + native `createImageBitmap` + `OffscreenCanvas` resize | CONTEXT D-01; no `browser-image-compression`. Manual EXIF rotate sidesteps Safari pre-18.5 `imageOrientation` partial support (RESEARCH Pitfall 2). |
| HEIC handling | Magic-byte sniff of first 12 bytes (`ftypheic/heix/hevc/mif1`) — reject, never decode | CONTEXT D-02; iOS lies about `file.type` (RESEARCH Pitfall 3). |
| Icon set | `lucide-react` tree-shaken | UI-SPEC §"Design System". |
| Fonts | Google Fonts (`Marcellus` + `Mulish`) via `<link rel=preconnect/stylesheet display=swap>` | UI-SPEC. Acceptable third-party request for portfolio scope. |
| Test runner | Vitest 4 (jsdom env) — single meaningful test in Phase 1 | CONTEXT D-13. |
| Lint/format | ESLint flat config + `typescript-eslint` + `react-hooks` + `react-refresh` + Prettier | CONTEXT D-12. No husky. |
| License | AGPL-3.0 LICENSE at repo root + visible "Open source" footer link | CONTEXT D-14 + UI-SPEC; pre-empts Phase 4 `@imgly/background-removal` AGPL obligation. |
| Deploy posture | **Deploy-ready, not deployed.** `base: './'`, SPA `dist/` portable to any subpath host | CONTEXT D-14. DanubeData deploy + PWA = Phase 6. |
| Directory layout | Feature-sliced: `src/app`, `src/features/{room,library,editor}`, `src/lib/{image-pipeline,idb}`, `src/store`, `src/components`, `src/styles` | CONTEXT D-11. `library/` and `editor/` are empty stub folders in Phase 1. |
| ID generation | `crypto.randomUUID()` (native, Safari 15.4+) | CONTEXT discretion; zero deps over `nanoid`. |
| Persistence priming | Call `navigator.storage.persist()` once at boot | RESEARCH Pitfall 5 — dampens iOS 7-day ITP eviction at zero UI cost. |

## Stack Touched in Phase 1 (Walking Skeleton — Plan 01 only)

- [x] Project scaffold (Vite + React + TS + Tailwind v4 + ESLint flat + Prettier + Vitest)
- [x] Routing — single route `/` (no router lib; React mounts `<App>` at root)
- [x] Database — `idb-keyval.set('skeleton:hello', { at: Date.now() })` on first mount; `get` on every subsequent mount and renders timestamp
- [x] UI — "Choose photo" button is wired to a hidden `<input type=file>`; clicking opens the OS picker (no further processing in Plan 01)
- [x] Local-run command: `pnpm install && pnpm dev` opens at `http://localhost:5173/`; `pnpm build && pnpm preview` serves the static `dist/`

## What Is Real vs Stubbed in the Walking Skeleton

| Surface | Plan 01 Walking Skeleton | Final Phase 1 |
|---|---|---|
| Visual design tokens | Default Tailwind + 1 inline brand color stub | Full UI-SPEC tokens (Plan 02) |
| Header / Footer | Plain header + footer with real "Open source" AGPL link | Same + responsive treatment + safe-area padding (Plan 02) |
| Dropzone | Bare `<button>` triggering hidden `<input type=file>` | Full empty-state with dashed border, headline, body copy (Plan 02) |
| ImagePipeline | not present | `lib/image-pipeline` with HEIC sniff + EXIF + resize (Plan 03) |
| Zustand store | not present | `useAppStore` with `persist` + metadata schema (Plan 03) |
| IDB usage | One hard-coded `skeleton:hello` round-trip | `room:<uuid>` blob storage + `lib/idb` helpers (Plans 03/04) |
| Room rendering | not present | `<RoomCanvas>` with skeleton-first hydration + cross-fade (Plan 04) |
| Toast | not present | `<Toast>` for HEIC + generic upload errors (Plan 02 component, Plan 04 emits) |

## Manual Smoke Test (proves the skeleton ships)

After Plan 01 completes:

1. `pnpm install` succeeds; `pnpm-lock.yaml` present.
2. `pnpm dev` boots on `http://localhost:5173/`; page renders headline "RoomDrop" and a "Choose photo" button.
3. Clicking the button opens the native OS file picker.
4. Open DevTools → Application → IndexedDB → `keyval-store` → `keyval` shows a `skeleton:hello` record with a timestamp.
5. Refresh the page; the timestamp on the page matches the IDB record (read on mount).
6. Footer shows: `RoomDrop is Open source under AGPL-3.0` with the link pointing to the configured `REPO_URL`.
7. `pnpm build` produces `dist/index.html`; `grep -q "./assets/" dist/index.html` exits 0 (portable `base: './'` confirmed).
8. `pnpm preview` serves `dist/` and the IDB round-trip still works.

## Out of Scope (Deferred to Later Slices)

- ImagePipeline (EXIF, HEIC sniff, resize) — Plan 03 of this phase
- Mobile shell tokens + safe-area + 100svh + fonts — Plan 02
- Empty-state dropzone visual treatment (dashed border, copy, helper line) — Plan 02
- Multi-room schema + Zustand persist (`partialize`, `version`) — Plan 03
- Skeleton-first hydration + cross-fade RoomCanvas — Plan 04
- Toast component + HEIC error copy + self-healing flow — Plans 02/04
- `navigator.storage.persist()` call — Plan 04
- BroadcastChannel multi-tab guard — Phase 5
- PWA / service worker / model caching — Phase 6
- Actual DanubeData deploy — Phase 6
- Library upload UI, Konva stage, Transformer, drag/scale/rotate — Phase 2
- Background removal worker, Fast/Quality, ONNX model fetch — Phase 4
- PNG export, Web Share, destructive confirmations — Phase 3
- Sample-room onboarding, honesty notice, coachmarks — Phase 5

## Subsequent Slice Plan

Phase 1 fills in the skeleton with three more plans:

- **Plan 02** — Mobile shell, design tokens, fonts, empty-state dropzone, Toast component (UI surface, no real data yet)
- **Plan 03** — `ImagePipeline`, `useAppStore`, `lib/idb` helpers, image-pipeline.test.ts (pure logic + types, no UI changes)
- **Plan 04** — Wire dropzone → pipeline → IDB → store, RoomCanvas with skeleton-first hydration, "Change room photo", toast emission, `navigator.storage.persist()` at boot

Subsequent phases add one vertical slice on top of this skeleton without altering the decisions above:

- Phase 2: User uploads product images into a library and freely places, scales, rotates them on the room
- Phase 3: User exports the designed room as PNG and gets three confirmed destructive actions
- Phase 4: Library items have backgrounds removed in the browser via `@imgly/background-removal`
- Phase 5: Onboarding (honesty notice, sample room, coachmark) + BroadcastChannel multi-tab guard
- Phase 6: Deploy to DanubeData as a PWA with imgly model caching
