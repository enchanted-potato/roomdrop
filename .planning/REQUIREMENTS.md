# Requirements: RoomDrop

**Defined:** 2026-06-25
**Core Value:** You can take a photo of your real room and convincingly preview how a product you're considering buying would look in it — without leaving the browser and without it costing anything to run.

## v1 Requirements

### Foundations

- [x] **FND-01**: Project ships as a static Vite + React + TypeScript SPA deployable to DanubeData free tier
- [x] **FND-02**: Repo includes an `AGPL-3.0` LICENSE file and a visible "Open source" footer link to satisfy `@imgly/background-removal` AGPL obligations
- [x] **FND-03**: App is mobile-first responsive, renders correctly on iPhone SE through desktop, with `viewport-fit=cover` and `100svh` editor height
- [x] **FND-04**: All image input passes through a single `ImagePipeline` that EXIF-orients, rejects unsupported formats (with friendly HEIC error), and resizes the long edge to ≤2048 px before storage
- [x] **FND-05**: First-run honesty notice explains "RoomDrop stores your photos on this device, nothing is sent to a server" (not a cookie banner)

### Upload

- [x] **UPL-01**: User can upload a room photo from camera or photo library on mobile and from file picker on desktop
- [x] **UPL-02**: User can upload one or more product images into a personal library (cushions, furniture, wall art — same upload flow for all)
- [x] **UPL-03**: User can replace the active room photo without losing the product library
- [x] **UPL-04**: User can delete a product from the library
- [x] **UPL-05**: Library shows a thumbnail and a BG-removal status badge for each item

### Background Removal

- [x] **BGR-01**: Background is automatically removed from every uploaded product image fully in the browser, no server call
- [x] **BGR-02**: User can choose Fast (smaller model, faster, lower edge quality) or Quality (larger model, slower, cleaner edges) in settings, with defaults chosen by WebGPU capability probe
- [x] **BGR-03**: BG removal shows visible progress (determinate where possible; honest size + time hint on first-run model download)
- [x] **BGR-04**: BG removal can be cancelled mid-job without leaking workers or corrupting state
- [x] **BGR-05**: On BG-removal failure, the original product image is still usable; user is told the reason
- [x] **BGR-06**: User can re-run BG removal on a library item (e.g. after switching Fast → Quality)
- [x] **BGR-07**: The ONNX model is fetched from imgly's CDN (not self-hosted) and PWA-cached so the second visit is free

### Editor

- [x] **EDT-01**: Stage renders the active room photo as a background bitmap
- [x] **EDT-02**: User can drag a product item from the library onto the room and place it freely (cushions, furniture, wall art — same interaction)
- [x] **EDT-03**: User can move, scale, and rotate any placed item with touch (pinch + drag) and with mouse (corner handles)
- [x] **EDT-04**: User can tap an item to select it (Transformer chrome appears); tap empty stage deselects
- [x] **EDT-05**: Touch targets and Transformer handles are sized for fingers (≥24 px on touch)
- [x] **EDT-06**: `touch-action: none` on stage prevents page scroll / browser pinch-zoom from fighting drag/pinch
- [x] **EDT-07**: User can bring a placed item forward or send it backward via selection toolbar
- [x] **EDT-08**: User can delete a placed item via selection toolbar (with one-level undo for accidents)
- [x] **EDT-09**: User can duplicate a placed item
- [x] **EDT-10**: User can flip a placed item horizontally
- [x] **EDT-11**: Items render with `cutoutId ?? originalId` so the editor works before BG removal completes

### Persistence

- [x] **PER-01**: Active room, product library, and all placements auto-persist on every meaningful change (no Save button)
- [x] **PER-02**: State and library survive page reload and re-rehydrate at first paint
- [x] **PER-03**: All image blobs are stored in IndexedDB (via `idb-keyval`); only metadata + blob ids in the Zustand `persist` payload
- [x] **PER-04**: Data model carries a multi-room schema (`rooms[]`, `library_items[]`, `placements[]` keyed by room) even though the v1 UI only exposes one room
- [x] **PER-05**: Three distinct destructive actions exist with confirmation: Clear placements, Change room photo, Reset everything
- [x] **PER-06**: A second-tab race surfaces a "RoomDrop is open in another tab" banner (BroadcastChannel) rather than silently corrupting state

### Export

- [x] **EXP-01**: User can export the designed room as a PNG at the room photo's native resolution
- [x] **EXP-02**: On mobile, export uses the Web Share API (`navigator.share({ files: [...] })`) so the user can save to Photos or share to messengers
- [x] **EXP-03**: On desktop, export downloads as `roomdrop-YYYYMMDD-<shortId>.png`

### Onboarding

- [x] **ONB-01**: First load shows a clear "Upload a room photo" empty state CTA; no tour, no carousel, no signup
- [x] **ONB-02**: A "Try with a sample room" entry uses a bundled demo room + 4 pre-cutout product images so visitors can experience the product without uploading
- [x] **ONB-03**: After the user places their first item, a one-time tooltip explains pinch-to-scale and pinch-to-rotate

## v2 Requirements

### Editor +

- **EDT2-01**: User can switch between multiple rooms in a drawer (multi-room UI; schema already in v1)
- **EDT2-02**: User has multi-step undo / redo (bounded snapshot stack, cap ~30-50)
- **EDT2-03**: User can long-press an item to open a contextual action menu
- **EDT2-04**: User can toggle a cosmetic drop-shadow per item (gated on visual prototype)
- **EDT2-05**: User can adjust per-item opacity
- **EDT2-06**: User can pinch-zoom the whole stage with a Reset zoom button
- **EDT2-07**: User can "drop a duplicate" of a library item by tapping the item then tapping the room

### BG Removal +

- **BGR2-01**: User can manually refine cutout edges with a small brush tool

### Persistence +

- **PER2-01**: User can export and re-import their library + active room as a ZIP, as a robust backup against iOS Safari 7-day storage eviction

### Distribution

- **DST-01**: App is installable as a PWA with offline support (model cached) and a Home Screen icon

## Out of Scope

Explicit anti-features. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Accounts, login, cloud sync | Backend + auth + recurring bill; conflicts with $0 budget and "everything in your browser" pitch |
| Curated / affiliate product catalog | Backend, licensing, scraping; user uploads BYO is the differentiator |
| Shareable URLs / public room links | Backend storage; bandwidth-hostile (room photos are big); deferred indefinitely |
| Real-time collaboration | Backend + presence; out of scope for portfolio |
| Realistic cast shadows / relighting | Needs depth estimation + second large model; even AR apps fake it poorly |
| Surface-aware placement (snap to floor/wall) | Needs ARKit/ARCore-class scene understanding; client-only can't credibly do it |
| Perspective warping of items into the scene | Needs single-image camera-pose inference; research-grade ML |
| Live AR / camera viewport / walk-around | WebXR patchy; no iOS Safari support; wrong primitive |
| AI room generator ("redesign my room") | Hosted image-gen model or paid API; conflicts with $0 and BYO |
| Server-side BG removal | Conflicts with $0 and "photo never leaves your phone" |
| Real-time color / texture swap on placed items | Needs per-region masks + re-segmentation; deferred |
| Measurement / dimension hints | Needs reference object or camera intrinsics |
| Photoshop-grade mask painting | Scope explosion; Edge-Refine v2 brush is the only manual mask tool considered |
| Long onboarding tours / tutorial carousels | Documented anti-pattern for photo editors |
| Paid / premium tier with feature gates | Conflicts with portfolio framing; future affiliate monetization is the path |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 5 | Complete |
| UPL-01 | Phase 1 | Complete |
| UPL-02 | Phase 2 | Complete |
| UPL-03 | Phase 1 | Complete |
| UPL-04 | Phase 2 | Complete |
| UPL-05 | Phase 2 | Complete |
| BGR-01 | Phase 4 | Complete |
| BGR-02 | Phase 4 | Complete |
| BGR-03 | Phase 4 | Complete |
| BGR-04 | Phase 4 | Complete |
| BGR-05 | Phase 4 | Complete |
| BGR-06 | Phase 4 | Complete |
| BGR-07 | Phase 6 | Implemented (live-deploy validation pending) |
| EDT-01 | Phase 2 | Complete |
| EDT-02 | Phase 2 | Complete |
| EDT-03 | Phase 2 | Complete |
| EDT-04 | Phase 2 | Complete |
| EDT-05 | Phase 2 | Complete |
| EDT-06 | Phase 2 | Complete |
| EDT-07 | Phase 2 | Complete |
| EDT-08 | Phase 2 | Complete |
| EDT-09 | Phase 2 | Complete |
| EDT-10 | Phase 2 | Complete |
| EDT-11 | Phase 2 | Complete |
| PER-01 | Phase 2 | Complete |
| PER-02 | Phase 1 | Complete |
| PER-03 | Phase 1 | Complete |
| PER-04 | Phase 1 | Complete |
| PER-05 | Phase 3 | Complete |
| PER-06 | Phase 5 | Complete |
| EXP-01 | Phase 3 | Complete |
| EXP-02 | Phase 3 | Complete |
| EXP-03 | Phase 3 | Complete |
| ONB-01 | Phase 5 | Complete |
| ONB-02 | Phase 5 | Complete |
| ONB-03 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-25*
*Last updated: 2026-06-25 after roadmap creation*
