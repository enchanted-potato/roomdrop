# Summary 02-01: Library & Editor (originals)

**Completed:** 2026-07-04
**Commits:** c438f6d (docs/deps), 0f74f9d (implementation)

## What shipped
- `Placement` schema (room-image natural pixel space; z = array order) + store actions: add/update/remove/undo/duplicate/moveZ, refcounted `removeLibraryItem` (UPL-04, EDT-07..09, PER-01).
- `LibraryPanel` strip: multi-file upload through ImagePipeline, thumbs via `cutoutBlobId ?? originalBlobId`, status badge placeholder, delete (UPL-02/05, EDT-11).
- `EditorStage` (react-konva): room layer (listening=false), placements layer + Transformer (24px anchors / 48px rotate offset on coarse pointers), two-finger pinch scale+rotate committed on gesture end, tap-to-place + desktop drag-drop, `touch-action: none` on stage container only, D-09 self-heal moved from RoomCanvas (EDT-01..06).
- `SelectionToolbar`: bring forward / send backward / duplicate / flip / delete with one-level undo action toast (EDT-07..10).
- Toast gains `info` variant + action button. New `useBlobUrl`/`useHtmlImage` hooks centralize object-URL lifecycle.

## Success criteria trace
1. Library upload + thumbnails + badge — LibraryPanel ✓
2. Drag/place, pinch-scale, rotate touch; corner handles mouse — EditorStage/PlacedItem ✓
3. Select/deselect Transformer chrome; stage doesn't fight scroll (touch-none container, overscroll-behavior none) ✓
4. Forward/backward/duplicate/flip/delete + one-level undo ✓
5. Library delete preserves placements (inLibrary flag + refcounted GC); reload restores via persist ✓ (store tests)

## Deviations
- RoomCanvas.tsx deleted; its blob-load + self-heal behavior lives in EditorStage.
- Hidden-but-referenced library items are never GC'd retroactively when their last placement is removed later — accepted micro-leak, noted for v2.
- Node 22+ global `localStorage` shadow broke zustand persist in vitest; fixed with an in-memory Storage in test setup.

## Verification
`pnpm typecheck` / `lint` / `test` (27 passing) / `build` all green.
