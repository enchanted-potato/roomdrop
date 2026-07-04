---
phase: quick-260704-knz
plan: 01
subsystem: bg-removal
tags: [background-removal, canvas, flood-fill, library, editor, tdd]
requires:
  - "src/store/types.ts (LibraryItem, BgStatus)"
  - "src/lib/idb (getBlob/setBlob/deleteBlob, BlobId)"
  - "src/lib/idb/blobIds.ts (libBlobId)"
  - "src/store/useAppStore.ts (updateLibraryItem)"
  - "src/features/bg-removal/bgRemovalService.ts (isBgJobActive)"
provides:
  - "pixelOps: pure flood/feather/mask primitives"
  - "ManualCutoutEditor: modal canvas editor"
  - "LibraryThumb wand entry button"
affects:
  - "src/features/library/LibraryPanel.tsx"
tech-stack:
  added: []
  patterns:
    - "Pure DOM-free pixel ops (RgbaImage shape) for jsdom-testable image logic"
    - "Working-res downscale (~800px) + full-res mask upscale on save"
    - "Mirror bgRemovalService save tail: write blob → update store → best-effort delete prev"
key-files:
  created:
    - "src/features/bg-removal/pixelOps.ts"
    - "src/features/bg-removal/pixelOps.test.ts"
    - "src/features/bg-removal/ManualCutoutEditor.tsx"
  modified:
    - "src/features/library/LibraryPanel.tsx"
decisions:
  - "Reset re-runs autoRemoveCorners at the CURRENT tolerance (not a fixed 36) so it returns to a corner-cleared state consistent with the live slider."
  - "Full-res cutout produced by upscaling the working RGBA (alpha included) with smoothing, then reading back its alpha as the mask — keeps item width/height valid."
metrics:
  duration: ~7m
  completed: 2026-07-04
  tasks: 3
  files: 4
  tests_added: 11
---

# Phase quick-260704-knz Plan 01: Manual Background-Colour Removal Editor Summary

Tap-to-remove manual background cutout editor for library items, ported from the PoC's
interactive flood-fill flow — a fallback for when `@imgly/background-removal` mis-detects the
background, working on any thumb that is not mid-ML-job.

## What Was Built

- **`pixelOps.ts`** — pure, DOM-free image primitives operating on an `RgbaImage`
  (`{ data: Uint8ClampedArray; width; height }`): `floodRemoveAt` (4-connected stack flood,
  squared-RGB tolerance vs seed), `autoRemoveCorners`, `feather` (≥5 in-bounds transparent
  neighbours → alpha 130), `extractAlpha`/`applyAlpha` (undo snapshots), and `applyMask`
  (mask → alpha, RGB preserved). Ported verbatim from `poc/Cushion Stylist.dc.html:406-473`.
- **`pixelOps.test.ts`** — 11 vitest cases: tolerance boundary, 4-connectivity (diagonal
  island survives), corner auto-removal keeping a centre subject, feather threshold, alpha
  round-trip, and mask application preserving RGB.
- **`ManualCutoutEditor.tsx`** — mobile-first modal (ConfirmDialog cues: `z-50` overlay,
  `rgba(58,51,44,0.4)` scrim, backdrop + Escape cancel, `role="dialog" aria-modal`). Loads the
  item's ORIGINAL blob, downscales to ~800px working res, auto-clears the 4 corners at tol 36,
  and supports tap/pointer flood-remove, a 0–120 tolerance slider, undo (≤24 snapshots), reset,
  cancel (no writes), and save. Save feathers, upscales the working alpha to natural size,
  applies it to a full-res redraw of the original, encodes PNG, and mirrors the bgRemovalService
  save tail; it early-returns if `isBgJobActive(item.id)`.
- **`LibraryPanel.tsx`** — a per-thumb `Wand2` button (`aria-label="Manually remove
  background"`) at `-bottom-1.5 -left-1.5` (clears the re-run/delete corner buttons), shown only
  when `!processing && !isBgJobActive(item.id)`, opening the editor via local `editorOpen` state.

## Task Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 (RED) | Failing pixel-ops tests | `743d7fe` |
| 1 (GREEN) | pixelOps implementation | `4ab27e6` |
| 1 (fix) | noUncheckedIndexedAccess assertions | `002c35c` |
| 2 | ManualCutoutEditor modal | `b3174d6` |
| 3 | LibraryPanel wand wiring | `3ae58dc` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Non-null assertions for `noUncheckedIndexedAccess`**
- **Found during:** Task 2 (first full `pnpm run typecheck`)
- **Issue:** The project tsconfig enables `noUncheckedIndexedAccess`, so typed-array index
  reads/writes are typed `number | undefined`; the ported hot loops did not compile.
- **Fix:** Added non-null assertions (`d[o]!`) on the in-bounds accesses in `pixelOps.ts` and
  the test fixtures. Behaviour unchanged; the 11 tests stayed green.
- **Files modified:** `pixelOps.ts`, `pixelOps.test.ts`
- **Commit:** `002c35c`

## Threat Model Compliance

- **T-knz-01 (DoS on huge images):** mitigated — editing happens at ~800px working resolution.
- **T-knz-02 (cutout blob overwrite):** mitigated — save mirrors the write-then-update-then-
  best-effort-delete tail; no orphan/loss on failure.
- **T-knz-03 (concurrent ML job + manual save race):** mitigated — wand button hidden while
  processing AND save guards on `isBgJobActive(item.id)`.
- **T-knz-04 (canvas taint):** accepted per plan — all pixels come from same-origin object URLs
  of the user's own blobs.

## Known Stubs

None.

## Verification

- `pnpm run typecheck` — clean.
- `pnpm run lint` — clean.
- `pnpm run test` — 44 passed across 6 files (incl. 11 new pixelOps tests).

## TDD Gate Compliance

Task 1 followed RED (`743d7fe`, `test(...)`) → GREEN (`4ab27e6`, `feat(...)`). No refactor commit
needed. RED failed as expected (module absent) before implementation.
