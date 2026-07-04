# Summary 03-01: Export & Reset Semantics

**Completed:** 2026-07-04

## What shipped
- `composeRoomPng` — offscreen canvas at room native resolution; placements drawn 1:1 from room-space coords (EXP-01, Pitfall M9); same-origin blobs so no canvas taint (C5).
- `deliverPng` — `navigator.canShare({files})` → share sheet (EXP-02); fallback named `<a download>`; user-cancelled share is not an error. `exportFilename` → `roomdrop-YYYYMMDD-<6char>.png` (EXP-03, M10).
- `ExportButton` in header with busy state + failure toast.
- `ConfirmDialog` (Escape/backdrop cancel, initial focus on Cancel) + `HeaderMenu` (⋯) hosting the three confirmed destructive actions (PER-05): Clear placements, Change room photo (moved from bare header button; now confirmed), Reset everything (store reset + full IDB wipe).
- `clearPlacements` / `dropRoomPlacements` / `resetStore` store actions; room replace now drops the evicted room's placements (fixes silent orphaning from Phase 1/2).

## Success criteria trace
1. PNG at native resolution — composeRoomPng ✓
2. Mobile share sheet — deliverPng canShare path ✓ (device validation pending)
3. Desktop download `roomdrop-YYYYMMDD-<shortId>.png` ✓ (tested)
4. Three confirmed destructive actions; accidental tap harmless (Cancel-focused dialog) ✓

## Verification
`pnpm typecheck` / `lint` / `test` (29) / `build` all green.
