# Phase 3: Export & Reset Semantics - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Mode:** Auto-accepted (autonomous run, config mode: yolo)

<domain>
## Phase Boundary
PNG export at the room photo's native resolution with Web Share on mobile / named download on desktop, plus three confirmed destructive actions. Covers EXP-01..03, PER-05.
</domain>

<decisions>
## Implementation Decisions

### Export
- Compositing happens on an offscreen `<canvas>` at `room.width × room.height` — NOT `stage.toBlob()` (Pitfall M9: stage exports at display size). Placements are already stored in room-space, so drawing is 1:1: translate to center, rotate, scale (negative x for flip), draw.
- Delivery: `navigator.canShare({ files })` → `navigator.share` (mobile share sheet, EXP-02); otherwise object-URL `<a download>` (EXP-03). Filename `roomdrop-YYYYMMDD-<6-char id>.png` (Pitfall M10).
- Export button lives in the header (accent, primary) when a room is active; disabled + "Exporting…" while compositing. Failures toast.

### Destructive actions (PER-05)
- Overflow menu (⋯) in the header hosts all three: **Clear placements**, **Change room photo**, **Reset everything**. Each routes through a shared `ConfirmDialog` (custom modal — no `window.confirm`).
- Copy (cause → next step, sentence case, no exclamation):
  - Clear placements: "Clear all placements?" / "Removes every placed item from this room. Your library is kept." / confirm: "Clear placements"
  - Change room photo: "Change room photo?" / "Placements don't carry over to a new photo. Your library is kept." / confirm: "Choose new photo"
  - Reset everything: "Reset everything?" / "Deletes your room photo, library, and placements from this device." / confirm: "Reset everything" (danger fill)
- Change-room now also drops the evicted room's placements (they were silently orphaned in Phase 1/2).
- Reset everything clears the store to initial state and wipes all IDB blobs.

### Claude's Discretion
Dialog styling follows UI-SPEC tokens; focus is trapped minimally (initial focus on Cancel, Escape closes).
</decisions>

<code_context>
## Existing Code Insights
- Placements in room-space (Phase 2 decision) make export a direct draw.
- `useRoomUpload.uploadRoom` already evicts the prior room; extend to placements.
- `lib/idb` needs a `clearAllBlobs()` (idb-keyval `clear`).
</code_context>

<specifics>
## Specific Ideas
None beyond locked copy above.
</specifics>

<deferred>
## Deferred Ideas
- Export quality/size options; JPEG export — v2.
</deferred>
