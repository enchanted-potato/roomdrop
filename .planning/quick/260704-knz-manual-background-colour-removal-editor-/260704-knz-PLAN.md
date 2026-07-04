---
phase: quick-260704-knz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/bg-removal/pixelOps.ts
  - src/features/bg-removal/pixelOps.test.ts
  - src/features/bg-removal/ManualCutoutEditor.tsx
  - src/features/library/LibraryPanel.tsx
autonomous: true
requirements: [QUICK-manual-cutout]

must_haves:
  truths:
    - "Each not-processing library thumb shows a wand/eyedropper button labelled 'Manually remove background'"
    - "Tapping the button opens a modal editor loaded from the item's ORIGINAL blob"
    - "On open, the 4 image corners are flood-removed automatically at tolerance 36"
    - "Tapping any pixel flood-removes the contiguous region within the tolerance of the tapped colour"
    - "Tolerance slider, undo, reset, cancel, and save controls all work"
    - "Save writes a full-resolution PNG cutout, marks bgStatus 'done', and deletes the old cutout blob"
    - "Cancel makes no store or blob changes"
    - "The saved cutout preserves the item's stored width/height (full-res, not the downscaled working res)"
  artifacts:
    - path: "src/features/bg-removal/pixelOps.ts"
      provides: "Pure flood-fill, feather, alpha snapshot/restore, and full-res mask application"
      exports: ["floodRemoveAt", "autoRemoveCorners", "feather", "extractAlpha", "applyAlpha", "applyMask"]
    - path: "src/features/bg-removal/pixelOps.test.ts"
      provides: "Vitest coverage for flood tolerance/connectivity, feather rule, mask application"
      contains: "floodRemoveAt"
    - path: "src/features/bg-removal/ManualCutoutEditor.tsx"
      provides: "Modal canvas editor: auto corner removal, tap-to-remove, tolerance, undo, reset, cancel, save"
      exports: ["ManualCutoutEditor"]
      min_lines: 120
    - path: "src/features/library/LibraryPanel.tsx"
      provides: "Wand entry button per thumb that opens the editor"
      contains: "Manually remove background"
  key_links:
    - from: "src/features/library/LibraryPanel.tsx"
      to: "src/features/bg-removal/ManualCutoutEditor.tsx"
      via: "conditional render on local editorOpen state"
      pattern: "ManualCutoutEditor"
    - from: "src/features/bg-removal/ManualCutoutEditor.tsx"
      to: "src/features/bg-removal/pixelOps.ts"
      via: "import pure ops"
      pattern: "from './pixelOps'"
    - from: "src/features/bg-removal/ManualCutoutEditor.tsx"
      to: "IndexedDB + store"
      via: "setBlob / updateLibraryItem / deleteBlob on save"
      pattern: "updateLibraryItem"
---

<objective>
Add a manual background-colour removal editor for library items, ported from the PoC's
interactive flow (`poc/Cushion Stylist.dc.html` lines 365-494). The ML path
(@imgly/background-removal) sometimes mis-detects the background with no recourse; this gives
the user a tap-to-remove fallback that works on any thumb that is not currently processing.

Purpose: Let the user pick the background colour to remove by tapping it, at any time,
without re-running the model.
Output:
- `pixelOps.ts` — pure, tested flood-fill / feather / mask-application logic.
- `ManualCutoutEditor.tsx` — mobile-first modal canvas editor.
- A wand button per `LibraryThumb` that opens the editor on the item's original blob.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

@src/features/bg-removal/bgRemovalService.ts
@src/features/library/LibraryPanel.tsx
@src/components/ConfirmDialog.tsx
@src/lib/hooks/useBlobUrl.ts

<interfaces>
<!-- Contracts the executor must use directly — no codebase exploration needed. -->

From src/store/types.ts:
```typescript
export type BgStatus = 'none' | 'processing' | 'done' | 'failed';
export interface LibraryItem {
  id: string;
  originalBlobId: string;      // IDB key `lib:<uuid>` for the untouched upload
  cutoutBlobId: string | null; // IDB key for the cutout
  width: number; height: number; // natural pixel size of the original
  inLibrary: boolean;
  bgStatus: BgStatus;
  bgError: string | null;
  createdAt: number;
}
```

From src/lib/idb/index.ts:
```typescript
export type BlobId = `room:${string}` | `lib:${string}` | `skeleton:${string}`;
export function setBlob(id: BlobId, blob: Blob): Promise<void>;
export function getBlob(id: BlobId): Promise<Blob | undefined>;
export function deleteBlob(id: BlobId): Promise<void>;
```

From src/lib/idb/blobIds.ts:
```typescript
export function libBlobId(uuid: string): BlobId & `lib:${string}`;
```

From src/store/useAppStore.ts (zustand):
```typescript
useAppStore.getState().updateLibraryItem(id: string, patch: Partial<LibraryItem>): void;
// component access: const updateLibraryItem = useAppStore((s) => s.updateLibraryItem);
```

From src/features/bg-removal/bgRemovalService.ts:
```typescript
export function isBgJobActive(itemId: string): boolean;
```

Save tail to MIRROR (bgRemovalService.ts:108-121):
```typescript
const cutoutId = libBlobId(crypto.randomUUID());
await setBlob(cutoutId, cutout);
const prevCutout = useAppStore.getState().libraryItems[itemId]?.cutoutBlobId;
useAppStore.getState().updateLibraryItem(itemId, { cutoutBlobId: cutoutId, bgStatus: 'done', bgError: null });
if (prevCutout) void deleteBlob(prevCutout as BlobId).catch(() => undefined);
```

PoC pixel logic (poc/Cushion Stylist.dc.html:406-473) — squared-euclidean RGB distance vs
tol², 4-connected stack flood; feather sets alpha→130 where ≥5 of 9 neighbours are transparent.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure pixel-ops module with tests</name>
  <files>src/features/bg-removal/pixelOps.ts, src/features/bg-removal/pixelOps.test.ts</files>
  <behavior>
    Operate on a plain shape `{ data: Uint8ClampedArray; width: number; height: number }` (RGBA,
    4 bytes/pixel) so tests never need a real canvas.
    - floodRemoveAt: from a pixel already fully transparent → no-op. From an opaque pixel, sets
      alpha=0 across the 4-connected region whose RGB is within tolerance (squared distance
      dr²+dg²+db² ≤ tol²) of the SEED colour. A pixel just outside tolerance keeps its alpha.
      Regions that are contiguous only diagonally are NOT removed (4-connectivity).
    - autoRemoveCorners: floodRemoveAt from the 4 corners (0,0),(w-1,0),(0,h-1),(w-1,h-1) at tol.
    - feather: for every still-opaque pixel, if ≥5 of its 9 neighbours (including out-of-bounds
      counted as NOT transparent — match PoC: only in-bounds transparent neighbours count) are
      transparent (alpha===0), set its alpha to 130. Already-transparent pixels untouched.
    - extractAlpha: returns a Uint8ClampedArray length w*h of the alpha channel.
    - applyAlpha: writes a w*h alpha array back into the RGBA data's alpha channel (undo restore).
    - applyMask: given full-res RGBA data and a full-res alpha mask (length w*h), set each
      pixel's alpha to the mask value (used after upscaling the working mask). RGB untouched.
  </behavior>
  <action>
    Create `pixelOps.ts` exporting the pure functions above plus a shared type
    `RgbaImage = { data: Uint8ClampedArray; width: number; height: number }`. Port the flood and
    feather algorithms EXACTLY from PoC lines 406-473 (stack-based flood with a `Uint8Array` seen
    set; feather counting in-bounds transparent neighbours, threshold ≥5, target alpha 130). All
    functions mutate `data` in place except extractAlpha (returns new array). No DOM, no canvas,
    no imports from other src modules — keep it pure so it is unit-testable in jsdom without a 2d
    context. Then write `pixelOps.test.ts` following the vitest style in
    bgRemovalService.test.ts / image-pipeline.test.ts: construct small hand-built RgbaImage
    fixtures (e.g. a 4x4 grid with a known background block and a diagonal-only island) and assert
    tolerance boundaries, 4-connectivity (diagonal island survives), feather threshold, and that
    applyMask copies mask→alpha while preserving RGB.
  </action>
  <verify>
    <automated>pnpm exec vitest run src/features/bg-removal/pixelOps.test.ts</automated>
  </verify>
  <done>pixelOps.test.ts passes; flood respects tolerance + 4-connectivity, feather sets 130 at ≥5 transparent neighbours, applyMask transfers mask to alpha preserving RGB.</done>
</task>

<task type="auto">
  <name>Task 2: ManualCutoutEditor modal component</name>
  <files>src/features/bg-removal/ManualCutoutEditor.tsx</files>
  <action>
    Create `ManualCutoutEditor` (props: `{ item: LibraryItem; onClose: () => void }`). Modal shell
    reusing ConfirmDialog's cues: fixed inset-0 overlay `z-50`, `style={{ background: 'rgba(58,
    51, 44, 0.4)' }}`, backdrop click and Escape both call onClose (cancel), inner panel
    `bg-surface rounded-2xl shadow-lg`, `role="dialog" aria-modal="true"`. Mobile-first: canvas
    sized to fit viewport (`max-width:100%`, `max-height` ~60vh, CSS object-fit contain), controls
    below in a wrapping flex row with min-h-[44px] touch targets.

    On mount: load the ORIGINAL blob via `getBlob(item.originalBlobId as BlobId)`, decode with an
    Image (object URL, revoke after decode), and rasterise to a WORKING canvas downscaled so the
    longest side ≈ 800px (scale = min(1, 800/max(naturalW, naturalH))). Read working ImageData via
    getImageData → keep as an RgbaImage in a ref. Also keep the natural width/height (item.width/
    item.height or image.naturalWidth/Height). Then call autoRemoveCorners(work, tol=36) and paint.

    State: `tol` (number, default 36), plus a repaint trigger. Refs hold the working RgbaImage, the
    displayed canvas element, and an undo history array of alpha snapshots (extractAlpha), capped
    at 24 (shift when exceeding). Paint = putImageData of the working data onto the display canvas.

    Interactions:
    - Tap/click on canvas: map clientX/Y through getBoundingClientRect to working-pixel coords
      (floor((clientX-r.left)/r.width*workW), same for y); push a history snapshot, then
      floodRemoveAt(work, x, y, tol), repaint. Use a pointer handler so touch works.
    - Tolerance slider (range 0-120, step 4): updates `tol`; affects subsequent taps only.
    - Undo: pop history, applyAlpha, repaint; disabled when empty.
    - Reset: restore the pristine working data (keep a copy of the corner-free original decode in a
      ref — snapshot BEFORE autoRemoveCorners, i.e. the raw decode), clear history, then re-run
      autoRemoveCorners so reset returns to the on-open state; repaint.
    - Cancel (button + backdrop + Escape): onClose with NO store/blob writes.
    - Save: (1) feather(work); (2) build a working mask = extractAlpha(work); (3) draw the mask to
      a full-res canvas: create a 1-channel-as-grayscale approach is unnecessary — instead putImage
      the working alpha into a small canvas then drawImage-scale it to natural size with
      `ctx.imageSmoothingEnabled = true` to get an upscaled alpha, OR simpler: draw the WORKING
      rgba canvas scaled up to natural size with smoothing and read back its alpha as the full-res
      mask. Then (4) redraw the ORIGINAL full-res image to a natural-size canvas, read its
      ImageData, applyMask(fullRgba, upscaledAlpha), putImageData back, and `canvas.toBlob(..,
      'image/png')`. (5) Mirror the bgRemovalService save tail: setBlob(libBlobId(uuid), pngBlob),
      read prevCutout, updateLibraryItem(item.id, { cutoutBlobId, bgStatus: 'done', bgError: null
      }), best-effort deleteBlob(prevCutout). Then onClose. Guard: if isBgJobActive(item.id) is
      true, do not save (return early) — the button caller also hides while processing.

    Keep it self-contained: no fenced code, TypeScript strict, Tailwind utility classes matching
    LibraryPanel/ConfirmDialog. Do not simplify the full-res upscale — the saved cutout MUST be at
    natural resolution so item width/height stay valid.
  </action>
  <verify>
    <automated>pnpm run typecheck && pnpm run lint</automated>
  </verify>
  <done>ManualCutoutEditor compiles and lints clean; renders a modal with canvas + tolerance/undo/reset/cancel/save controls; save produces a full-res PNG and mirrors the bgRemovalService save tail; cancel writes nothing.</done>
</task>

<task type="auto">
  <name>Task 3: Wire the wand entry button into LibraryThumb</name>
  <files>src/features/library/LibraryPanel.tsx</files>
  <action>
    In `LibraryThumb`, add local state `const [editorOpen, setEditorOpen] = useState(false)`. Import
    a wand/eyedropper icon from lucide-react (e.g. `Wand2`) and `isBgJobActive` from
    ../bg-removal/bgRemovalService, and `ManualCutoutEditor` from ../bg-removal/ManualCutoutEditor.
    Render a small round button (mirror the existing corner-button styling: `absolute -top-1.5
    -left-1.5 w-6 h-6 rounded-full bg-surface border border-border ... shadow-sm`, but place it so
    it does not collide with the existing re-run button — use `-bottom-1.5 -left-1.5` or offset the
    re-run button; pick placement that keeps both tappable) with `aria-label="Manually remove
    background"`, shown whenever `!processing && !isBgJobActive(item.id)` (i.e. bgStatus
    none/failed/done, never while an ML job runs). onClick → setEditorOpen(true). When editorOpen,
    render `<ManualCutoutEditor item={item} onClose={() => setEditorOpen(false)} />`. Do not disturb
    the existing place/delete/re-run/cancel buttons or the badge. Keep TypeScript strict; the
    button must be hidden (not just disabled) while processing per requirement 4/5.
  </action>
  <verify>
    <automated>pnpm run typecheck && pnpm run lint && pnpm run test</automated>
  </verify>
  <done>Each non-processing thumb shows the "Manually remove background" button; clicking opens ManualCutoutEditor for that item's original; the button is absent while an ML job is active; typecheck, lint, and the full test suite pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user image → canvas pixel ops | User-supplied image bytes decoded and processed in-browser; no server |
| working res → full-res save | Alpha mask upscaled and applied to full-res original before persisting |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-knz-01 | Denial of Service | flood fill on huge images | mitigate | Edit at ~800px working res (scale cap) so flood stays bounded on phones |
| T-knz-02 | Tampering | cutout blob overwrite | mitigate | Mirror bgRemovalService save tail: write new blob, then update store, then best-effort delete old — no orphan/loss on failure |
| T-knz-03 | Denial of Service | concurrent ML job + manual save race | mitigate | Button hidden while processing; save guards on isBgJobActive(item.id) before writing |
| T-knz-04 | Information Disclosure | canvas getImageData tainting | accept | All pixels come from same-origin object URLs of user's own blobs; no cross-origin taint |
</threat_model>

<verification>
- `just typecheck` (pnpm run typecheck) clean.
- `just lint` (pnpm run lint) clean.
- `just test` (pnpm run test) green, including new pixelOps.test.ts.
- Manual (human, optional): open a thumb's wand editor, confirm corners auto-clear, tap to remove a
  region, adjust tolerance, undo, reset, save → thumb shows the manual cutout at full resolution.
</verification>

<success_criteria>
- Every non-processing library thumb exposes a "Manually remove background" button that opens a
  mobile-first modal canvas editor loaded from the item's original blob.
- Auto corner removal (tol 36) on open, tap-to-remove within tolerance, tolerance slider, undo
  (≤24 snapshots), reset, and cancel all function.
- Save writes a full-resolution PNG cutout (mask upscaled to natural size), updates the item to
  bgStatus 'done', and best-effort deletes the previous cutout; cancel writes nothing.
- Pure pixel logic is unit-tested (flood tolerance + 4-connectivity, feather rule, mask apply).
- Typecheck, lint, and test suite pass.
</success_criteria>

<output>
Create `.planning/quick/260704-knz-manual-background-colour-removal-editor-/260704-knz-SUMMARY.md` when done.
</output>
