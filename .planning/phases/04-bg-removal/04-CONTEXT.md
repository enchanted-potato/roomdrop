# Phase 4: In-Browser Background Removal - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Mode:** Auto-accepted (autonomous run, config mode: yolo)

<domain>
## Phase Boundary
Client-side BG removal for library items with Fast/Quality control, honest progress, cancel, re-run, and graceful failure. Covers BGR-01..06 (BGR-07 CDN+PWA caching completes in Phase 6).
</domain>

<decisions>
## Implementation Decisions

### Library & model mapping
- `@imgly/background-removal` v1.7.0 (verified installed). Fast = `isnet_quint8` (~44 MB), Quality = `isnet_fp16` (~80 MB) per STACK.md. Default `publicPath` (staticimgly.com CDN) kept — never self-hosted (Pitfall C7).
- Device: `gpu` when `navigator.gpu.requestAdapter()` yields an adapter, else `cpu` (Pitfall M6 — both checks, async).
- Default mode by WebGPU probe: adapter → Quality, none → Fast. User override persisted in a separate tiny store (`roomdrop-settings` key) so the core schema stays v1.

### Job lifecycle (BGR-01/03/04/05/06)
- Auto-enqueue on every library upload. Jobs run **sequentially** (single in-flight) to bound peak memory (Pitfall C6).
- v1.7.0 has no inference AbortSignal. Cancel = abort the `fetchArgs` signal (kills model download, the long pole) + mark the job cancelled so a late result is discarded and status returns to `none`. No state corruption, no stuck 'processing'.
- Progress: imgly's `progress(key, current, total)` — `fetch:` keys drive a determinate download percentage; compute stage shows indeterminate "Removing…". First large download in a session triggers a one-time info toast with the honest size hint.
- Failure: `bgStatus: 'failed'` + `bgError` reason; original stays placeable via the `cutoutBlobId ?? originalBlobId` seam; error toast names cause → next step.
- Re-run: available when `done` or `failed`; new cutout blob replaces the old (old blob deleted after success).

### UI
- Thumb badge becomes the status surface: "Original" → "Removing… N%" → "Cutout"/"Failed". While processing, the thumb's delete button becomes a cancel (square) button. A small re-run button appears for done/failed items.
- Settings: gear in the header → popover with Fast/Quality radios + size/speed hint copy.

### Claude's Discretion
Exact copy for hints and failure toasts (voice rules from UI-SPEC apply).
</decisions>

<code_context>
## Existing Code Insights
- `LibraryItem.bgStatus/bgError/cutoutBlobId` seams already exist (Phase 2).
- `libBlobId` namespace reused for cutouts.
- Transient per-item progress follows the `toastStore` module pattern (useSyncExternalStore), not the persisted store.
</code_context>

<specifics>
## Specific Ideas
None.
</specifics>

<deferred>
## Deferred Ideas
- Edge-refine brush (BGR2-01), batch re-run on mode switch — v2.
</deferred>
