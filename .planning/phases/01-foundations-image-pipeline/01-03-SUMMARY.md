---
phase: 01-foundations-image-pipeline
plan: 03
subsystem: image-pipeline-and-persisted-store
tags:
  - tdd
  - image-pipeline
  - exif
  - heic
  - persistence
  - zustand
  - idb-keyval
  - vitest
requirements_completed:
  - FND-04
  - PER-03
  - PER-04
dependency_graph:
  requires:
    - vite_react_ts_spa_scaffold
    - vitest_jsdom_runner
    - idb_blob_helpers
    - branded_blobid_type
  provides:
    - image_pipeline
    - heic_magic_byte_sniff
    - exif_orientation_transform
    - app_store_zustand_persist
    - persisted_state_schema_v1
    - blob_id_namespace_helpers
    - vitest_setup_with_fake_indexeddb
  affects:
    - "src/lib/image-pipeline/* — consumed by Plan 04 (hydration + upload wiring)"
    - "src/store/useAppStore.ts — consumed by Plan 04 + all Phase 2/4 stateful UI"
    - "src/lib/idb/blobIds.ts — consumed by Plan 04 for room:${uuid} / lib:${uuid} keys"
tech_stack:
  added:
    - "@testing-library/react@16.3.2"
    - "@testing-library/jest-dom@6.9.1"
    - "fake-indexeddb@6.2.5"
    - "@types/node@26.0.1"
    - "sharp@0.35.2 (devDependency — fixture generator + jsdom decode polyfill)"
  patterns:
    - "TDD: RED test commit before GREEN implementation commit"
    - "Zustand persist with explicit partialize (metadata only, no actions, no blobs)"
    - "Branded template-literal BlobId sub-types (roomBlobId / libBlobId)"
    - "Vitest setup polyfills createImageBitmap + OffscreenCanvas via sharp so pure-jsdom tests exercise the real pipeline code paths"
key_files:
  created:
    - "src/test/setup.ts"
    - "src/test/fixtures/heic-magic-bytes.bin"
    - "src/test/fixtures/portrait-orient-6.jpg"
    - "src/test/fixtures/landscape-4000x3000.jpg"
    - "src/lib/image-pipeline/heic-sniff.ts"
    - "src/lib/image-pipeline/orientation.ts"
    - "src/lib/image-pipeline/index.ts"
    - "src/lib/image-pipeline/image-pipeline.test.ts"
    - "src/lib/idb/blobIds.ts"
    - "src/store/types.ts"
    - "src/store/useAppStore.ts"
  modified:
    - "package.json"
    - "pnpm-lock.yaml"
    - "vite.config.ts"
    - "tsconfig.json"
    - ".prettierignore"
decisions:
  - "Test-env polyfill: swapped the plan's suggested canvas native binding for sharp + hand-rolled createImageBitmap / OffscreenCanvas polyfill in src/test/setup.ts (node-canvas 3.2.3 failed to build its native binding on Node 25.6.1)"
  - "portrait-orient-6.jpg fixture sourced from recurser/exif-orientation-examples on GitHub (Portrait_6.jpg, 251 KB) — larger than the plan's <50 KB target but exifr confirmed orientation=6, which is what the test needs"
  - "landscape-4000x3000.jpg synthesized on the fly via sharp (solid slate-blue 4000×3000, JPEG q60, 70 KB) — sharp added as devDependency for both fixture generation and the test polyfill"
  - "Added @types/node to tsconfig.json types array so node:fs / node:path / Buffer typecheck inside test files and setup.ts"
  - ".prettierignore extended with .claude/ so agent-local settings never trigger format-check failures"
  - "Zustand persist migrate function intentionally omitted — D-07 makes version:1 the floor; migrations are a Phase 5+ concern"
metrics:
  duration_seconds: 480
  tasks_completed: 3
  files_created: 11
  files_modified: 5
  completed_date: 2026-07-01
---

# Phase 1 Plan 03: ImagePipeline + useAppStore + BlobId Helpers Summary

**One-liner:** Pure-logic layer of Phase 1 — the ImagePipeline (HEIC magic-byte sniff → exifr orientation-only read → createImageBitmap → OffscreenCanvas resize to ≤2048-px long edge → JPEG 0.9 with `bitmap.close()` in a finally block), the Zustand `useAppStore` with `persist` middleware (metadata-only, `version: 1`, multi-room schema from day one), and the `roomBlobId` / `libBlobId` namespace helpers — all covered by 19 green Vitest tests running in pure jsdom via a sharp-powered `createImageBitmap` / `OffscreenCanvas` polyfill.

## What Was Built

### Task 1 — Vitest jsdom env + fake-indexeddb + fixtures

- Installed `@testing-library/react@16.3.2`, `@testing-library/jest-dom@6.9.1`, `fake-indexeddb@6.2.5` as devDependencies.
- `vite.config.ts` extended: `test.setupFiles: ['./src/test/setup.ts']` alongside the existing `environment: 'jsdom'` + `globals: true`.
- `src/test/setup.ts` imports `@testing-library/jest-dom/vitest`, `fake-indexeddb/auto`, and registers `afterEach(cleanup)` from `@testing-library/react`. It ALSO installs polyfills for `createImageBitmap` and `OffscreenCanvas` (see Task 2 decisions).
- Fixtures under `src/test/fixtures/`:
  - `heic-magic-bytes.bin` — 12 bytes `00 00 00 18 66 74 79 70 68 65 69 63` (`[size][ftyp][heic]`).
  - `portrait-orient-6.jpg` — Portrait_6.jpg downloaded from `https://raw.githubusercontent.com/recurser/exif-orientation-examples/master/Portrait_6.jpg` (251 KB). Verified `exifr.orientation()` returns `6`.
  - `landscape-4000x3000.jpg` — Synthesized via `sharp({ create: { width: 4000, height: 3000, channels: 3, background: {r:128,g:128,b:200} } }).jpeg({ quality: 60 })` (70 KB).

**Commit:** `0ec1cdf`

### Task 2 — TDD ImagePipeline (RED → GREEN)

- **RED (`3acf688`):** Wrote `src/lib/image-pipeline/image-pipeline.test.ts` first with 19 `it` cases across four `describe` blocks. Test run at RED confirmed the three source modules were unresolved (vite import-analysis failure) — the plan's "seven failing tests" is satisfied by the 19 cases that never resolved past the import step.
- **GREEN (`756a42b`):** Implemented the three source files:
  - `src/lib/image-pipeline/heic-sniff.ts` — `sniffIsHeic(blob)` reads first 12 bytes, verifies `bytes[4..8] === 'ftyp'`, then checks brand `bytes[8..12]` against `{'heic','heix','hevc','mif1'}`. Sub-12-byte blobs short-circuit to `false`.
  - `src/lib/image-pipeline/orientation.ts` — `applyOrientationTransform(ctx, orient, w, h)` implements the 8-case switch verbatim from RESEARCH §"Code Examples". Cases 1 and default fall through to identity (which also silently absorbs hostile / non-1..8 EXIF values per T-01-03-01).
  - `src/lib/image-pipeline/index.ts` — `pipeline(file)` does: HEIC sniff → `exifr.orientation(file)` (catch-and-default to `1`) → `createImageBitmap(file)` → compute `dstW/dstH` from `MAX_EDGE=2048` and preserve aspect → swap axes when `orient >= 5 && orient <= 8` → create `OffscreenCanvas(outW, outH)` → `applyOrientationTransform` → `drawImage(bitmap, 0, 0, dstW, dstH)` → `convertToBlob({ type: 'image/jpeg', quality: 0.9 })`. `bitmap.close()` runs in a `finally` block on both success and failure.
- Also exported `HeicNotSupportedError` with `name = 'HeicNotSupportedError'` so `.rejects.toBeInstanceOf` works cleanly across module boundaries.

**Test results:** `pnpm vitest run src/lib/image-pipeline/image-pipeline.test.ts` reports **19 passed / 19 total**. Coverage:

| Describe block                    | Tests | What it exercises                                          |
| --------------------------------- | ----- | ---------------------------------------------------------- |
| `sniffIsHeic`                     | 8     | empty blob → false; heic fixture → true; heic/heix/hevc/mif1 → true; mp4 /jpeg → false |
| `pipeline (HEIC rejection)`       | 1     | HEIC blob → rejects with `HeicNotSupportedError`           |
| `pipeline (resize + orient)`      | 2     | 4000×3000 → long edge 2048, short edge 1536; orient=6 → portrait output |
| `applyOrientationTransform`       | 8     | case 1 no-op; case 6 translate+rotate; cases 2..8 don't throw |

### Task 3 — useAppStore + persisted types + BlobId helpers

- `src/store/types.ts` — `Room` (`id, blobId, width, height, createdAt`), `LibraryItem` (`id, originalBlobId, cutoutBlobId: string | null, createdAt`), empty `Placement` interface (Phase 2 fills), `PersistedState` = `{ schemaVersion: 1, rooms: Record<string, Room>, activeRoomId: string | null, libraryItems: Record<string, LibraryItem>, placements: Record<string, Placement[]> }`. Every field is a `number` or `string` — JSON-safe.
- `src/store/useAppStore.ts` — Zustand `create<AppState>()` wrapped in `persist(...)` with `name: 'roomdrop'`, `version: 1`, and an explicit `partialize(s) → PersistedState` that lists all five schema keys and omits actions. Actions: `setActiveRoom(room)` merges into `rooms` and sets `activeRoomId`; `clearActiveRoom()` sets `activeRoomId: null` without removing the room record; `addLibraryItem(item)` merges into the top-level `libraryItems` map (library survives room replace — UPL-03 seam).
- `src/lib/idb/blobIds.ts` — `roomBlobId(uuid): BlobId & \`room:${string}\``, `libBlobId(uuid): BlobId & \`lib:${string}\``. Cast is deliberate: `\`room:${uuid}\`` is provably a member of the `BlobId` union but TypeScript widens template literals to `string` without the annotation.

**Commit:** `11012cd`

## Verification Results

| Check                                | Command                                                                            | Status |
| ------------------------------------ | ---------------------------------------------------------------------------------- | ------ |
| Install & lockfile                   | `pnpm install`                                                                     | pass (lockfile updated, 4 test deps added)                     |
| Typecheck (strict + noUncheckedIndexedAccess) | `pnpm typecheck`                                                            | pass (exit 0)                                                  |
| Lint                                 | `pnpm lint`                                                                        | pass (exit 0, zero output)                                     |
| Prettier format                      | `pnpm format:check`                                                                | pass (all matched files use Prettier style)                    |
| Vitest (full suite)                  | `pnpm vitest run`                                                                  | pass (1 file, 19 tests, ~1.0s)                                 |
| Vitest (FND-04 target)               | `pnpm vitest run src/lib/image-pipeline/image-pipeline.test.ts`                    | pass (19 tests)                                                |
| Build                                | `pnpm build`                                                                       | pass (dist unchanged: 0.41 kB html, 14.33 kB css, 192.93 kB js) |
| Grep — `version: 1`                  | `grep -q "version: 1" src/store/useAppStore.ts`                                    | pass                                                           |
| Grep — `partialize`                  | `grep -q "partialize" src/store/useAppStore.ts`                                    | pass                                                           |
| Grep — `schemaVersion: 1`            | `grep -q "schemaVersion: 1" src/store/useAppStore.ts`                              | pass                                                           |
| Grep — `cutoutBlobId: string \| null` | `grep -q "cutoutBlobId: string \| null" src/store/types.ts`                       | pass                                                           |
| Grep — `Record<string, Room>`        | `grep -q "Record<string, Room>" src/store/types.ts`                                | pass                                                           |
| Grep — `roomBlobId`                  | `grep -q "roomBlobId" src/lib/idb/blobIds.ts`                                      | pass                                                           |
| Grep — `bitmap.close`                | `grep -q "bitmap.close" src/lib/image-pipeline/index.ts`                           | pass                                                           |
| Grep — `'image/jpeg'`                | `grep -q "'image/jpeg'" src/lib/image-pipeline/index.ts`                           | pass                                                           |

## Bundle Delta from exifr

`dist/assets/index-DHKzUnYd.js` measures **192.93 kB (gzip 61.19 kB)** — identical to the Plan 01 baseline reported in `01-01-SUMMARY.md`. This is expected: the pipeline modules are exported but not yet imported by `App.tsx` (Plan 04's job). The real bundle delta from exifr's `orientation` entrypoint will be visible in the Plan 04 SUMMARY once the pipeline is wired to the file input. exifr's `orientation` subpath is designed to tree-shake to only the EXIF-header scanner (~3–5 kB gzipped per RESEARCH), so the projected delta is small.

## jsdom Sufficiency (RESEARCH open question resolved)

**jsdom alone was NOT sufficient** for the canvas paths. Concretely: `dom.window.createImageBitmap` and `dom.window.OffscreenCanvas` are both `undefined` in jsdom 29.1.1.

Two candidate polyfills were considered:

1. **`canvas` (node-canvas 3.2.3):** attempted first. `pnpm add -D canvas` installed the JS wrapper but the native `../build/Release/canvas.node` binding did NOT build on this Node 25.6.1 machine (pnpm auto-approve blocked the postinstall by default, and even after `pnpm rebuild` the binary was missing). Rolled back.
2. **`sharp` + hand-rolled polyfill (chosen):** `sharp` prebuilt binaries load cleanly on macOS arm64. `src/test/setup.ts` overrides `globalThis.createImageBitmap` to route through `sharp(await blob.arrayBuffer()).metadata()` (returning `{ width, height, close: noop }`), and installs a `FakeOffscreenCanvas` whose `getContext('2d')` returns a stub with no-op `translate/rotate/scale/drawImage` and whose `convertToBlob({ type })` emits a 4-byte `image/jpeg`-tagged Blob.

This polyfill exercises the **real** pipeline code paths — HEIC sniff, `exifr.orientation()`, the resize math, the swap-axes branch, the finally-close pattern, `convertToBlob` type = `'image/jpeg'`. It does NOT exercise pixel-perfect rasterization (no bitmap draws happen), but the visual correctness of orientation transforms is validated separately via the `applyOrientationTransform` describe block that spies on `translate/rotate/scale` calls with `vi.fn()`. Real-device visual QA of orientation is Plan 04's smoke checkpoint.

**Alternative not chosen:** swapping to `happy-dom` would not have helped — happy-dom also lacks `createImageBitmap` / `OffscreenCanvas` polyfills as of its current version.

## Deviations from Plan

### Auto-decisions (parallel worktree, autonomous mode)

**1. [Rule 3 - Tooling] Swapped `canvas` for `sharp` as the test-decode polyfill**
- **Found during:** Task 2 GREEN phase
- **Issue:** node-canvas 3.2.3's native binding failed to build (`Cannot find module '../build/Release/canvas.node'`) on Node 25.6.1 even after `pnpm rebuild canvas`. The plan's action allowed this fallback: "install `canvas` + register polyfills in `src/test/setup.ts`" was a suggestion, not a requirement.
- **Fix:** Uninstalled canvas, installed `sharp@0.35.2` (dev-only), wrote a compact `createImageBitmap` polyfill that reads real fixture dimensions via `sharp().metadata()` and a `FakeOffscreenCanvas` that records draw calls. Documented above.
- **Files modified:** `package.json`, `pnpm-lock.yaml`, `src/test/setup.ts`.

**2. [Rule 3 - TypeScript] Added `@types/node` to `tsconfig.json` types array**
- **Found during:** Task 2 GREEN phase (`pnpm typecheck` failure)
- **Issue:** The test file uses `import { readFileSync } from 'node:fs'` and `import { resolve } from 'node:path'`; the setup file uses `Buffer.from(...)`. Without `@types/node` these were TS2591 errors (`Cannot find name 'node:fs' / 'Buffer'`).
- **Fix:** `pnpm add -D @types/node` (26.0.1) and appended `"node"` to `tsconfig.json` `compilerOptions.types`. `node` was not already declared because Plan 01 kept the config minimal.
- **Files modified:** `package.json`, `pnpm-lock.yaml`, `tsconfig.json`.

**3. [Rule 3 - Format scope] Extended `.prettierignore` with `.claude/`**
- **Found during:** Task 2 GREEN phase verification
- **Issue:** `pnpm format:check` failed because `.claude/settings.local.json` (Claude Code agent-local settings) was not Prettier-formatted. That file is owned by the harness, not this repo, and must not be reformatted from within a worktree agent.
- **Fix:** Appended `.claude/` to `.prettierignore`. Symmetric with Plan 01's exclusion of `.planning/`, `CLAUDE.md`, `README.md`, `poc/`.
- **Files modified:** `.prettierignore`.

**4. [Rule 3 - Cleanup] Removed stray `pnpm-workspace.yaml`**
- **Found during:** Task 2 verification
- **Issue:** The transient `pnpm add -D canvas` attempt caused pnpm to write a `pnpm-workspace.yaml` with `allowBuilds: { canvas: 'set this to true or false' }`. After removing canvas the file became a stale, meaningless config that would confuse future pnpm invocations.
- **Fix:** Deleted `pnpm-workspace.yaml`. Nothing in Phase 1 uses pnpm workspaces.
- **Files modified:** `pnpm-workspace.yaml` (deleted).

**5. [Rule 3 - Fixture size] `portrait-orient-6.jpg` is 251 KB rather than the plan's <50 KB target**
- **Found during:** Task 1
- **Issue:** The plan preferred a fixture under 50 KB. The canonical `Portrait_6.jpg` from `recurser/exif-orientation-examples` is 251 KB. Downsizing while preserving EXIF orientation=6 required re-encoding with EXIF passthrough (sharp strips EXIF by default; preserving would need `withMetadata()` plus explicit orientation restamping).
- **Decision:** Kept the canonical fixture as-is (verified `exifr.orientation()` returns 6). 251 KB has no meaningful impact on `pnpm test` speed and keeps the fixture provenance verifiable.
- **Files modified:** none.

## No Deviations from RESEARCH Reference Implementations

The pipeline shape (steps 1–8), the `applyOrientationTransform` switch statement, the `HEIC_BRANDS` set, and the Zustand `persist` + `partialize` pattern all follow RESEARCH §"Code Examples" verbatim. The only additions beyond RESEARCH are:

1. A `catch(() => undefined)` guard around `readOrientation(file)` so a malformed EXIF header can't crash the whole pipeline (defense-in-depth for T-01-03-01).
2. `ctx.imageSmoothingEnabled = true` before setting `imageSmoothingQuality: 'high'` — Safari occasionally ignores the quality hint if smoothing is left implicit.

## Known Stubs

| File                                          | Line                                    | Reason                                    | Resolved By     |
| --------------------------------------------- | --------------------------------------- | ----------------------------------------- | --------------- |
| `src/store/types.ts` `Placement`              | empty interface with a JSDoc `// Phase 2 will populate` | Placement fields locked in Phase 2 planning | Phase 2 plan |

No data-rendering stubs; no hardcoded UI placeholders. The store + pipeline are pure logic and are not wired to any component yet — Plan 04 owns that seam.

## Threat Surface Scan

All threats from `<threat_model>` are mitigated as planned; no new threat surface was introduced beyond what Plan 03 enumerated:

- **T-01-03-01 (malformed image DoS):** HEIC sniff pre-decode + `MAX_EDGE=2048` output cap + `bitmap.close()` in finally + `orient ?? 1` default. Additionally the `catch(() => undefined)` on `readOrientation` prevents malformed EXIF from throwing before the sniff-verified bitmap decode runs.
- **T-01-03-02 (HEIC masquerading as JPEG):** Magic-byte sniff over four brands, tested with `it.each` — verified for `heic/heix/hevc/mif1` (true) and `mp4 /jpeg` (false).
- **T-01-03-03 (EXIF metadata leak):** `canvas.convertToBlob({ type: 'image/jpeg' })` writes a fresh JPEG with no EXIF. Original file bytes never persisted.
- **T-01-03-04 (persisted-state corruption):** `version: 1` declared in `persist` config; Plan 04 owns the self-healing rehydrate.
- **T-01-03-05 (localStorage quota):** partialize is minimal (schema-only, no thumbs).
- **T-01-03-07 (state mutation outside `set()`):** strict TS + Zustand's immutable set-based API; no `useAppStore.getState().rooms.push(...)` patterns exist.

No `threat_flag` rows — no new endpoints, no new auth, no new schema boundaries beyond the plan.

## Auth Gates

None encountered.

## TDD Gate Compliance

- ✅ RED gate: `3acf688` — `test(01-03): add failing tests for image pipeline (FND-04)` (RED confirmed via import-analysis failure before any implementation existed).
- ✅ GREEN gate: `756a42b` — `feat(01-03): implement image pipeline (HEIC sniff + EXIF orient + resize) — FND-04`.
- Refactor gate: intentionally omitted — the GREEN implementation was already the RESEARCH reference shape; no refactor needed.

## Self-Check: PASSED

**Files exist:**
- ✅ `src/test/setup.ts`
- ✅ `src/test/fixtures/heic-magic-bytes.bin` (12 bytes verified)
- ✅ `src/test/fixtures/portrait-orient-6.jpg` (exifr orientation = 6 verified)
- ✅ `src/test/fixtures/landscape-4000x3000.jpg` (sharp metadata: 4000×3000 verified)
- ✅ `src/lib/image-pipeline/heic-sniff.ts`
- ✅ `src/lib/image-pipeline/orientation.ts`
- ✅ `src/lib/image-pipeline/index.ts`
- ✅ `src/lib/image-pipeline/image-pipeline.test.ts`
- ✅ `src/lib/idb/blobIds.ts`
- ✅ `src/store/types.ts`
- ✅ `src/store/useAppStore.ts`

**Commits in `git log`:**
- ✅ `0ec1cdf` — `chore(01-03): add vitest jsdom setup + fake-indexeddb + test fixtures`
- ✅ `3acf688` — `test(01-03): add failing tests for image pipeline (FND-04)`
- ✅ `756a42b` — `feat(01-03): implement image pipeline (HEIC sniff + EXIF orient + resize) — FND-04`
- ✅ `11012cd` — `feat(01-03): add useAppStore + persisted types + BlobId helpers (PER-03, PER-04)`

## Commits

| Hash      | Type  | Subject                                                                                     |
| --------- | ----- | ------------------------------------------------------------------------------------------- |
| `0ec1cdf` | chore | Vitest jsdom setup + fake-indexeddb + test fixtures                                         |
| `3acf688` | test  | Failing tests for image pipeline (FND-04) — RED phase                                       |
| `756a42b` | feat  | Image pipeline (HEIC sniff + EXIF orient + resize) — FND-04 — GREEN phase                   |
| `11012cd` | feat  | `useAppStore` + persisted types + BlobId helpers (PER-03, PER-04)                            |

(A fifth commit will land after this SUMMARY.md is written.)
