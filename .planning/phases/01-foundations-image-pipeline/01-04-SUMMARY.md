---
phase: 01-foundations-image-pipeline
plan: 04
subsystem: integration-upload-hydration
tags:
  - integration
  - hydration
  - persistence
  - upload-flow
  - self-healing
  - safe-area
requirements_completed:
  - FND-04
  - UPL-01
  - UPL-03
  - PER-02
  - PER-03
dependency_graph:
  requires:
    - image_pipeline
    - heic_magic_byte_sniff
    - exif_orientation_transform
    - app_store_zustand_persist
    - blob_id_namespace_helpers
    - room_dropzone_empty_state
    - skeleton_room_placeholder
    - toast_host_and_store
    - header_with_conditional_change_room_cta
    - app_shell_with_safe_area
    - idb_blob_helpers
  provides:
    - room_upload_hook
    - room_canvas_skeleton_hydration
    - app_wired_to_full_phase1_flow
    - navigator_storage_persist_at_boot
    - d09_self_healing_on_missing_blob
  affects:
    - "src/app/App.tsx — Plan 01 skeletonPing demo removed; branch on activeRoomId"
    - "UI-SPEC toast catalog — D-09 self-heal copy appended"
tech_stack:
  added: []
  patterns:
    - "Direct store-hook subscription in App.tsx (activeRoomId as branch signal)"
    - "App-owned hidden file input for Change-room (persists across dropzone unmount)"
    - "Effect keyed on room.blobId with per-effect `revoked` flag + object-URL cleanup (React 19 StrictMode-safe)"
    - "Two-phase opacity swap: URL commit → rAF → setLoaded(true) → 150ms transition"
    - "Locked-copy toast constants exported from useRoomUpload so RoomCanvas can share the generic error surface"
key_files:
  created:
    - "src/features/room/useRoomUpload.ts"
    - "src/features/room/RoomCanvas.tsx"
    - "pnpm-workspace.yaml"
  modified:
    - "src/app/App.tsx"
    - ".planning/phases/01-foundations-image-pipeline/01-UI-SPEC.md"
decisions:
  - "Task 4 (checkpoint:human-verify) auto-approved in worktree mode; all automated checks green (typecheck/lint/format/vitest 19-passed/build)"
  - "Kept src/app/AppShell.tsx and src/main.tsx untouched — Plan 02's .app-shell CSS class already owns flex-column, and StrictMode + createRoot were already correct from Plan 01"
  - "Restored pnpm-workspace.yaml with `allowBuilds.canvas: false` to unblock `pnpm install` (jsdom's optional native canvas dep). Plan 03 SUMMARY reported deletion but the file recurred after `pnpm install`; setting the value definitively resolves the interactive prompt without approving the native build"
  - "Wired Header's onChangeRoom to an App-owned hidden <input>, not a Header-owned input, so replacing the photo works even though RoomDropzone (which owns its own input) is unmounted while a room is active"
  - "Exported HEIC_TOAST + GENERIC_UPLOAD_TOAST from useRoomUpload so RoomCanvas can share GENERIC_UPLOAD_TOAST for its own IDB-read failure path (single source of truth for locked copy)"
  - "Chose `type ReactElement` return annotation over `JSX.Element` for React 19 compatibility (TS namespace lookup for `JSX` fails under the current @types/react + moduleResolution:bundler combo)"
metrics:
  duration_seconds: 780
  tasks_completed: 4
  files_created: 3
  files_modified: 2
  completed_date: 2026-07-01
---

# Phase 1 Plan 04: End-to-End Integration Summary

**One-liner:** Wired Plans 02 (visual shell) and 03 (pipeline + persisted store) into a working Phase 1 SPA — `useRoomUpload` orchestrates pipeline → IDB → store → old-blob eviction; `RoomCanvas` paints SkeletonRoom synchronously on rehydrate, loads the blob asynchronously, cross-fades an `<img>` over 150 ms, and self-heals when the IDB blob is missing; `App.tsx` branches on `activeRoomId`, mounts `ToastHost`, wires Header's Change-room button to an app-owned hidden input, and calls `navigator.storage.persist()` at boot to dampen iOS 7-day ITP eviction.

## What Was Built

### Task 1 — `useRoomUpload`

`src/features/room/useRoomUpload.ts` exports:

- `HEIC_TOAST` and `GENERIC_UPLOAD_TOAST` — module-level `ToastSpec` constants holding the locked UI-SPEC §"Copywriting Contract" copy verbatim. These are also imported by `RoomCanvas` so both surfaces share the same generic-error string.
- `uploadRoom(file: File): Promise<void>` — snapshots the prior `activeRoomId` + room record from the store, runs `pipeline(file)`, catches `HeicNotSupportedError` → `HEIC_TOAST` (no state mutation), catches any other pipeline error → `GENERIC_UPLOAD_TOAST` (no state mutation). On success mints a fresh UUID via `crypto.randomUUID()`, formats `roomBlobId(id)`, persists via `setBlob(blobId, normalized.blob)` (also wrapped in try/catch → generic toast), builds a `Room` record with `Date.now()`, calls `useAppStore.getState().setActiveRoom(room)`, then — only if a prior room existed and its id differs — awaits `deleteBlob(prior.blobId)` (best-effort, errors swallowed) and evicts the prior room record from the store via an inline `useAppStore.setState`.
- `useRoomUpload(): { uploadRoom }` — trivial hook wrapper for API stability.

Never touches `useAppStore.libraryItems` (UPL-03 by construction; asserted via grep).

**Commit:** `0ceaeb5`

### Task 2 — `RoomCanvas`

`src/features/room/RoomCanvas.tsx` exports `RoomCanvas(): ReactElement | null`. Behavior:

1. Selects `activeRoomId` and derived `room` from `useAppStore`.
2. Returns `null` when `activeRoomId === null` (App.tsx renders `RoomDropzone` in that case).
3. Primary effect keyed on `room?.blobId`: skips on null; otherwise runs an async IIFE that calls `getBlob(blobId)`. If the blob is missing, emits the locked D-09 self-heal toast (`We couldn't reload your last photo` / `Upload again to continue.`) and atomically mutates the store to clear `activeRoomId` + evict the stale room record. If the blob is present, creates an object URL via `URL.createObjectURL(blob)` and stores it in state. Cleanup flips a per-effect `revoked` flag AND calls `URL.revokeObjectURL(createdUrl)` AND resets local view state — StrictMode-safe (Pitfall 4).
4. Secondary effect keyed on `url`: schedules `setLoaded(true)` on the next `requestAnimationFrame` so the initial opacity-0 render commits before the 150 ms opacity transition fires.
5. Render tree: rounded card containing `<SkeletonRoom />` until `loaded`, and the `<img>` (alt=`""`, decorative user content) with `transition: 'opacity 150ms ease-out'`. `onLoad` on the img is a fallback in case rAF timing loses to image decode.

**Commit:** `0b1932d`

### Task 3 — Wire `App.tsx`

`src/app/App.tsx` rewritten:

- Removed the Plan 01 `skeletonPing` demo (`grep -q skeletonPing src/app/App.tsx` → absent).
- Subscribes to `activeRoomId`; renders `<RoomDropzone onFile={uploadRoom} />` when null, `<RoomCanvas />` when set.
- `<Header hasActiveRoom={activeRoomId !== null} onChangeRoom={openPicker} />`.
- `<ToastHost />` mounted inside `<AppShell>` — errors render globally.
- Boot `useEffect` calls `navigator.storage?.persist?.().catch(() => {})` exactly once at mount (Pitfall 5, Open Q #3).
- App-owned hidden `<input type="file" accept="image/*" capture="environment">` for the Change-room flow; on change, forwards `File` to `uploadRoom` and resets `value` to `''` so picking the same file twice re-fires `onChange`.

`src/app/AppShell.tsx` and `src/main.tsx` intentionally NOT modified — `.app-shell` CSS (Plan 02) already declares `display: flex; flex-direction: column`, and `main.tsx` (Plan 01) already renders `<StrictMode><App/></StrictMode>` correctly.

**Commit:** `c5a7405`

### Task 4 — Checkpoint (auto-approved — see Deviations)

Manual acceptance test suite of 16 steps documented in `01-04-PLAN.md`. In worktree mode we ran the automated substrate (typecheck / lint / format / vitest / build) — all green. Browser-driven steps (device emulation, real iPhone smoke, DevTools IDB inspection, cross-fade timing) are deferred to a post-merge action list for the user.

## Verification Results

| Check                      | Command                | Status |
| -------------------------- | ---------------------- | ------ |
| Install & lockfile         | `pnpm install`         | ✅ pass (allowBuilds.canvas: false restored) |
| Typecheck                  | `pnpm typecheck`       | ✅ exit 0 |
| Lint                       | `pnpm lint`            | ✅ exit 0 (clean; no set-state-in-effect, no missing deps) |
| Prettier format            | `pnpm format:check`    | ✅ all files match |
| Vitest full suite          | `pnpm vitest run`      | ✅ 19 passed / 19 total (Plan 03 tests unaffected) |
| Build                      | `pnpm build`           | ✅ dist/index.html 0.69 kB, css 15.99 kB, **js 280.43 kB (gzip 92.26 kB)** |
| Portable asset paths       | `grep -q "./assets/" dist/index.html` | ✅ PORTABLE (D-14) |
| App wires navigator.storage | `grep -q navigator.storage src/app/App.tsx` | ✅ |
| App mounts ToastHost       | `grep -q ToastHost src/app/App.tsx` | ✅ |
| App uses useRoomUpload     | `grep -q useRoomUpload src/app/App.tsx` | ✅ |
| App uses RoomCanvas        | `grep -q RoomCanvas src/app/App.tsx` | ✅ |
| App uses RoomDropzone      | `grep -q RoomDropzone src/app/App.tsx` | ✅ |
| skeletonPing removed       | `! grep -q skeletonPing src/app/App.tsx` | ✅ |
| Plan 01 debug text removed | `! grep -q "Last skeleton ping" src/app/App.tsx` | ✅ |
| useRoomUpload doesn't touch libraryItems | `! grep -q libraryItems src/features/room/useRoomUpload.ts` | ✅ |
| No PWA / husky / Playwright | `package.json` audit | ✅ none present |

### Bundle Delta from Plan 03

- Plan 03 baseline: 192.93 kB (61.19 kB gzip).
- Plan 04: **280.43 kB (92.26 kB gzip)** — Δ **+87.50 kB (raw), +31.07 kB (gzip)**.

The delta is dominated by `exifr` (orientation subpath) + `zustand` middleware + `idb-keyval` all being imported into the entry chunk for the first time via `App.tsx → useRoomUpload → pipeline / useAppStore / setBlob`. The gzip Δ (~31 kB) is within budget for the DanubeData free tier and matches RESEARCH's projected 25–35 kB pipeline import cost. No new dependencies were added in this plan.

## Task 4 Manual Acceptance Test — Auto-Approval Rationale

**Auto-approved** in worktree mode (per checkpoint_handling: "make the best decision based on locked context and UI-SPEC, proceed, and note auto-decisions in SUMMARY.md"). A worktree executor cannot drive a browser, DevTools, an iPhone, or an iOS Safari file-picker sheet; the 16-step manual list is a post-merge action for the user.

### Automated substitutes performed

| Plan Step | Automated substitute in worktree |
|-----------|-----------------------------------|
| 1 — `pnpm install && pnpm dev` boots cleanly | `pnpm install` exits 0; `pnpm build && pnpm preview` builds successfully (preview not run; not needed to prove the bundle) |
| 2 — iPhone SE mobile shell | Plan 02 shipped `.app-shell` + safe-area CSS + tagline `hidden md:inline`; unchanged in Plan 04 |
| 3–4 — Upload happy path | grep confirms `RoomDropzone onFile={uploadRoom}` wire-up; Vitest confirms `pipeline` decodes + resizes + emits `image/jpeg` |
| 5 — EXIF orientation | Vitest `pipeline` test with `portrait-orient-6.jpg` fixture passed in Plan 03 (19/19) — no regression in this plan |
| 6 — ≤2048 cap | Vitest confirms 4000×3000 → long edge 2048, short edge 1536 |
| 7 — HEIC reject | Vitest confirms `pipeline` rejects HEIC with `HeicNotSupportedError`; grep confirms `HEIC_TOAST` copy verbatim in `useRoomUpload.ts` |
| 8 — Reload survives | Code path: Zustand `persist` (Plan 03) rehydrates `activeRoomId` synchronously → `RoomCanvas` renders `<SkeletonRoom>` → useEffect reads IDB → cross-fades img. Reviewed by hand end-to-end |
| 9 — Replace without losing library | `useRoomUpload` provably does not touch `libraryItems` (grep negation) |
| 10 — LICENSE + footer | Plan 01 / 02 unchanged in Plan 04 |
| 11 — partialize (no blobs) | Plan 03 `partialize` shipped — Plan 04 does not modify the store schema |
| 12 — multi-room schema | Plan 03 types unchanged |
| 13 — D-09 self-healing | grep confirms `We couldn't reload your last photo` copy + `activeRoomId: null` state-reset in `RoomCanvas.tsx` |
| 14 — Generic decode failure | grep confirms `GENERIC_UPLOAD_TOAST` and its "Couldn't open that photo" copy |
| 15 — Build portability | `grep -q "./assets/" dist/index.html` → PORTABLE (D-14) |
| 16 — No PWA / Husky / Playwright | package.json audit clean |

### Action required from user post-merge

Run `pnpm install && pnpm dev` and walk PLAN.md Task 4 steps 2–16. Real-device / DevTools smoke steps that require a browser (mobile viewport, iOS camera sheet, live cross-fade timing, DevTools IDB manual delete for D-09, hard reload) still MUST be performed at least once before considering Phase 1 truly deployable.

Recommended smoke checklist for user:

1. Desktop upload → JPEG appears with cross-fade.
2. Desktop reload → SkeletonRoom paints then img cross-fades.
3. DevTools → Application → IndexedDB → delete `room:<uuid>` → hard reload → self-heal toast appears + empty state returns.
4. Upload a HEIC file → HEIC toast copy matches.
5. Change room photo → new photo replaces old; old `room:<uuid>` blob is gone from IDB.
6. iPhone real hardware → header not under notch; picker offers camera + library.
7. `pnpm build && pnpm preview` → repeat steps 1, 3, 4 against production bundle.

## SUMMARY.md `<output>` §Answers

- **All 16 manual acceptance steps passed?** Not empirically verified end-to-end in a browser — see Task 4 auto-approval above. Automated substrate is 100% green; browser-driven steps deferred to user smoke.
- **iPhone SE smoke on real hardware or DevTools?** Neither yet — deferred to post-merge user smoke.
- **HEIC reject tested with real .heic or magic-byte fixture only?** Fixture only (Plan 03's 12-byte magic-byte fixture, exercised via `sniffIsHeic` test). Real iPhone HEIC file smoke is deferred.
- **`navigator.storage.persist()` return value on test device?** Not observed — worktree mode has no browser. Boot call is fire-and-forget with swallowed rejection per RESEARCH Open Q #3.
- **File-overlap confirmation with Plans 02/03:** Confirmed. Files this plan touches: `src/features/room/useRoomUpload.ts` (new), `src/features/room/RoomCanvas.tsx` (new), `src/app/App.tsx` (modified — rewriting content Plan 02 shipped as a placeholder, per its own Known Stubs list), `pnpm-workspace.yaml` (new/restored), `.planning/phases/01-foundations-image-pipeline/01-UI-SPEC.md` (append D-09 toast line). Zero conflict with Plan 03 (which owned `src/lib/image-pipeline/*`, `src/lib/idb/blobIds.ts`, `src/store/*`, `src/test/*`). `src/app/AppShell.tsx` and `src/main.tsx` were listed as this plan's potential targets but no functional changes were required — Plan 02 + Plan 01 already shipped the correct shapes.
- **D-09 toast appended to UI-SPEC catalog?** ✅ appended immediately after the Generic upload error rows in `01-UI-SPEC.md` §"Copywriting Contract".
- **Final `REPO_URL` value?** Placeholder still in source: `export const REPO_URL = 'https://github.com/OWNER/roomdrop';` (Plan 01 already flagged this as a one-line edit before publish, per RESEARCH Open Q #2). Not resolved in this plan.

## Deviations from Plan

### Auto-decisions (parallel worktree mode)

**1. [Auto-decision] Task 4 checkpoint auto-approved**
- **Reason:** Worktree executor has no browser access; the 16-step manual list is inherently a human-driven exercise. Automated substrate is 100% green (typecheck / lint / format / vitest 19-passed / build; portable asset paths confirmed; all task greps pass).
- **Action required from user post-merge:** documented above.

**2. [Rule 3 — Blocking install] Restored `pnpm-workspace.yaml` with `allowBuilds.canvas: false`**
- **Found during:** Task 1 (`pnpm typecheck` implicitly runs `pnpm install`).
- **Issue:** Plan 03 SUMMARY reported deleting `pnpm-workspace.yaml`, but the file was regenerated by pnpm on next `install` with `allowBuilds.canvas: 'set this to true or false'`. Left in that state, every `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS` and blocks typecheck/lint/build.
- **Fix:** Wrote `allowBuilds.canvas: false` explicitly. `canvas@3.2.3` is a jsdom optional native dep; we do NOT want to build it (Plan 03 confirmed the sharp-based polyfill works, and canvas's native binding fails on this Node 25.6.1 host anyway). Setting `false` tells pnpm the decision is deliberate and unblocks the install.
- **Files modified:** `pnpm-workspace.yaml` (new).

**3. [Rule 3 — TypeScript] `ReactElement` instead of `JSX.Element` return annotation**
- **Found during:** Task 2 typecheck.
- **Issue:** `JSX.Element` reference produced TS2503 `Cannot find namespace 'JSX'`. React 19 + `@types/react` 19 + `moduleResolution: bundler` requires the namespace to be imported explicitly (`React.JSX.Element`) or replaced.
- **Fix:** Imported `type ReactElement` from `react` and typed the RoomCanvas return as `ReactElement | null`. Semantically equivalent, avoids the namespace lookup.
- **Files modified:** `src/features/room/RoomCanvas.tsx`.

**4. [Rule 3 — Lint] Restructured RoomCanvas effect to avoid `set-state-in-effect`**
- **Found during:** Task 2 lint.
- **Issue:** `react-hooks/set-state-in-effect` flagged the early-return branch (`if (!room) { setUrl(null); setLoaded(false); return; }`). The rule also warned about a missing dep (`room` was accessed but the effect keyed on `room?.blobId`).
- **Fix:** Extracted `const blobId = room?.blobId ?? null;` and keyed the effect on `blobId`; the null branch now returns early with no setState. The cleanup function still resets local state (permitted by the rule; only in-body setState is flagged), which handles the transition when `blobId` becomes null via a re-run + cleanup cycle.
- **Files modified:** `src/features/room/RoomCanvas.tsx`.

### Additions beyond the plan (all necessary)

**5. [Rule 2 — Shared locked copy] Exported `HEIC_TOAST` + `GENERIC_UPLOAD_TOAST` from `useRoomUpload`**
- **Why:** The plan required `RoomCanvas` to "emit the generic upload-error toast" on its own IDB-read failure path. Duplicating the string in a second file would break the "single source of truth for locked copy" contract. Solution: export the constants from `useRoomUpload` and import in `RoomCanvas`.
- **Impact:** No new API surface; both consumers see the exact locked copy.

**6. [Rule 2 — Defensive] Wrapped `deleteBlob(prior.blobId)` in try/catch**
- **Why:** The plan required deleting the prior room's blob after replace. If `deleteBlob` throws (transient IDB error), the happy-path new room record would already be committed to the store, but the async rejection would surface as an unhandled promise rejection. Swallowing keeps the flow user-visible only as "old blob leaked in IDB until next replace" — which is what threat T-01-04-01 already accepts.
- **Impact:** No user-visible change; robustness improvement.

## Known Stubs

| File | Line | Reason | Resolved By |
|------|------|--------|-------------|
| `src/app/config.ts` | `REPO_URL = '…/OWNER/roomdrop'` | Placeholder from Plan 01 not yet swapped | One-line edit before publish (Plan 01 SUMMARY Known Stubs + RESEARCH Open Q#2) |
| `src/store/types.ts` `Placement` | empty interface | Fields owned by Phase 2 | Phase 2 plan |
| `src/features/library/.gitkeep` | (empty) | Library UI is Phase 2 scope | Phase 2 |
| `src/features/editor/.gitkeep` | (empty) | Editor is Phase 2 scope | Phase 2 |

All stubs are intentional per each carrying plan. No data-rendering placeholders in the Phase 1 UI (the empty-state dropzone is the *deliberate* empty state, not a stub).

## Threat Surface Scan

No new threat surface beyond `<threat_model>` §STRIDE from PLAN.md. Each mitigation implemented as declared:

- **T-01-04-01 (concurrent upload race):** accepted; no UI gate in Phase 1 per UI-SPEC.
- **T-01-04-02 (navigator.storage.persist permission leak):** accepted; call is fire-and-forget with swallowed rejection.
- **T-01-04-03 (localStorage points at missing IDB blob):** mitigated in `RoomCanvas` D-09 branch — emits locked toast + evicts stale room record.
- **T-01-04-04 (EXIF metadata leak):** mitigated upstream by Plan 03's `convertToBlob({ type: 'image/jpeg' })`.
- **T-01-04-05 (object-URL leak):** mitigated — every `URL.createObjectURL` paired with `URL.revokeObjectURL` in a per-effect cleanup; StrictMode-safe `revoked` flag.
- **T-01-04-06 (attacker with device write access):** accepted; local-only threat boundary per CLAUDE.md.
- **T-01-04-07 (XSS via object URL):** mitigated — `URL.createObjectURL` produces only `blob:` URLs; no `dangerouslySetInnerHTML` anywhere.

No `threat_flag` rows.

## Auth Gates

None encountered.

## Self-Check: PASSED

**Files exist (Read / grep verified):**
- ✅ `src/features/room/useRoomUpload.ts`
- ✅ `src/features/room/RoomCanvas.tsx`
- ✅ `src/app/App.tsx` (modified — Plan 01 demo removed)
- ✅ `pnpm-workspace.yaml`
- ✅ `.planning/phases/01-foundations-image-pipeline/01-UI-SPEC.md` (modified — D-09 toast row appended)

**Commits in `git log`:**
- ✅ `0ceaeb5` — `feat(01-04): add useRoomUpload hook orchestrating pipeline + IDB + toast errors`
- ✅ `0b1932d` — `feat(01-04): add RoomCanvas with skeleton-first hydration + D-09 self-heal`
- ✅ `c5a7405` — `feat(01-04): wire App.tsx to full Phase 1 flow (dropzone/canvas + toasts + persist)`

## Commits

| Hash      | Type | Subject                                                                              |
| --------- | ---- | ------------------------------------------------------------------------------------ |
| `0ceaeb5` | feat | `useRoomUpload` hook orchestrating pipeline + IDB + toast errors                     |
| `0b1932d` | feat | `RoomCanvas` with skeleton-first hydration + D-09 self-heal                          |
| `c5a7405` | feat | Wire `App.tsx` to full Phase 1 flow (dropzone/canvas + toasts + persist)             |

(A fourth commit will land after this SUMMARY.md is written, capturing the SUMMARY + the D-09 UI-SPEC line + the restored pnpm-workspace.yaml alongside.)
