# Phase 2: Library & Editor (originals) - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Mode:** Auto-accepted (autonomous run, config mode: yolo)

<domain>
## Phase Boundary

A usable in-room editor: the user uploads product images into a personal library, drops them onto the room photo, and freely moves/scales/rotates/layers/deletes them with touch and mouse — using original uploads (no BG removal yet) via the `cutoutBlobId ?? originalBlobId` seam. Covers UPL-02/04/05, EDT-01..11, PER-01.
</domain>

<decisions>
## Implementation Decisions

### Stage & rendering
- react-konva 19 + Konva 9 (STACK.md recommendation). Three layers: room (listening=false), placements, transformer.
- Stage sized to its container via ResizeObserver; room image scaled to fit ("contain"). `touch-action: none` on the stage container only (Pitfall M1/M8).
- **Placement coordinates are stored in room-image natural pixel space.** The stage applies a single display scale factor. This makes Phase 3 native-resolution export a direct draw with no coordinate conversion.

### Placement model
- `Placement { id, itemId, x, y, scale, rotation, flipX }` — x/y is item center in room-space; scale is uniform (aspect preserved); rotation in degrees; flipX renders as negative scaleX.
- Z-order = array position in `placements[roomId]`; React keys are stable placement ids (Pitfall m1).
- New placements land at room center at ~35% of room width.

### Interaction
- Tap library thumb → place at room center (works identically on touch + mouse). Desktop additionally supports dragging a thumb onto the stage (HTML5 DnD).
- Selection: tap item → Transformer chrome; tap empty stage → deselect. Transformer anchors 24px on touch devices, rotate anchor offset 48px (Pitfall M7).
- Two-finger pinch on the selected node scales + rotates it (custom touch handler on the stage; Konva Transformer covers handle-based transform).
- Selection toolbar (fixed above library strip): bring forward, send backward, duplicate, flip horizontal, delete.
- Delete has one-level undo via an action toast ("Item removed — Undo").

### Library
- Bottom strip on mobile / side rail on desktop showing thumbnails with an "Original" placeholder badge (Phase 4 replaces with BG-removal status).
- Multi-file upload via the same ImagePipeline (HEIC sniff, EXIF, ≤2048px).
- Deleting a library item: removed from the strip; the record + blobs are kept while any placement still references it (`inLibrary: false`); hard-deleted (record + IDB blobs) only when unreferenced.

### Persistence
- Store schema stays version 1 with additive fields (Placement fleshed out, `inLibrary` on LibraryItem defaulting true). Zustand persist continues to write metadata only; blobs stay in IDB.
- Object URLs are created on demand by a shared `useBlobUrl(blobId)` hook and revoked on unmount (Pitfall m7/M12).

### Claude's Discretion
Everything not listed above (component naming, toolbar iconography, exact hit paddings) follows Phase 1 conventions and the UI-SPEC token system.
</decisions>

<code_context>
## Existing Code Insights
- `src/store/useAppStore.ts` — Zustand persist v1, partialize allowlist; extend with placement/library actions.
- `src/lib/image-pipeline` — one door in for all uploads; reuse for product images.
- `src/lib/idb` — typed BlobId helpers (`lib:<uuid>`); cutouts in Phase 4 reuse `lib:` namespace.
- `src/store/toastStore.ts` — extend with an optional action button + non-error variant for undo.
- `src/features/room/RoomCanvas.tsx` — replaced by the Konva editor stage; its blob-loading + self-heal pattern moves into the stage.
</code_context>

<specifics>
## Specific Ideas
POC (`poc/Cushion Stylist.dc.html`) upload → drag → place → reset flow is the UX reference; warm-neutral tokens from 01-UI-SPEC apply.
</specifics>

<deferred>
## Deferred Ideas
- Stage-level pinch zoom (EDT2-06), multi-step undo (EDT2-02), long-press context menu (EDT2-03) — all v2.
</deferred>
