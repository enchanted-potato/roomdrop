# Phase 1: Foundations & Image Pipeline - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Greenfield Vite + React + TS SPA that boots on mobile and desktop, accepts a room photo (camera or file picker), normalizes it through a single `ImagePipeline` (EXIF orient + resize ≤2048px + HEIC reject), persists it so it survives reload, and ships with the multi-room data schema and AGPL-3.0 license already in place. No library, no editor, no export, no BG removal — those are explicitly Phases 2–4.

</domain>

<decisions>
## Implementation Decisions

### Image Pipeline
- **D-01:** Build `ImagePipeline` from `exifr` (orientation-only build, ~5KB) + native `createImageBitmap` + `OffscreenCanvas` resize. No `browser-image-compression`. Reason: keeps bundle lean, full control over each stage.
- **D-02:** HEIC rejection by magic-byte sniff of the first 12 bytes (`ftypheic` / `ftypheix` / `ftyphevc` / `ftypmif1`). Do NOT trust `file.type` or extension — iOS Safari lies about both. On match, emit the locked HEIC toast copy from `01-UI-SPEC.md`.
- **D-03:** Resize policy: long edge ≤2048px, preserve aspect, encode as JPEG quality 0.9 for room photos (final format TBD by planner if PNG retention is needed for transparency — not relevant in Phase 1 since rooms are photos).

### Store & Persistence
- **D-04:** Single Zustand store (`useAppStore`) with `persist` middleware. Middleware `partialize` includes metadata only: `rooms`, `activeRoomId`, `libraryItems`, `placements`, `schemaVersion`. Blobs are NEVER in the persist payload.
- **D-05:** All image blobs live in `idb-keyval` keyed by a generated `blobId` (e.g. `room:<uuid>`, `lib:<uuid>`). Store holds the `blobId` only.
- **D-06:** Multi-room schema as `rooms: Record<roomId, Room>` + `activeRoomId: string | null`. Placements keyed by `roomId` in a separate `Record<roomId, Placement[]>`. Library is global (shared across rooms).
- **D-07:** `schemaVersion: 1` on the persisted payload from day one; persist middleware `version` field set to enable future migrations without data loss.

### Hydration & Failure
- **D-08:** Boot sequence: Zustand rehydrates synchronously from localStorage → if `activeRoomId` exists, mount paints `<SkeletonRoom>` immediately → async `idb-keyval.get(blobId)` → `URL.createObjectURL(blob)` → swap to `<img>` with 150ms opacity cross-fade. Object URLs revoked on unmount and on photo replace.
- **D-09:** IDB read failure (missing blob, corrupted, store missing) is treated as self-healing: clear the stale `activeRoomId` + room record, render the empty-state dropzone, and surface one toast: "We couldn't reload your last photo. Upload again to continue." (New copy line — add to `01-UI-SPEC.md` toast catalog during planning.)

### Tooling & Repo Layout
- **D-10:** Package manager: **pnpm**. Commit `pnpm-lock.yaml`. Engines field pins Node ≥20 LTS.
- **D-11:** `src/` layout — feature-sliced:
  ```
  src/
    app/              # AppShell, routing (none yet), root providers
    features/
      room/           # RoomDropzone, RoomCanvas, SkeletonRoom (Phase 1)
      library/        # stub folder; populated Phase 2
      editor/         # stub folder; populated Phase 2
    lib/
      image-pipeline/ # exifr + canvas + HEIC sniff
      idb/            # idb-keyval wrappers, blobId helpers
    store/            # useAppStore + persist config
    components/       # cross-feature primitives (Toast, Footer)
    styles/           # tailwind.css + tokens
  ```
- **D-12:** ESLint (typescript-eslint, react-hooks, react-refresh) + Prettier set up in Phase 1. Single shared config. Pre-commit not required (no husky in scope).
- **D-13:** Vitest scaffolded in Phase 1 with ONE meaningful test: `image-pipeline.test.ts` covering EXIF orientation correction + resize bounds + HEIC magic-byte rejection. No Playwright, no component tests yet.
- **D-14:** Phase 1 is **deploy-ready, not deployed**. Vite `base: './'`, SPA fallback configured, `dist/` produces a clean static bundle. Actual DanubeData deploy + PWA = Phase 6.

### Claude's Discretion
- Exact `Room` / `LibraryItem` / `Placement` TypeScript shapes (the planner should propose; constraint: must round-trip through `JSON.parse(JSON.stringify(...))` since Zustand `persist` serializes).
- ESLint rule set strictness (recommended + react-hooks recommended is the floor).
- Whether to use `nanoid` or `crypto.randomUUID()` for `roomId` / `blobId` (both fine; pick one and stick with it).
- Vite plugins beyond `@vitejs/plugin-react` (none required in Phase 1).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level (locked)
- `.planning/PROJECT.md` — Core value, constraints, "Key Decisions" table (AGPL, client-only, BYO catalog, DanubeData, BG-removal library swap seam).
- `.planning/REQUIREMENTS.md` — v1 requirements list; Phase 1 owns FND-01, FND-02, FND-03, FND-04, UPL-01, UPL-03, PER-02, PER-03, PER-04.
- `.planning/ROADMAP.md` §"Phase 1" — phase goal + 5 success criteria (the verification target).
- `CLAUDE.md` — Constraints, conventions, and the explicit note: do NOT treat `poc/support.js` as a pattern.

### Phase 1 contracts
- `.planning/phases/01-foundations-image-pipeline/01-UI-SPEC.md` — UI surface, copy catalog, tokens, component inventory, interaction contract for Phase 1. Locked.
- `poc/Cushion Stylist.dc.html` — UX reference (visual direction, copy tone, dropzone shape). Reference only — not a code source.

### Codebase intel
- `.planning/codebase/STACK.md` — Confirms greenfield (no package.json yet).
- `.planning/codebase/ARCHITECTURE.md` — Documents the dc-runtime is prototype-only.
- `.planning/codebase/CONVENTIONS.md` — Confirms no conventions pre-set; this phase establishes them.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `poc/Cushion Stylist.dc.html`: source of truth for visual tokens (already extracted into `01-UI-SPEC.md`); copy tone reference for empty-state and error toasts.
- None other — repo is greenfield. Phase 1 creates the first `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config` (Tailwind v4 uses CSS `@theme`), and ESLint/Prettier config.

### Established Patterns
- None pre-existing. Phase 1 establishes: feature-sliced layout, single Zustand store with metadata-only persistence, `idb-keyval` for blobs, `cutoutId ?? originalId` seam (declared in types now; consumed Phase 2/4).

### Integration Points
- AGPL footer link — must point to the public repository README (URL TBD: planner should leave a `<a href="REPO_URL">` placeholder commented if URL not yet known; commit the real URL when repo is published).
- The `ImagePipeline` is THE seam Phases 2/4 will reuse for product image uploads — its API must accept a `File`/`Blob` and return `{ blob, width, height, mimeType }`, agnostic to whether it's a room or a product image.

</code_context>

<specifics>
## Specific Ideas

- HEIC error toast copy is locked in `01-UI-SPEC.md`; reuse verbatim.
- 150ms cross-fade duration on hydration swap is the desired feel (matches the "Change room photo" cross-fade in the UI-SPEC interaction contract — keep consistent).
- "Open source" footer text is locked in UI-SPEC.

</specifics>

<deferred>
## Deferred Ideas

- **PWA + model caching** — Phase 6 (BGR-07). Do not add `vite-plugin-pwa` in Phase 1; it would confuse the deploy posture.
- **Build-ID footer slot** — Phase 6 fills it; Phase 1 footer leaves the slot empty per UI-SPEC.
- **Library upload UI / drag-from-library / Konva stage / Transformer** — Phase 2.
- **Background removal worker, model download UX, Fast/Quality toggle** — Phase 4.
- **Destructive confirmation dialogs** — Phase 3. Phase 1 "Change room photo" silently replaces per UI-SPEC.
- **BroadcastChannel multi-tab guard** — Phase 5 (PER-06).
- **Sample room + onboarding tooltip + honesty notice** — Phase 5.
- **PNG export at native resolution + Web Share API** — Phase 3.
- **Multi-room UI / room switcher drawer** — v2 (EDT2-01). Schema supports it in v1; UI does not.
- **ZIP backup / restore** — v2 (PER2-01). Considered as iOS Safari 7-day eviction mitigation.

</deferred>

---

*Phase: 1-foundations-image-pipeline*
*Context gathered: 2026-06-25*
