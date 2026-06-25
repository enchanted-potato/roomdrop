# Requirements: RoomDrop

**Defined:** 2026-06-25
**Core Value:** You can take a photo of your real room and convincingly preview how a product you're considering buying would look in it — without leaving the browser and without it costing anything to run.

## v1 Requirements

### Foundations

- [ ] **FND-01**: Project ships as a static Vite + React + TypeScript SPA deployable to DanubeData free tier
- [ ] **FND-02**: Repo includes an `AGPL-3.0` LICENSE file and a visible "Open source" footer link to satisfy `@imgly/background-removal` AGPL obligations
- [ ] **FND-03**: App is mobile-first responsive, renders correctly on iPhone SE through desktop, with `viewport-fit=cover` and `100svh` editor height
- [ ] **FND-04**: All image input passes through a single `ImagePipeline` that EXIF-orients, rejects unsupported formats (with friendly HEIC error), and resizes the long edge to ≤2048 px before storage
- [ ] **FND-05**: First-run honesty notice explains "RoomDrop stores your photos on this device, nothing is sent to a server" (not a cookie banner)

### Upload

- [ ] **UPL-01**: User can upload a room photo from camera or photo library on mobile and from file picker on desktop
- [ ] **UPL-02**: User can upload one or more product images into a personal library (cushions, furniture, wall art — same upload flow for all)
- [ ] **UPL-03**: User can replace the active room photo without losing the product library
- [ ] **UPL-04**: User can delete a product from the library
- [ ] **UPL-05**: Library shows a thumbnail and a BG-removal status badge for each item

### Background Removal

- [ ] **BGR-01**: Background is automatically removed from every uploaded product image fully in the browser, no server call
- [ ] **BGR-02**: User can choose Fast (smaller model, faster, lower edge quality) or Quality (larger model, slower, cleaner edges) in settings, with defaults chosen by WebGPU capability probe
- [ ] **BGR-03**: BG removal shows visible progress (determinate where possible; honest size + time hint on first-run model download)
- [ ] **BGR-04**: BG removal can be cancelled mid-job without leaking workers or corrupting state
- [ ] **BGR-05**: On BG-removal failure, the original product image is still usable; user is told the reason
- [ ] **BGR-06**: User can re-run BG removal on a library item (e.g. after switching Fast → Quality)
- [ ] **BGR-07**: The ONNX model is fetched from imgly's CDN (not self-hosted) and PWA-cached so the second visit is free

### Editor

- [ ] **EDT-01**: Stage renders the active room photo as a background bitmap
- [ ] **EDT-02**: User can drag a product item from the library onto the room and place it freely (cushions, furniture, wall art — same interaction)
- [ ] **EDT-03**: User can move, scale, and rotate any placed item with touch (pinch + drag) and with mouse (corner handles)
- [ ] **EDT-04**: User can tap an item to select it (Transformer chrome appears); tap empty stage deselects
- [ ] **EDT-05**: Touch targets and Transformer handles are sized for fingers (≥24 px on touch)
- [ ] **EDT-06**: `touch-action: none` on stage prevents page scroll / browser pinch-zoom from fighting drag/pinch
- [ ] **EDT-07**: User can bring a placed item forward or send it backward via selection toolbar
- [ ] **EDT-08**: User can delete a placed item via selection toolbar (with one-level undo for accidents)
- [ ] **EDT-09**: User can duplicate a placed item
- [ ] **EDT-10**: User can flip a placed item horizontally
- [ ] **EDT-11**: Items render with `cutoutId ?? originalId` so the editor works before BG removal completes

### Persistence

- [ ] **PER-01**: Active room, product library, and all placements auto-persist on every meaningful change (no Save button)
- [ ] **PER-02**: State and library survive page reload and re-rehydrate at first paint
- [ ] **PER-03**: All image blobs are stored in IndexedDB (via `idb-keyval`); only metadata + blob ids in the Zustand `persist` payload
- [ ] **PER-04**: Data model carries a multi-room schema (`rooms[]`, `library_items[]`, `placements[]` keyed by room) even though the v1 UI only exposes one room
- [ ] **PER-05**: Three distinct destructive actions exist with confirmation: Clear placements, Change room photo, Reset everything
- [ ] **PER-06**: A second-tab race surfaces a "RoomDrop is open in another tab" banner (BroadcastChannel) rather than silently corrupting state

### Export

- [ ] **EXP-01**: User can export the designed room as a PNG at the room photo's native resolution
- [ ] **EXP-02**: On mobile, export uses the Web Share API (`navigator.share({ files: [...] })`) so the user can save to Photos or share to messengers
- [ ] **EXP-03**: On desktop, export downloads as `roomdrop-YYYYMMDD-<shortId>.png`

### Onboarding

- [ ] **ONB-01**: First load shows a clear "Upload a room photo" empty state CTA; no tour, no carousel, no signup
- [ ] **ONB-02**: A "Try with a sample room" entry uses a bundled demo room + 4 pre-cutout product images so visitors can experience the product without uploading
- [ ] **ONB-03**: After the user places their first item, a one-time tooltip explains pinch-to-scale and pinch-to-rotate

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
| FND-01 | TBD | Pending |
| FND-02 | TBD | Pending |
| FND-03 | TBD | Pending |
| FND-04 | TBD | Pending |
| FND-05 | TBD | Pending |
| UPL-01 | TBD | Pending |
| UPL-02 | TBD | Pending |
| UPL-03 | TBD | Pending |
| UPL-04 | TBD | Pending |
| UPL-05 | TBD | Pending |
| BGR-01 | TBD | Pending |
| BGR-02 | TBD | Pending |
| BGR-03 | TBD | Pending |
| BGR-04 | TBD | Pending |
| BGR-05 | TBD | Pending |
| BGR-06 | TBD | Pending |
| BGR-07 | TBD | Pending |
| EDT-01 | TBD | Pending |
| EDT-02 | TBD | Pending |
| EDT-03 | TBD | Pending |
| EDT-04 | TBD | Pending |
| EDT-05 | TBD | Pending |
| EDT-06 | TBD | Pending |
| EDT-07 | TBD | Pending |
| EDT-08 | TBD | Pending |
| EDT-09 | TBD | Pending |
| EDT-10 | TBD | Pending |
| EDT-11 | TBD | Pending |
| PER-01 | TBD | Pending |
| PER-02 | TBD | Pending |
| PER-03 | TBD | Pending |
| PER-04 | TBD | Pending |
| PER-05 | TBD | Pending |
| PER-06 | TBD | Pending |
| EXP-01 | TBD | Pending |
| EXP-02 | TBD | Pending |
| EXP-03 | TBD | Pending |
| ONB-01 | TBD | Pending |
| ONB-02 | TBD | Pending |
| ONB-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 0 (populated by roadmap)
- Unmapped: 40 ⚠️ (until roadmap created)

---
*Requirements defined: 2026-06-25*
*Last updated: 2026-06-25 after initial definition*
