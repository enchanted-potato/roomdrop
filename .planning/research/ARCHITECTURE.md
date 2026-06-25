# Architecture Patterns

**Domain:** Mobile-first, client-only in-room product visualization SPA
**Researched:** 2026-06-24
**Confidence:** HIGH (component boundaries, data flow, persistence shape) / MEDIUM (exact worker integration ergonomics — `@imgly/background-removal` manages its own worker; thin wrapper is what we own)

## Recommended Architecture

RoomDrop is a thick-client SPA whose architecture is dominated by **four boundaries**: (1) the **interactive stage** that renders and manipulates pixels, (2) the **BG-removal pipeline** that runs as a Web Worker job queue, (3) the **persistence layer** that owns Blob lifecycles in IndexedDB, and (4) the **Zustand store** that holds metadata + transient UI state and glues everything together via blob-id references — never raw Blobs in store.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          React UI Tree (SPA)                          │
│                                                                       │
│   ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌────────┐ │
│   │ Upload / │ │ Library  │ │ Stage       │ │ Toolbar  │ │ Settings│ │
│   │ Camera   │ │ Drawer   │ │ (react-     │ │ (layer,  │ │ (fast/  │ │
│   │ Sheet    │ │          │ │  konva)     │ │  export) │ │ quality)│ │
│   └────┬─────┘ └─────┬────┘ └──────┬──────┘ └────┬─────┘ └────┬───┘ │
│        ▼             ▼             ▼              ▼             ▼    │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │              Zustand Store (slices, no Blobs)                 │  │
│   │  rooms · library · placements · bgJobs · settings · ui        │  │
│   └─────┬───────────────────────────────────┬────────────────────┘  │
│         ▼                                   ▼                        │
│   ┌──────────────┐                  ┌────────────────────┐           │
│   │ Persistence  │                  │ BG-Removal Service │           │
│   │  Service     │ ◄── blob ids ──► │   (worker proxy +  │           │
│   │ (IDB blobs)  │                  │    job queue)      │           │
│   └──────┬───────┘                  └─────────┬──────────┘           │
└──────────┼────────────────────────────────────┼───────────────────────┘
           ▼                                    ▼
   ┌──────────────┐                  ┌──────────────────────┐
   │  IndexedDB   │                  │   @imgly Web Worker  │
   │ (idb-keyval) │                  │  (ONNX Runtime Web)  │
   └──────────────┘                  └──────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Depends On | Does NOT touch |
|-----------|----------------|------------|----------------|
| `UploadSheet` | File picker / camera capture; emits a `File`/`Blob` + intent (`room` vs `library`) | `PersistenceService`, `ImagePipeline` | Konva, Zustand placements |
| `ImagePipeline` (pure module) | Pre-resize (browser-image-compression), validate, EXIF-orient, return normalized `Blob` + dimensions | — | Zustand, IDB, workers |
| `LibraryDrawer` | List of product library items with thumbnails + BG-removal status badges | `library` slice, `bgJobs` slice, `PersistenceService.getThumb` | Konva |
| `Stage` (react-konva) | Renders room layer + placements layer + UI/handles layer; hosts `Transformer` | `rooms` + `placements` slices, `useImage` for blob URLs | IDB directly, workers |
| `PlacementNode` | One `<KonvaImage>` + selection/transform behavior | `placements` slice, `library` slice | — |
| `Toolbar` | Layer ordering, delete, reset, export trigger | `placements` slice, `ExportService` | — |
| `SettingsPanel` | Fast vs Quality toggle, model status, storage usage | `settings` slice, `BgRemovalService.capabilities()` | — |
| `BgRemovalService` | Worker proxy: queue, progress events, cancellation, model-cache state | `bgJobs` slice (writes), `PersistenceService` (reads input Blob, writes output Blob) | Konva, UI |
| `PersistenceService` | Sole owner of IDB Blob lifecycle (`put`, `get`, `getURL`, `release`, `gc`) | `idb-keyval` | UI |
| `ExportService` | Composites room + placements via Konva `stage.toBlob({ pixelRatio })` and saves PNG | `Stage` ref, `rooms` slice | IDB writes |
| `BootService` | Rehydrate Zustand from localStorage, hydrate active room/library Blobs from IDB to object URLs, run GC, probe WebGPU | All slices, `PersistenceService`, `BgRemovalService.capabilities` | — |

**Hard rules:**

- **No Blobs in the Zustand store.** The store holds blob *ids* (UUIDs); `PersistenceService` returns object URLs on demand and tracks them for revocation.
- **No IDB calls from React components.** Components call `PersistenceService` (or read URLs from a memoized hook).
- **No Konva imports outside `Stage` and its children.** `ExportService` accepts a `Konva.Stage` ref — it does not import `react-konva`.
- **`BgRemovalService` is the only consumer of `@imgly/background-removal`.** Swappability (to `@huggingface/transformers` later) lives behind this seam.

### Data Flow: Image Lifecycle

```
1. UPLOAD
   User picks file → UploadSheet receives File
   → ImagePipeline: EXIF-orient + resize to ≤2048px long edge → normalized Blob + {w,h}
   → PersistenceService.put({ kind: 'original', blob }) → returns originalId
   → If kind=room:
        rooms slice.upsert({ id, originalId, w, h }); set as active
   → If kind=libraryItem:
        library slice.upsert({ id, originalId, w, h, status: 'pending' })
        BgRemovalService.enqueue({ itemId, originalId, mode: settings.quality })

2. BG REMOVAL (library items only; room photo is never bg-removed)
   BgRemovalService dequeues job
   → PersistenceService.get(originalId) → Blob
   → Post message to @imgly worker: { blob, model: 'isnet_quint8' | 'isnet_fp16' }
   → Receive progress events → bgJobs slice.setProgress(itemId, pct)
   → On result Blob (PNG with alpha):
        PersistenceService.put({ kind: 'cutout', blob }) → cutoutId
        PersistenceService.put({ kind: 'thumb', blob: downscaled }) → thumbId
        library slice.update(itemId, { cutoutId, thumbId, status: 'ready' })
        bgJobs slice.complete(itemId)

3. RENDER ON STAGE
   Stage reads placements slice → for each placement { libraryItemId, x, y, scale, rot, z }:
   → PersistenceService.getURL(libraryItem.cutoutId ?? libraryItem.originalId) → cached URL
   → useImage(url) → HTMLImageElement → <KonvaImage>
   → Room: PersistenceService.getURL(room.originalId) → background layer <KonvaImage>

4. EXPORT
   ExportService(stageRef, { pixelRatio: room.w / stage.width() })
   → stage.toBlob({ mimeType: 'image/png' })  // composites at native room resolution
   → file-saver triggers <a download>
   → Blob is NOT persisted (user owns the file)

5. CLEANUP
   On placement remove / library delete / room replace:
   → PersistenceService.release(blobId) — decrement refcount, revoke URL if 0,
     mark IDB entry deletable
   → BootService.gc() at boot deletes IDB blobs not referenced by any slice
```

**Key invariants:**

- An image enters the system exactly once via `ImagePipeline` (single normalization point).
- Object URLs are created/revoked by `PersistenceService` only — never by components.
- The room photo is treated as a **background bitmap**, not a placement. No transform handles, no BG removal, no layer ordering.
- BG-removal output is stored as a *separate* blob (`cutoutId`) — the original is retained so the user can re-run BG removal at higher quality without re-uploading.

## State Slices in Zustand

The store is split into 6 named slices, combined via Zustand's slice pattern. Only persisted slices go through `persist` middleware; transient slices (`bgJobs`, `ui`) are **excluded via `partialize`**.

```ts
// store/index.ts (sketch)
useStore = create<AppState>()(persist((set, get) => ({
  ...createRoomsSlice(set, get),
  ...createLibrarySlice(set, get),
  ...createPlacementsSlice(set, get),
  ...createSettingsSlice(set, get),
  ...createBgJobsSlice(set, get),   // partialized out
  ...createUiSlice(set, get),       // partialized out
}), {
  name: 'roomdrop:v1',
  partialize: (s) => ({
    rooms: s.rooms, library: s.library, placements: s.placements, settings: s.settings,
  }),
  version: 1,
  migrate: (persisted, fromVersion) => /* schema migrations */,
}));
```

| Slice | Persisted? | Shape (sketch) | Notes |
|-------|------------|----------------|-------|
| `rooms` | localStorage | `{ byId: Record<RoomId, { id, name, originalId, w, h, createdAt }>; activeRoomId }` | Multi-room in schema even if v1 UI exposes one. |
| `library` | localStorage | `{ byId: Record<ItemId, { id, name, originalId, cutoutId?, thumbId?, w, h, status: 'pending'\|'processing'\|'ready'\|'failed', errorReason? }> }` | If `cutoutId` missing, display falls back to `originalId`. |
| `placements` | localStorage | `{ byRoomId: Record<RoomId, Placement[]> }` where `Placement = { id, libraryItemId, x, y, scaleX, scaleY, rotation, z }` | `z` explicit so reordering is deterministic. |
| `settings` | localStorage | `{ bgQuality: 'fast'\|'quality'; autoDownscaleMaxPx: 2048; pwaPromptDismissed: boolean }` | Defaults set at boot via capability probe. |
| `bgJobs` | **NOT persisted** | `{ byItemId: Record<ItemId, { status, progress: 0..1, startedAt }>; queue: ItemId[] }` | Re-derived at boot by scanning `library` for `status==='pending'`. |
| `ui` | **NOT persisted** | `{ selectedPlacementId, libraryDrawerOpen, exportDialogOpen, toast?, capabilities: { webgpu, deviceMemoryGb? } }` | All ephemeral. |

### localStorage vs IndexedDB

| Data | Where | Why |
|------|-------|-----|
| Slice metadata above (~KB) | localStorage (Zustand `persist`) | Synchronous rehydrate on first paint; tiny. |
| Room photo Blob | IndexedDB (`originals` store) | 1–3 MB; would blow localStorage quota. |
| Library item original Blob | IndexedDB (`originals` store) | Retained for re-running BG removal. |
| Library item cutout (PNG+alpha) | IndexedDB (`cutouts` store) | Often larger than original. |
| Library item thumbnail | IndexedDB (`thumbs` store) | Loaded eagerly into the drawer. |
| ONNX model weights | `@imgly/background-removal` HTTP cache + optional `vite-plugin-pwa` SW cache | Library + SW own it, not us. |
| Object URLs | In-memory ref-counted map in `PersistenceService` | Created on demand, revoked at refcount 0. |
| Selection, drawer open, toasts | Zustand `ui` slice (in-memory) | Should not survive reload. |

## BG-Removal Worker Integration Pattern

`@imgly/background-removal` ships its own Web Worker hosting ONNX Runtime Web. We do **not** spawn our own worker for inference. We own a thin TS service that:

1. Lazy-imports the package (initial bundle stays small).
2. Maintains a serial **job queue** (concurrency 1 — concurrent inference OOMs mid-range phones).
3. Surfaces **progress + cancellation** to the store.
4. Caches the loaded model in memory between jobs.
5. Probes capabilities at boot (`navigator.gpu` → default `quality`; else `fast`).

```ts
// services/bgRemoval.ts (sketch)
type Job = { itemId: string; inputBlob: Blob; mode: 'fast' | 'quality'; signal: AbortSignal };

class BgRemovalService {
  private queue: Job[] = [];
  private active: Job | null = null;
  private modelLoaded: 'fast' | 'quality' | null = null;
  private remove: ((b: Blob, opts: any) => Promise<Blob>) | null = null;

  async capabilities() {
    return { webgpu: 'gpu' in navigator, deviceMemory: (navigator as any).deviceMemory };
  }

  enqueue(job: Job) {
    this.queue.push(job);
    bgJobs.setStatus(job.itemId, 'queued');
    this.tick();
  }

  cancel(itemId: string) {
    const idx = this.queue.findIndex(j => j.itemId === itemId);
    if (idx >= 0) this.queue.splice(idx, 1);
    // in-flight: cooperative — discard result on abort
    bgJobs.setStatus(itemId, 'canceled');
  }

  private async tick() {
    if (this.active || this.queue.length === 0) return;
    const job = (this.active = this.queue.shift()!);
    bgJobs.setStatus(job.itemId, 'processing');

    if (!this.remove || this.modelLoaded !== job.mode) {
      const mod = await import('@imgly/background-removal');
      this.remove = mod.removeBackground;
      this.modelLoaded = job.mode;
    }

    try {
      const out = await this.remove(job.inputBlob, {
        model: job.mode === 'fast' ? 'isnet_quint8' : 'isnet_fp16',
        progress: (_k, c, t) => bgJobs.setProgress(job.itemId, c / t),
      });
      if (!job.signal.aborted) {
        await persistence.putCutout(job.itemId, out);
        library.markReady(job.itemId);
      }
    } catch (e) {
      library.markFailed(job.itemId, String(e));
    } finally {
      this.active = null;
      bgJobs.complete(job.itemId);
      this.tick();
    }
  }
}
```

**Progress** is surfaced via the library's `progress` callback → Zustand `bgJobs.setProgress(id, 0..1)`.

**Cancellation** is cooperative: in-flight ORT inference can't be killed mid-pass without tearing down the worker (expensive), so we discard the result on abort. Queued jobs cancel immediately. UX should say "Cancel = abandon this attempt."

**Why concurrency 1:** WebGPU and WASM-threaded ORT both balloon RAM during inference; mid-range Android OOMs are the predictable failure. Serial queue with a "X in queue" badge is honest and survives.

**Worker lifecycle:** the package's worker stays alive across jobs for the page lifetime — do not terminate between jobs.

## Persistence Schema (IndexedDB)

Three logical `idb-keyval` stores via `createStore`:

| Store | Key | Value | Lifecycle |
|-------|-----|-------|-----------|
| `roomdrop:originals` | `<uuid>` | `Blob` (image/jpeg or image/png, ≤2048px) | Lives while parent room or library item references `originalId`. |
| `roomdrop:cutouts` | `<uuid>` | `Blob` (image/png with alpha) | Lives while a library item references `cutoutId`. Re-runnable. |
| `roomdrop:thumbs` | `<uuid>` | `Blob` (image/webp ~256px) | Same lifecycle as cutout; cheap to regenerate. |

> Model weights are NOT in our IDB. `@imgly/background-removal` uses the HTTP cache; if we add `vite-plugin-pwa`, the SW manages a dedicated cache route for the model URL pattern.

**Why three stores (not one):** different GC criteria (thumbnails evict aggressively; originals must not), simpler storage-usage indicator, allows a "Free space" action to drop thumbnails before touching originals/cutouts.

**Schema versioning:** Zustand `persist` has `version` + `migrate`. The IDB layer adds its own schema-version key (`roomdrop:idb-schema-version`) so blob layout changes migrate independently.

**Garbage collection:** `BootService.gc()` on app start collects referenced ids from `rooms`/`library`, lists keys in each store, deletes orphans. Handles partial-failure cases without transactions.

## Build Order Implications

The architecture is deliberately structured so **BG removal can land in Phase 2 without rewriting Phase 1**. The seam is `library.cutoutId` — when absent, the stage falls back to rendering the original. Phase 1 is shippable and useful on its own.

### Phase 1 — Stage without BG removal (ship this first)

End-to-end usable flow with **no BG removal**. User uploads room + product images (no cutout step) and freely places them. Items appear with rectangular backgrounds — visually inferior but the interaction model is real.

Includes:
- `ImagePipeline`, `PersistenceService` (full IDB schema with `cutouts` store already present, unused)
- Zustand store with all 6 slices; `bgJobs` is a no-op stub
- `UploadSheet`, `LibraryDrawer`, `Stage`, `PlacementNode`, `Toolbar`
- `ExportService` (full)
- `BootService` rehydration + GC
- Settings panel without BG quality toggle (or grayed-out "coming soon")

Crucially: `cutoutId` already exists on library items and the stage already reads `cutoutId ?? originalId`. No shape changes when BG removal arrives.

### Phase 2 — BG removal integration

- `BgRemovalService` (worker proxy, job queue, capability probe)
- `bgJobs` slice wired; library status badges live
- Settings panel: Fast/Quality toggle + storage usage + model status
- Re-run BG removal action on a library item
- Migration: existing Phase-1 library items auto-queue for BG removal at first Phase-2 launch

**Why this split is clean:** the data model already includes `cutoutId?` and `status` from Phase 1. The Stage doesn't change. The Library drawer just gains a status pill.

### Phase 3 — Mobile perf + offline

- `vite-plugin-pwa` with explicit SW cache rule for the ONNX model URL
- OffscreenCanvas-based export for very large rooms (only if measured to jank)
- WebGPU capability hint UI
- Storage management UX (delete library items, "clear cutouts" to free space)

### Build order rationale

1. **`PersistenceService` first** — every other module depends on Blob lifecycle.
2. **Zustand slices second** — establishes the data contract before any UI.
3. **`ImagePipeline` + `UploadSheet`** — get image bytes end-to-end.
4. **`Stage` + `PlacementNode`** — the core interactive value.
5. **`Toolbar` + `ExportService`** — close the loop: user can ship a result.
6. **`BootService`** — make it survive reload; expose dogfooding.
7. (Phase 2) **`BgRemovalService`** — the quality unlock.

## Patterns to Follow

### Pattern 1: Blob-id Indirection
Components and slices reference image bytes by string id only. Bytes are owned by `PersistenceService`, which lazily mints object URLs and revokes them on release.

```ts
const url = usePersistedBlobURL(item.cutoutId ?? item.originalId);
const [image] = useImage(url);
return <KonvaImage image={image} {...placement} />;
```

### Pattern 2: Cutout Fallback
Always render `cutoutId ?? originalId`. BG removal is a quality upgrade, not a gate. Library items mid-processing remain usable.

### Pattern 3: Worker as Service-Owned Singleton
One `BgRemovalService` instance app-wide. Lazy-imports on first job. Spawned workers live for the page lifetime. Model load (~80 MB) reuse is non-negotiable.

### Pattern 4: Two-Tier State (Persisted Metadata + Transient UI)
Zustand `partialize` selects only slices that should survive reload. Job queues, selection, drawer state stay transient. Avoids zombie processing jobs after reload.

### Pattern 5: Stage as Composition Root for Export
Export uses `Konva.Stage.toBlob({ pixelRatio })`, not a hand-rolled OffscreenCanvas. Already correctly composites all layers; `pixelRatio` lets us export at the room's native resolution regardless of viewport size.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blobs in Zustand
Storing `File`/`Blob`/`HTMLImageElement` directly in store state. Devtools blow up; persist serialization corrupts; re-renders churn URLs. **Instead:** store blob ids only.

### Anti-Pattern 2: Per-render Object URLs
`URL.createObjectURL(blob)` inline in a component render leaks one URL per render. **Instead:** `PersistenceService.getURL(id)` returns a cached, ref-counted URL.

### Anti-Pattern 3: Parallel BG-Removal Jobs
Concurrent inference OOMs mid-range Android; UI freezes even with worker because main thread shuffles big Blobs. **Instead:** serial queue with "X in queue" UI.

### Anti-Pattern 4: Persisting `bgJobs`
A stale "75% processing" entry from yesterday is meaningless. **Instead:** re-derive at boot by scanning `library` for `status==='pending'`.

### Anti-Pattern 5: IDB Access from Components
Scattered `useEffect` IDB reads bypass ref-counting, leak URLs, make the persistence layer un-swappable. **Instead:** `usePersistedBlobURL(id)` hook, single owner.

### Anti-Pattern 6: BG-Removing the Room Photo
Catastrophic — segmenting the room background returns garbage. **Instead:** room photos take a path through `ImagePipeline` that explicitly bypasses BG removal.

### Anti-Pattern 7: Custom Web Worker for ORT
Re-implements what `@imgly/background-removal` already does correctly (WASM/WebGPU EP selection). **Instead:** use the library as-shipped; own only the queue/wrapper.

## Scalability Considerations

| Concern | One room, 10 placements | One room, 50 placements | Multi-room future |
|---------|--------------------------|--------------------------|-------------------|
| Konva render | Two layers, fine | Cache placements layer (`layer.cache()`) | Per-room Stage unchanged |
| IDB storage | <20 MB | ~80 MB | Add per-room thumbnail eviction |
| BG-removal queue | Trivial | Visible queue UI required | Library is global; no per-room scoping |
| localStorage payload | <5 KB | ~30 KB | Keep `placements` per-room shape |

## Worker / Threading Summary

| Concern | Thread | Owner |
|---------|--------|-------|
| UI + Konva rendering | Main | React/Konva |
| Image decode + EXIF + resize | Main (browser-image-compression) | `ImagePipeline` |
| BG-removal inference | Web Worker (ORT Web) | `@imgly/background-removal` |
| IDB read/write | Async on main (idb-keyval) | `PersistenceService` |
| PNG export composite | Main | `Konva.Stage.toBlob` |
| (Future) PNG export | Web Worker w/ OffscreenCanvas | `ExportService` v2 |

## Sources

- `.planning/research/STACK.md` — verified library and version choices feeding this architecture
- `.planning/codebase/ARCHITECTURE.md` — prototype reference (interaction model, not code)
- [Konva — Transformer + multi-layer architecture](https://konvajs.org/docs/react/Transformer.html)
- [Konva — Stage.toBlob / toCanvas](https://konvajs.org/api/Konva.Stage.html)
- [IMG.LY — @imgly/background-removal worker + progress API](https://img.ly/blog/browser-background-removal-using-onnx-runtime-webgpu/)
- [GitHub — imgly/background-removal-js](https://github.com/imgly/background-removal-js)
- [jakearchibald/idb-keyval — createStore for multiple stores](https://github.com/jakearchibald/idb-keyval)
- [Zustand persist middleware — partialize + migrate](https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md)
- [MDN — URL.createObjectURL lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
