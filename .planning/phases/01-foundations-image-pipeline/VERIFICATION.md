---
phase: 01-foundations-image-pipeline
verified: 2026-07-01T21:10:00Z
status: human_needed
score: 5/5 roadmap success criteria verified by code; 9/9 requirements covered at code level
overrides_applied: 0
requirements_covered:
  - FND-01
  - FND-02
  - FND-03
  - FND-04
  - UPL-01
  - UPL-03
  - PER-02
  - PER-03
  - PER-04
gates:
  typecheck: pass
  lint: pass
  test: pass (19/19)
  build: pass (dist portable)
human_verification:
  - test: "Open dev server on real iPhone / iPhone SE viewport and confirm no horizontal scroll, safe-area padding around notch and home indicator, tagline hidden at mobile widths and visible on desktop"
    expected: "FND-03 mobile shell renders correctly across iPhone SE → desktop with correct safe-area handling"
    why_human: "Static grep cannot verify actual rendered layout, safe-area inset behavior, or responsive breakpoint tagline visibility on real device viewports"
  - test: "Upload a real iPhone HEIC file (not just the 12-byte magic-byte fixture) via desktop file picker"
    expected: "Locked HEIC toast copy appears: title 'That photo format isn't supported yet' + body about Save to Files → JPEG; no photo added to stage"
    why_human: "Only real .heic file exercises full sniff+reject path in a running browser; automated tests use synthetic 12-byte fixture"
  - test: "Upload a portrait iPhone photo with EXIF orientation=6, then inspect stored blob in DevTools → IndexedDB → keyval-store"
    expected: "Rendered photo is upright (not sideways); stored blob dimensions ≤2048 long edge; height > width for portrait"
    why_human: "Automated test uses fixture; needs real-device round-trip to confirm iOS Safari createImageBitmap + convertToBlob path works"
  - test: "Load a room photo, then hard-reload the page"
    expected: "PER-02 first-paint hydration: SkeletonRoom paints briefly, then <img> cross-fades in over 150 ms with no white flash"
    why_human: "Cross-fade timing, skeleton visibility, and first-paint order are visual behaviors requiring browser observation"
  - test: "Click 'Change room photo' with an active photo, select a different photo, then inspect IndexedDB and localStorage['roomdrop']"
    expected: "New photo replaces old with cross-fade; old room:<uuid> IDB entry is gone; libraryItems in persisted JSON is unchanged (structural UPL-03 promise)"
    why_human: "Requires driving picker + inspecting IDB / localStorage state in DevTools"
  - test: "With a room loaded, manually delete the room:<uuid> entry in DevTools → IndexedDB, then hard-reload"
    expected: "D-09 self-heal toast appears ('We couldn't reload your last photo' / 'Upload again to continue.'); app returns to empty-state RoomDropzone; activeRoomId cleared in localStorage"
    why_human: "Requires manual IDB mutation via DevTools plus verifying full recovery flow"
  - test: "Upload a non-image file (e.g. .txt renamed to .jpg)"
    expected: "Generic upload-error toast copy verbatim: 'Couldn't open that photo' / 'The file may be corrupted or too large. Try a different photo.'"
    why_human: "Verifies pipeline catch → showToast wiring end-to-end in a real browser"
  - test: "Click the 'Open source' footer link"
    expected: "Opens REPO_URL (currently placeholder 'https://github.com/OWNER/roomdrop') in a new tab with rel=noopener"
    why_human: "Anchor target opens correctly in real browser; REPO_URL is still a placeholder and needs a real GitHub URL before publish"
  - test: "Run pnpm build && pnpm preview and repeat upload + reload flows on the production bundle"
    expected: "Same behaviors work identically from dist/; grep './assets/' in dist/index.html returns PORTABLE"
    why_human: "Production-bundle smoke on preview server confirms static portability"
---

# Phase 1: Foundations & Image Pipeline — Verification Report

**Phase Goal:** A deployed-ready Vite/React/TS app where a user can upload a room photo from camera or file picker and have it survive reload — with the multi-room schema, AGPL license, and image normalization seams in place from day one.
**Verified:** 2026-07-01
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### ROADMAP Success Criteria (Observable Truths)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Mobile-first responsive shell with safe-area handling (iPhone SE → desktop) | ⚠ CODE-VERIFIED | `src/styles/index.css:35-51` declares `body { min-height: 100svh }` + `.app-shell` with all four `env(safe-area-inset-*)` paddings + column flex. `index.html:5` sets `viewport-fit=cover`. `Header.tsx:24` tagline uses `hidden md:inline`. Layout confirmed to compile; actual rendered behavior needs human viewport test. |
| 2 | Upload room photo from camera / picker; HEIC shows friendly error | ✓ VERIFIED (code) | `RoomDropzone.tsx:89-103` hidden `<input type="file" accept="image/*" capture="environment">`; `useRoomUpload.ts:12-16` HEIC_TOAST with locked copy; `image-pipeline/index.ts:42` sniffs HEIC before decode; `heic-sniff.ts` covers all 4 brands; vitest 19/19 passing including HEIC reject test. |
| 3 | Replace room photo → new one EXIF-oriented + resized ≤2048 px | ✓ VERIFIED (code) | `App.tsx:39-50` app-owned hidden input for change-room; `useRoomUpload.ts:37-91` orchestrates pipeline → setBlob → setActiveRoom → deleteBlob(prior) → evict prior room. `image-pipeline/index.ts:41-77` applies EXIF orient + MAX_EDGE=2048 cap; test suite verifies 4000×3000 → 2048/1536 and orientation=6 → portrait output. |
| 4 | Reload survives; room photo re-appears at first paint | ✓ VERIFIED (code) | `useAppStore.ts:33-60` Zustand `persist` with `name: 'roomdrop'`, `version: 1`, `partialize` (metadata only). `RoomCanvas.tsx:36-117` renders SkeletonRoom synchronously when activeRoomId set, then loads blob from IDB and cross-fades over 150ms. Blob storage in IDB via `idb-keyval` (setBlob/getBlob). Hydration timing needs human observation. |
| 5 | AGPL-3.0 LICENSE file at root + 'Open source' footer link visible | ✓ VERIFIED | `LICENSE` first line: `GNU AFFERO GENERAL PUBLIC LICENSE`, 661 lines total. `Footer.tsx:3-16` renders "RoomDrop is [Open source](REPO_URL) under AGPL-3.0" with `target="_blank" rel="noopener"`. REPO_URL is still placeholder (`OWNER/roomdrop`) — see Known Stubs. |

**Score:** 5/5 success criteria present in code. Criteria 1 and 4 flagged as CODE-VERIFIED — the wiring is correct but visual/rendering behavior requires human browser verification.

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| FND-01 | Vite + React + TS SPA deployable to DanubeData free tier | ✓ SATISFIED | `package.json` has React 19, TypeScript, Vite 8; `vite.config.ts:7` `base: './'`; `pnpm build` produces `dist/assets/...`; `grep './assets/'` in dist/index.html returns PORTABLE. |
| FND-02 | AGPL-3.0 LICENSE + visible 'Open source' footer link | ✓ SATISFIED | `LICENSE` root file (661 lines, GNU AFFERO GENERAL PUBLIC LICENSE); `Footer.tsx:10-13` renders the link to REPO_URL with locked copy `AGPL-3.0`. |
| FND-03 | Mobile-first responsive; `viewport-fit=cover` + `100svh` editor | ⚠ NEEDS HUMAN | `index.html:5` viewport-fit=cover set; `styles/index.css:36,44` body + .app-shell both use `100svh`; `Header.tsx:24` `hidden md:inline` tagline; touch targets ≥44px in RoomDropzone/Header/Toast. Actual iPhone SE viewport rendering not observable programmatically. |
| FND-04 | ImagePipeline: EXIF-orient + reject unsupported + resize ≤2048 | ✓ SATISFIED | `image-pipeline/index.ts:41-77` full pipeline; `heic-sniff.ts:23-30` checks all 4 HEIC brands before decode; `orientation.ts:12-60` covers all 8 EXIF cases; `bitmap.close()` in finally at line 74-76. Test suite: 19/19 passing including magic-byte sniff, HEIC reject, 4000×3000→2048 resize, portrait-orient-6 EXIF correction. |
| UPL-01 | Upload from camera/library on mobile; file picker on desktop | ✓ SATISFIED | `RoomDropzone.tsx:89-103` and `App.tsx:39-50` both use `<input type="file" accept="image/*" capture="environment">` — `capture=environment` triggers iOS camera/library sheet. |
| UPL-03 | Replace active room photo without losing product library | ✓ SATISFIED | `useRoomUpload.ts:37-91` explicitly never touches `libraryItems`; grep negation `! grep -q libraryItems src/features/room/useRoomUpload.ts` passes. Old room's blob is deleted (line 81), old room record evicted (line 85-89), but library slice untouched by construction. |
| PER-02 | State + library survive reload; re-rehydrate at first paint | ✓ SATISFIED (code) | Zustand `persist` middleware persists metadata to localStorage `'roomdrop'` key; `RoomCanvas.tsx:36-117` implements skeleton-first hydration → IDB read → 150ms cross-fade. Hydration order is synchronous store rehydrate → SkeletonRoom immediate paint → async IDB blob read. |
| PER-03 | Blobs in IndexedDB via idb-keyval; only metadata + blob ids in Zustand persist | ✓ SATISFIED | `lib/idb/index.ts:1-24` uses idb-keyval `get/set/del`; `useAppStore.ts:52-58` `partialize` returns only `{schemaVersion, rooms, activeRoomId, libraryItems, placements}` — no Blobs. Store types `Room.blobId: string` (not Blob); `types.ts` explicit "no Date/Map/Set/Blob". |
| PER-04 | Multi-room schema (`rooms[]`, `library_items[]`, `placements[]` keyed by room) | ✓ SATISFIED | `types.ts:46-53` `PersistedState { schemaVersion: 1, rooms: Record<string, Room>, activeRoomId: string \| null, libraryItems: Record<string, LibraryItem>, placements: Record<string, Placement[]> }`. Library is a top-level slice (not per-room) — UPL-03 seam. Placements keyed by roomId. |

**Orphaned requirements:** None. All 9 phase-mapped requirements have code-level evidence.

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | pnpm+Vite+React+TS scaffold | ✓ VERIFIED | pnpm@11.9.0, node>=20 engines pin, all runtime + dev deps present, `test` script uses `--passWithNoTests` (harmless) |
| `LICENSE` | Full AGPL-3.0 text at root | ✓ VERIFIED | 661 lines; first line matches `GNU AFFERO GENERAL PUBLIC LICENSE` |
| `vite.config.ts` | `base: './'` + Tailwind v4 plugin | ✓ VERIFIED | `base: './'` at line 7; `@tailwindcss/vite` plugin at line 8; test.setupFiles wired at line 16 |
| `src/lib/idb/index.ts` | Typed idb-keyval wrapper | ✓ VERIFIED | Exports BlobId branded type + setBlob/getBlob/deleteBlob/skeletonPing |
| `src/lib/idb/blobIds.ts` | Namespaced helpers | ✓ VERIFIED | `roomBlobId(uuid)` and `libBlobId(uuid)` returning typed sub-brands |
| `src/lib/image-pipeline/` | Pipeline + HEIC sniff + orientation | ✓ VERIFIED | All 3 modules present + `image-pipeline.test.ts` covering all behaviors |
| `src/store/useAppStore.ts` | Zustand with persist middleware v1 | ✓ VERIFIED | `persist(...)` + `name: 'roomdrop'` + `version: 1` + `partialize` |
| `src/store/types.ts` | Room/LibraryItem/Placement/PersistedState | ✓ VERIFIED | All 4 interfaces exported; schema matches D-06 verbatim |
| `src/app/App.tsx` | Full-flow wiring | ✓ VERIFIED | Subscribes to activeRoomId, branches Dropzone/Canvas, ToastHost mounted, navigator.storage.persist at boot, change-room input |
| `src/app/AppShell.tsx` | Safe-area shell | ✓ VERIFIED | Renders `.app-shell` div wrapping children |
| `src/app/Header.tsx` | Wordmark + tagline + conditional CTA | ✓ VERIFIED | Marcellus wordmark, tagline `hidden md:inline`, conditional 44px Change-room button gated on hasActiveRoom |
| `src/components/Footer.tsx` | AGPL Open source link | ✓ VERIFIED | Uses REPO_URL, contains `AGPL-3.0`, `target=_blank rel=noopener` |
| `src/components/Toast.tsx`, `ToastHost.tsx` | Single-slot error toast | ✓ VERIFIED | Role=alert, danger left border, dismiss button 44×44 |
| `src/store/toastStore.ts` | Imperative queue outside persist | ✓ VERIFIED | useSyncExternalStore impl; 8s auto-dismiss with prior-timer clear |
| `src/features/room/RoomDropzone.tsx` | Empty-state + drag/drop + picker | ✓ VERIFIED | Locked copy verbatim, capture=environment, drag/drop handlers, keyboard-accessible |
| `src/features/room/SkeletonRoom.tsx` | 16:9 pulse placeholder | ✓ VERIFIED | aspectRatio 16/9, skeleton-pulse animation, aria-label |
| `src/features/room/RoomCanvas.tsx` | Skeleton-first hydration + self-heal | ✓ VERIFIED | getBlob + createObjectURL/revokeObjectURL, D-09 self-heal branch with locked toast + activeRoomId eviction, revoked flag for StrictMode |
| `src/features/room/useRoomUpload.ts` | Full upload orchestration | ✓ VERIFIED | pipeline → setBlob → setActiveRoom → deleteBlob(prior) → evict prior room; HEIC + generic toasts with locked copy |
| `src/test/fixtures/*` | Test fixtures | ✓ VERIFIED | heic-magic-bytes.bin (12 bytes), landscape-4000x3000.jpg (~71 KB), portrait-orient-6.jpg (~252 KB) all present |

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `index.html` | `src/main.tsx` | `<script type=module src=/src/main.tsx>` | ✓ WIRED | index.html:13 |
| `src/main.tsx` | `src/app/App.tsx` | ReactDOM.createRoot mount | ✓ WIRED | main.tsx:9-13 |
| `App.tsx` | `useAppStore` | `useAppStore((s) => s.activeRoomId)` | ✓ WIRED | App.tsx:13 |
| `App.tsx` | `useRoomUpload` | `useRoomUpload()` hook + onFile prop | ✓ WIRED | App.tsx:14,31,47 |
| `App.tsx` | `RoomDropzone`/`RoomCanvas` | activeRoomId branch | ✓ WIRED | App.tsx:31 |
| `App.tsx` | `ToastHost` | Mounted inside AppShell | ✓ WIRED | App.tsx:51 |
| `App.tsx` | `navigator.storage.persist()` | useEffect at boot | ✓ WIRED | App.tsx:19-23 |
| `useRoomUpload.ts` | `pipeline` | `await pipeline(file)` | ✓ WIRED | useRoomUpload.ts:43 |
| `useRoomUpload.ts` | `setBlob` + `roomBlobId` | `setBlob(roomBlobId(id), ...)` | ✓ WIRED | useRoomUpload.ts:54,57 |
| `useRoomUpload.ts` | `useAppStore.setActiveRoom` | `useAppStore.getState().setActiveRoom(room)` | ✓ WIRED | useRoomUpload.ts:73 |
| `useRoomUpload.ts` | `showToast` | HEIC / generic error branches | ✓ WIRED | useRoomUpload.ts:46-48,61 |
| `useRoomUpload.ts` | `deleteBlob` (prior) | Prior room cleanup | ✓ WIRED | useRoomUpload.ts:81 |
| `RoomCanvas.tsx` | `getBlob` | Async load in useEffect | ✓ WIRED | RoomCanvas.tsx:54 |
| `RoomCanvas.tsx` | `URL.createObjectURL` / `revokeObjectURL` | Paired cleanup | ✓ WIRED | RoomCanvas.tsx:67,80 |
| `RoomCanvas.tsx` | D-09 self-heal | `showToast(SELF_HEAL_TOAST)` + `setState({activeRoomId: null, rooms: rest})` | ✓ WIRED | RoomCanvas.tsx:58-64 |
| `Footer.tsx` | `REPO_URL` | Import from `../app/config` | ✓ WIRED | Footer.tsx:1,10 |
| `image-pipeline/index.ts` | `sniffIsHeic` | Called before decode | ✓ WIRED | image-pipeline/index.ts:42 |
| `image-pipeline/index.ts` | `exifr` orientation | Named import + call | ✓ WIRED | image-pipeline/index.ts:1,46 |
| `image-pipeline/index.ts` | `applyOrientationTransform` | Applied to OffscreenCanvas ctx | ✓ WIRED | image-pipeline/index.ts:69 |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RoomCanvas` | `url` (blob URL) | `getBlob(blobId)` from idb-keyval | Yes (real IDB read) | ✓ FLOWING |
| `RoomCanvas` | `room` | `useAppStore((s) => s.rooms[s.activeRoomId])` | Yes (real Zustand persisted state) | ✓ FLOWING |
| `App.tsx` | `activeRoomId` | `useAppStore((s) => s.activeRoomId)` | Yes | ✓ FLOWING |
| `Footer` | `REPO_URL` | `src/app/config.ts` constant | Yes (placeholder value, but real string) | ⚠ STATIC PLACEHOLDER — `OWNER/roomdrop`, needs real GitHub URL before publish |
| `RoomDropzone` | `File` from input | Browser file picker → onFile callback | Yes | ✓ FLOWING |
| `useRoomUpload.uploadRoom` | `normalized` | `pipeline(file)` real decode+resize | Yes | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck | `pnpm typecheck` | exit 0 | ✓ PASS |
| Lint | `pnpm lint` | exit 0 (clean) | ✓ PASS |
| Vitest suite | `pnpm test` | 19/19 passing (image-pipeline.test.ts) | ✓ PASS |
| Build | `pnpm build` | dist produced, 280 KB JS, 92 KB gzip | ✓ PASS |
| Portable asset paths | `grep -q "./assets/" dist/index.html` | PORTABLE | ✓ PASS |
| LICENSE first line | `head -1 LICENSE` | `GNU AFFERO GENERAL PUBLIC LICENSE` | ✓ PASS |
| No PWA plugin | `grep vite-plugin-pwa package.json` | absent | ✓ PASS |
| No Husky | `grep husky package.json` | absent | ✓ PASS |
| No Playwright | `grep @playwright/test package.json` | absent | ✓ PASS |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/config.ts` | 1-3 | `TODO(phase-1-publish)` — REPO_URL is `github.com/OWNER/roomdrop` placeholder | ℹ Info | Referenced follow-up (`RESEARCH Open Q#2`, `phase-1-publish` tag). Not a BLOCKER — the marker is explicitly scoped to pre-publish (Phase 6). Footer link functions but points to a non-existent repo. |
| `src/store/types.ts` | 39 | Empty `Placement` interface | ℹ Info | Intentional Phase 2 seam per plan; ESLint disable comment references it. Not a stub. |
| `src/features/library/.gitkeep`, `src/features/editor/.gitkeep` | - | Empty stub folders | ℹ Info | Explicitly scoped to Phase 2 per D-11 layout. Not a stub in the render path. |

**No BLOCKER or WARNING anti-patterns found.** No unreferenced TODO/FIXME/XXX in touched files. No `return null` / empty-array stubs in render paths (the RoomCanvas `return null` when `activeRoomId===null` is the correct branch signal, not a stub). No console.log leftovers.

## Human Verification Required

See frontmatter `human_verification` for structured items. Summary:

1. **iPhone SE + real device mobile shell** — verify safe-area, tagline hide/show, no horizontal scroll (FND-03).
2. **Real HEIC upload** — verify locked HEIC toast copy in browser (FND-04, UPL-01).
3. **Real portrait EXIF-6 upload** — verify upright render + IDB blob dimensions (FND-04).
4. **Reload cross-fade** — observe SkeletonRoom → 150ms opacity transition on first paint (PER-02).
5. **Change-room replace + library preservation** — verify IDB cleanup + `libraryItems` unchanged (UPL-03).
6. **D-09 self-heal** — manually delete IDB blob, reload, confirm toast + state reset.
7. **Generic decode failure** — upload non-image file, verify generic error toast copy.
8. **Footer link + REPO_URL** — currently placeholder; note this needs real URL before publish.
9. **`pnpm build && pnpm preview` production smoke** — repeat happy path.

## Gaps Summary

**No BLOCKING gaps found.** All 5 ROADMAP success criteria and all 9 phase requirements have code-level satisfaction. All 4 standard gates (typecheck / lint / test / build) pass. Build output is portable (`./assets/...`).

**Notable known-stub:** `REPO_URL` in `src/app/config.ts` is still the placeholder `'https://github.com/OWNER/roomdrop'`. This is a referenced TODO tied to `phase-1-publish` and is a one-line edit before shipping — acceptable for Phase 1 completion per plan.

**Overall verdict:** PASS (with human_needed status). The phase goal is achieved at the code level: every artifact exists, is substantive, is wired correctly, and data flows through the pipeline end-to-end. Automated verification confirms all mechanical criteria. Human verification is required only for the categories that cannot be verified programmatically: visual mobile-shell rendering on real devices, cross-fade timing, real-device iOS camera sheet behavior, live IDB self-heal, and real HEIC file rejection (as distinct from the 12-byte magic-byte fixture).

---

_Verified: 2026-07-01T21:10:00Z_
_Verifier: Claude (gsd-verifier)_
