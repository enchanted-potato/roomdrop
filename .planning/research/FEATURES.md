# Feature Research

**Domain:** Mobile-first, client-only in-room product visualization (composite-on-photo, not AR)
**Researched:** 2026-06-24
**Confidence:** HIGH for table-stakes / anti-features; MEDIUM for differentiators (some are stack-validated but unmeasured on real devices)

## Context: How RoomDrop Differs From The Reference Apps

The competitive set (IKEA Place, Houzz View in My Room, Modsy, DecorMatters, Shopify AR viewer, Pinterest Try-On) splits cleanly into two camps:

1. **Live-AR apps** (IKEA Place, Houzz View in My Room 3D, Shopify AR Quick Look) — point the phone camera at a real room, drop a *3D model from a vendor catalog* into the live scene, walk around it. Requires ARKit/ARCore, 3D assets, and a curated catalog.
2. **Composite-on-photo apps** (DecorMatters, Modsy mood boards, Pinterest Try-On) — take/upload a 2D photo, drop 2D product cutouts on top, save/share. No camera tracking, no 3D, no walk-around.

**RoomDrop is camp 2, with two further constraints that disqualify nearly every reference:** (a) bring-your-own product images (no catalog), (b) no backend (no server-side compositing, no auth, no cloud library). The realistic comparison is "what a designer would do with Procreate or Photoshop layers, but tuned for a phone and free." This re-orders the feature priorities significantly: what's table stakes in IKEA Place (AR tracking, 3D rotation, vendor catalog) is irrelevant here; what's a luxury in Photoshop (touch-friendly transform handles) is table stakes here.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = users dismiss the app as a toy or a prototype.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Room photo upload from camera or library** | The whole product moment is "I'm standing in my room, I want to see X here." A user on mobile expects `capture=environment` to open the camera directly. | S | Plain `<input type="file" accept="image/*" capture="environment">` covers it. react-dropzone optional for desktop drag-on. Already a PROJECT.md requirement. |
| **Product image upload to a personal library** | Without a library, every preview is one-shot — defeats "try several cushions on this sofa." Reference apps (DecorMatters, Pinterest) all maintain a saved-items rail. | S | Multi-file `<input>` + thumbnails in a sidebar/drawer. |
| **Automatic background removal on upload** | If users have to pre-edit their product photos in another app, RoomDrop is just a layering tool, not a visualization tool. This is the single biggest perceptual lever. | L | Stack already commits to `@imgly/background-removal` with fast/quality toggle. |
| **Drag to position** (touch + mouse) | The core interaction. Anything less than smooth, latency-free drag feels broken on mobile. | M | Konva's pointer events; verify on real mid-range Android. |
| **Pinch-to-scale on selected item** | Two-finger pinch is the universally-expected resize gesture on phones since 2008. Single-finger corner-handle resize is fine on desktop but cramped on phones. | M | Konva `Transformer` + multi-touch. Conflicts with stage zoom — see Pitfall: "gesture overloading." |
| **Rotate** (handle or two-finger twist) | Cushions and art are placed at angles. Without rotation, everything looks pasted in axis-aligned. | M | Konva `Transformer` exposes a rotation handle for free. Two-finger twist is harder — Konva supports it but needs careful event handling. |
| **Tap to select / tap empty to deselect** | Standard direct-manipulation idiom. Without a clear selection model, users can't tell what their next gesture will affect. | S | Konva handles via `onClick`/`onTap` events on items + stage. |
| **Delete selected item** | Trivially expected. A delete button on the selected item's bounding box or a trash icon in the toolbar. | S | Single store mutation. |
| **Layer ordering: bring forward / send back** | "I want this cushion in front of the throw blanket" — without z-order control, the user is at the mercy of placement sequence. PROJECT.md already lists this. | S | Two buttons on the selection toolbar; mutate `placements[].zIndex`. |
| **Persistence across reloads** | A phone user will lock their screen or get a call mid-session. Losing the room + library + placements is a trust killer. PROJECT.md requirement. | M | Zustand `persist` for the small state; IndexedDB (idb-keyval) for image blobs per STACK.md. |
| **Export as PNG** | Without export, the user can't show a friend or save it for later reference. PROJECT.md requirement. | S | `stage.toBlob('image/png')` + `<a download>`. |
| **Clear placements / start over** | A reset escape hatch. Without one, the only way out of a messed-up layout is undo-spam or refresh-and-lose-everything. | S | Already in PROJECT.md. Confirm semantics — see "Reset/clear semantics" below. |
| **Visual selection affordance** (bounding box + handles) | Without a visible selection state, users can't tell what's selected, what's draggable, or where to scale-rotate from. | S | Konva `Transformer` ships this. |
| **Responsive layout that fits a phone in portrait** | If the library drawer or toolbar steals room from the stage, the actual editing surface is unusably small. | M | The PoC's right-hand sidebar layout works on desktop but needs a bottom-sheet / collapsible drawer on phones. |
| **Loading + progress feedback during BG removal** | Removal takes 3-15 seconds. Without a spinner + progress indicator, users assume the app froze and reload. | S | Hook into `@imgly/background-removal` progress callback. |

### Differentiators (Competitive Advantage / Portfolio Polish)

Features that make RoomDrop notable as a portfolio piece beyond "it works."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Fast vs Quality BG removal toggle, exposed in UI** | Most apps hide the model or charge a subscription. Making the tradeoff visible and user-controllable is a credibility signal and a real UX win on weaker devices. | S (UI) — model wiring already in stack | Already a PROJECT.md requirement. Surface the choice with honest framing ("Fast: ~5s. Quality: ~10s, sharper edges.") |
| **Undo / Redo** (placements, transforms, deletes) | Direct-manipulation interfaces feel dramatically more forgiving with undo. Reference apps mostly skip this because their interaction model is shallow; for a free-transform editor it's the single biggest UX upgrade. | M | Implement as a transform-history stack in Zustand. Cap at ~50 steps. Do NOT undo library uploads (separate concern — see "session vs library scope" pitfall). |
| **Multiple rooms / project switcher** | One photo per session is a UX trap — users want "my living room" and "my bedroom" simultaneously. Mirrors how DecorMatters and Modsy structure projects. | M | A "Rooms" list with thumbnails. Each room owns its photo + placements. Library is global across rooms. Needs careful schema design in Zustand store from day one — retrofitting is painful. |
| **In-place re-edit of an existing placement's BG removal** | When the fast model leaves a halo on a cushion, let the user re-run with Quality on just that item without re-uploading. None of the reference apps do this because they don't expose the model. | M | Store the original bytes in IDB; re-run `@imgly/background-removal` on demand. Stack supports this. |
| **Free transform that respects aspect ratio (with shift/two-finger constraint)** | Aspect-locked resize by default, free-stretch on modifier. Matches Figma / Procreate muscle memory. Reference apps mostly aspect-lock with no escape hatch. | S | Konva `Transformer` `keepRatio` prop. |
| **Duplicate selected item** | If you've sized and rotated a cushion just right, you want two of it on the sofa. One-tap duplicate is a power move. | S | Trivial store mutation. |
| **"Mirror / flip horizontally"** | Especially valuable for cushions, framed art, and asymmetric furniture — a single product photo can serve as a left and right variant. | S | Trivial transform mutation. |
| **Tap-and-hold long-press = contextual menu** | Mobile-native idiom for "I want options on this thing" (delete, duplicate, flip, send-to-back). Saves toolbar real estate. | M | Konva long-press detection + a small floating menu. |
| **Pinch-zoom on the whole room** (not the item) when nothing is selected | Lets users zoom in to place a cushion precisely. The competitive set generally lacks this because their AR camera handles it. For a static photo it's a real differentiator. | M | `@use-gesture/react` on the stage container; disambiguate from item-pinch via "is anything selected?" |
| **Export sized to the original room photo's resolution** | "Looks good on my phone but pixelated when I AirDrop to my laptop" is a portfolio-killing detail. Render the export at the source photo's dimensions, not the on-screen stage size. | S | Use `stage.toCanvas({ pixelRatio })` with the right ratio computed from source image dims. |
| **Share-sheet integration via Web Share API** | One-tap "Send to WhatsApp / Messages" instead of save-then-attach. Real mobile polish. | S | `navigator.share({ files: [pngBlob] })` with feature detection + fallback to download. |
| **PWA install + offline support** | First-visit downloads an 80 MB model. Making the app installable + offline-capable on second visit is a 10× perceived-quality jump and is the natural showcase of the architecture. | M | `vite-plugin-pwa` per STACK.md; service-worker the model. |
| **Stage-level grid or rule-of-thirds overlay (toggleable)** | A subtle "designer's eye" touch — helps users place items with composition in mind. Costs ~20 lines of code. | S | Konva overlay layer; persisted toggle in store. |
| **Drop-shadow toggle (cheap fake shadow under selected item)** | Not real shadow realism — just a soft elliptical drop-shadow below the item. Sells the "sitting in the scene" illusion at near-zero cost. Distinct from depth-aware shadow casting (which is an anti-feature). | M | CSS-style drop-shadow via Konva filter / shadow props. Per-item toggle. **MEDIUM confidence this lands well — needs a visual prototype to confirm it doesn't look worse than no shadow.** |
| **Lightweight onboarding (one-screen, no signup)** | Reference apps gate behind signup. A 5-second "Upload room → Upload product → Drop it in" walkthrough on first visit is portfolio-quality polish. | S | A dismissible coachmark or empty-state copy in the stage area. |

### Anti-Features (Deliberately Skip — Note WHY)

Features that look natural for the domain but are wrong for client-only + portfolio scope.

| Feature | Why Tempting | Why Skip | Alternative |
|---------|--------------|----------|-------------|
| **Real shadow / lighting realism** (cast shadows matching room light direction) | Without it items look "pasted in," and that's the perceptual cliff users notice. | Requires (a) light-source estimation from the room photo and (b) per-item depth and contact-point detection. Both are research-grade ML, server-side or large WASM models, and would multiply page weight by 2-4×. Outside $0 budget and free-tier device budget. | Optional cheap drop-shadow (see Differentiators). Acknowledge the "pasted in" limit honestly in onboarding. |
| **Surface-aware placement** (snap to floor, walls, sofas) | "It should just know that's a sofa." | Requires semantic segmentation of the room scene + plane estimation. Another whole ML pipeline on top of BG removal. Explicitly out of scope in PROJECT.md. | Free manual placement; trust the user to eyeball it. Optional grid/thirds overlay as an aid. |
| **Perspective warp / 3D-aware scaling** (item gets smaller as you "push it back") | Reinforces the in-room illusion. | Requires room-depth estimation. Even the cheap version (vanishing-point detection) is a complex 2D vision problem and degrades badly on photos without strong perspective cues. | None. The user controls scale by hand; that's enough for the portfolio scope. |
| **Live AR with camera tracking** (IKEA Place model) | The dominant pattern in the visual reference set. | Requires WebXR (immature on iOS as of 2026) or native ARKit/ARCore, plus 3D models, plus a catalog. Violates "client-only static site," "no catalog," and "mobile web app, not native." | Photo-based compositing is RoomDrop's stated approach and is competitive for the "share this with my partner" use case. |
| **Curated product catalog / browse-by-style** | Every reference app has one; users may expect it. | Requires a backend or a giant static asset bundle, plus licensing for product imagery, plus affiliate plumbing. Explicitly out of scope in PROJECT.md. | "Bring your own image" is the explicit pitch. Onboarding should make this clear — frame it as a feature, not a gap. |
| **Account creation / login** | Persistence across devices. | Backend, auth, ToS, password reset, GDPR. Violates "no backend, $0 budget." | localStorage + IndexedDB. Add a clear warning in onboarding that data lives on this device only. |
| **Cloud sync / multi-device** | Same as accounts. | Same as accounts; plus storage cost. | Same as accounts. Optionally: an "export library as ZIP" / "import library from ZIP" escape hatch for power users — see Future. |
| **Shareable preview URLs** ("send a link to your friend") | Native mobile UX expectation; lower friction than sending a PNG. | Requires server-side storage to host the composited image. Violates no-backend. | Web Share API + PNG export (see Differentiators). |
| **Real-time collaboration** ("style this room with my partner") | Common ask for design tooling. | CRDTs, WebSockets, presence — entire feature class on top of a backend. | Async: export PNG and send. |
| **AI-generated suggestions** ("here's a cushion that goes with this sofa") | Trend-chasing; would make the portfolio piece feel current. | LLM/vision API calls = recurring cost + backend. Without a catalog, suggestions are also ungrounded. | Out. If revisited later: link to Pinterest search with the room photo as the seed. |
| **Visual search / "find me this product"** (IKEA Place feature) | Bridges visualization to purchase. | Requires a vector search backend over a product catalog. Both are missing. | Out. |
| **3D product models / walk-around** | Distinguishes "real" room visualization apps. | Requires 3D assets, WebGL pipeline, model authoring workflow. Wrong product. | 2D image compositing is the explicit product. |
| **Server-side BG removal fallback** ("if WASM is too slow, run it on a server") | Tempting on weaker devices. | Violates $0 hosting and no-backend constraints. Stack already addresses with fast/quality toggle. | Honest in-app messaging when the device is weak ("Fast mode recommended"). |
| **Unlimited undo history** | Easy ask. | Memory cost on a phone with a 4 MP room photo and 20 placed items per step adds up. | Cap at 50 steps. Drop oldest. |
| **"Erase your existing furniture" inpainting** (recent IKEA Place feature) | Would massively improve realism. | Requires inpainting model (Stable Diffusion family) running in-browser — currently 1-4 GB and prohibitive on mobile. | Out. Document as a future possibility if WebGPU model sizes shrink. |
| **Walking-tour video export** | Visually impressive. | No 3D scene to walk through; would have to fake parallax. Out of scope. | Static PNG only. |
| **In-app commerce / "buy this"** | Standard for retail visualization apps. | No catalog, no commerce. Explicitly out of scope. | Out. |

## Cross-Cutting UX Decisions (the question explicitly asked about these)

### Photo capture flow

- **Mobile:** single `<input type="file" accept="image/*" capture="environment">` button. The OS picker presents camera + library + (on iOS 18+) recent screenshots. Don't reinvent it.
- **Desktop:** the same `<input>` plus a drag-and-drop target overlay via react-dropzone.
- **No in-app camera preview.** Building a getUserMedia preview means handling permissions, orientation, exposure, and HEIC fallback — far more code for marginal UX gain. The OS picker is the right primitive.
- **EXIF orientation:** **must** be honored on import; iPhone shots come in rotated. `browser-image-compression` handles this. (See Pitfall: "EXIF rotation" — flag for PITFALLS.md.)
- **Downscale on import to ≤2048 px on the long edge** before display or BG removal — STACK.md already commits to this. Keep the original bytes only if needed for re-runs (see "in-place re-BG-removal" differentiator).

### Library / personal-saved-products UX

- **One global library, not per-room.** Per-room libraries fragment the user's products; users want to drop the same cushion in two rooms.
- **Layout:** horizontal scrolling thumbnail strip across the bottom of the stage on mobile (collapsible to a tab), right-hand sidebar on desktop (current PoC pattern works at desktop sizes).
- **Add-to-stage interaction:** tap a thumbnail to drop the item at stage-center at a sensible default size (e.g., 25% of stage width). Avoid forcing drag-from-thumbnail-onto-stage on mobile — it's hand-cramping and discoverability-poor.
- **Remove from library:** long-press a thumbnail → confirm delete. Deleting a library item should NOT remove already-placed copies (the placement carries its own ref to the bytes).
- **Thumbnail generation:** generate a small (~128 px) thumb at upload time, store in IDB alongside the full image, render the thumb in the rail. Critical for scrolling perf with 50+ items.
- **No tags, no folders, no search in v1.** Adds schema and UI complexity for marginal gain at portfolio scale. If the library grows past ~30 items in practice, revisit.

### Drag / scale / rotate ergonomics on touch

- **Single finger drag** moves the selected item. If nothing is selected and the user single-finger drags, do nothing (avoid accidental stage-pan; explicit toolbar control for pan).
- **Two-finger pinch on a selected item** scales it (proportionally by default).
- **Two-finger pinch on empty stage** zooms the whole stage (only available if "zoom stage" mode is on, OR when a stage-level pinch starts on no item — Konva's hit testing makes this disambiguation tractable).
- **Two-finger twist** rotates the selected item. This is the trickiest gesture and has the worst cross-device consistency. Acceptable fallback: rotation only via the corner handle, no twist gesture. Decide after a mobile prototype test.
- **Konva `Transformer` corner handles** provide a desktop-friendly alternative; keep them visible at all times when an item is selected.
- **Hit-target inflation:** placed items have an invisible padding-region of ~12 px around their bounding box for selection. Without this, small items are unselectable by fat fingers. Critical and easy to forget.
- **Snap to original aspect ratio by default.** Hold Shift (desktop) or a UI toggle (mobile) to allow free-stretch.
- **No snap-to-grid by default.** Optional toggle. Reference apps mostly don't snap and users don't expect it for decor placement.

### Layering and depth ordering

- **Z-index by placement order, mutable via UI.** Each placement carries an integer `z`. Newly added items go to top.
- **Selection toolbar exposes:** Bring Forward (one step), Send Backward (one step), Bring to Front, Send to Back. Most apps offer all four — they're cheap.
- **No "true" depth occlusion** (cushion goes behind sofa-arm). That would require segmenting the room photo. Out of scope; manual layering is the answer.
- **Visual cue when an item is fully behind another:** subtle outline pulse on selection so the user can tell their selected item exists even when hidden. Easy and saves confusion.

### Undo / Redo

- **History entries:** add-placement, remove-placement, transform-change, layer-reorder, duplicate, flip. NOT: library uploads, room photo changes, mode toggles.
- **Coalesce continuous transforms.** While dragging, a single drag = one undo entry, not 60. Standard pattern: snapshot on pointer-down, commit on pointer-up.
- **Cap at 50 entries** — memory matters on phones.
- **Hotkeys (desktop):** Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z. Visible toolbar buttons on mobile.
- **Clear history on room switch.** History is per-room. (Could be per-session globally — pick one; per-room is simpler conceptually.)

### Room / project switching, multiple rooms

- **Schema:** `rooms[]` with `{ id, name, photoRef, placements[], createdAt }`. One `library` (global). One `activeRoomId`.
- **UI:** a "Rooms" drawer (hamburger menu or top-left) listing thumbnails + names. Tap to switch. "+ New Room" button.
- **Renaming a room:** inline edit on the room card.
- **Deleting a room:** confirm + soft-delete with brief undo toast.
- **Room cap:** soft-cap at 10 rooms in v1 to keep IDB footprint sane on mobile. Surface a warning, don't hard-block.
- **Cross-room copy of placements:** out of scope for v1. (Common ask; deferred.)
- **Critical:** design this schema **on day one**, even if multi-room ships in v1.1. Retrofitting room-switching onto a single-room store is painful. (Architecture flag — feeds ARCHITECTURE.md.)

### Export / share

- **Default export:** PNG at the source photo's native resolution (composited via `stage.toCanvas({ pixelRatio: sourceWidth / stageWidth })`).
- **File naming:** `roomdrop-{roomName}-{ISO date}.png`.
- **Web Share API on supported devices** (iOS Safari, Android Chrome): `navigator.share({ files: [...] })` with `<a download>` fallback.
- **No JPEG export in v1.** PNG is the right format for layered compositions; user can convert client-side later if needed.
- **No "save as project file" export in v1.** Would be a great differentiator (export the library + placements as a JSON+blobs ZIP), but it's a v1.x feature.
- **Watermark:** none. A "Made with RoomDrop" footer is a future call.

### Lighting / shadow realism

- **Skip realistic shadows.** Lighting estimation + shadow casting is research-grade. Out.
- **Ship optional cheap drop-shadow on selected items** (see Differentiators). It's a single Konva filter and it visibly helps "sit in the scene" without claiming realism.
- **Color/tone match** (auto-adjust the placed item's white balance to the room's): tempting and similar in cost to a small image-processing pass. **Deferred to v1.x** — needs a prototype to confirm it improves rather than damages perceived realism.

### Perspective hints

- **No automatic perspective correction.** Out of scope.
- **Optional grid / rule-of-thirds overlay** (see Differentiators) is the only "perspective hint" v1 ships.
- **Optional crosshair / center guide while dragging** to help align with room features — cheap, helps a lot, ship it.

### Reset / clear semantics

This is the place users will lose data if semantics are sloppy. Define three distinct actions:

| Action | What it does | Confirmation | Affects library? | Affects room photo? |
|--------|--------------|--------------|------------------|---------------------|
| **Clear placements** | Removes all placed items from the active room | Inline toast undo | No | No |
| **Replace room photo** | Swaps the active room's photo; placements remain (positions stay in stage coordinates) | Modal confirm | No | Yes |
| **Delete room** | Removes the room entirely (photo + placements) | Modal confirm | No | Yes (gone) |
| **Reset everything (nuclear)** | Clears library, all rooms, all placements. Used for "logout-equivalent" on a shared device. | Modal confirm + typed "RESET" or similar | Yes | Yes (all rooms gone) |

The PoC's "Clear sofa" / "New room" buttons map to the first two. Carry that mental model forward; just be explicit in copy.

## Feature Dependencies

```
Photo upload (room)
    └──enables──> Drag-to-position
                       └──requires──> BG-removed product images
                                            └──requires──> Product library

Drag-to-position
    └──enables──> Pinch-to-scale
                       └──enables──> Rotate
                       └──enables──> Layer ordering

Selection model
    └──required-by──> Delete, Duplicate, Flip, Layer ordering, Transform handles

Undo/Redo
    └──requires──> Selection model + atomic store mutations
    └──enables──> User confidence to experiment

Persistence (Zustand persist + IDB)
    └──required-by──> Multiple rooms, Library across sessions

Multiple-rooms schema
    └──must-precede──> Per-room placements list
                       └──must-precede──> Undo history per room

PWA install
    └──requires──> Service worker
    └──enhances──> Model caching, offline use
    └──conflicts──> "always-fresh" updates if no update-prompt UX is built

Web Share API
    └──enhances──> PNG export
    └──requires──> Secure context (https; handled by Vercel/Netlify/CF)

Drop-shadow toggle
    └──conflicts──> "no fake realism" purist stance — pick a side, document in copy
```

### Dependency Notes

- **BG removal must land before the library is useful** — otherwise the library is full of rectangular product photos with white backgrounds, defeating the purpose. Phase ordering: scaffold → library upload → BG removal → drag onto stage, not library → drag onto stage → BG removal.
- **Multi-room schema must precede single-room implementation.** Even if v1 ships with one room only at the UI level, the store schema must already model `rooms[]`. Otherwise multi-room becomes a migration headache.
- **Selection model precedes every transform feature.** Build it first, hardened (hit-target inflation, deselect on empty tap, visible affordance), then layer transforms on top.
- **Undo/redo presumes atomic store mutations.** If transforms are mutating placement objects directly via Konva refs, undo doesn't work. Mutations must flow through Zustand actions, with Konva as a view. (Architecture flag.)
- **Persistence must be designed before the UI** — retrofitting IDB-backed image refs into a store that started with base64-in-state is brutal. (Architecture flag.)

## MVP Definition

### Launch With (v1)

The minimum to call this a real product, not a prototype.

- [ ] **Room photo upload from camera or library** — core entry point.
- [ ] **EXIF orientation honored + downscale to 2048 px on import** — invisible but mandatory for mobile.
- [ ] **Product image upload to a personal library** with thumbnails.
- [ ] **In-browser BG removal** with Fast/Quality toggle, progress indicator.
- [ ] **Drop product onto stage by tapping its thumbnail** (places at center, default size).
- [ ] **Single-finger drag to reposition.**
- [ ] **Konva `Transformer` corner handles** for scale + rotate (works on touch + mouse).
- [ ] **Pinch-to-scale on selected item** (multi-touch).
- [ ] **Tap-to-select / tap-empty-to-deselect.**
- [ ] **Selection toolbar** with: Delete, Bring Forward, Send Backward, Duplicate.
- [ ] **Layer ordering** persists in store.
- [ ] **Reset placements** (per-room clear).
- [ ] **Replace room photo** (without losing library).
- [ ] **Persistence:** Zustand persist for state + IDB blobs for images.
- [ ] **PNG export** at source-photo resolution.
- [ ] **Responsive layout:** portrait phone, landscape phone, desktop.
- [ ] **Loading + progress UI** during BG removal.
- [ ] **Schema designed for multiple rooms** even if only one room is exposed in UI.

### Add After Validation (v1.x)

Trigger: v1 actually works on real phones and friends are using it.

- [ ] **Multiple rooms UI** (drawer + room switcher). Schema is already in place from v1.
- [ ] **Undo / redo** with coalesced transforms.
- [ ] **Duplicate / Flip horizontal** on the selection toolbar.
- [ ] **Long-press contextual menu** on mobile.
- [ ] **In-place re-BG-removal** with the other quality mode.
- [ ] **Optional drop-shadow toggle** per item.
- [ ] **Pinch-zoom the whole stage** when nothing is selected.
- [ ] **Web Share API** for PNG export.
- [ ] **PWA install + offline model caching** via `vite-plugin-pwa`.
- [ ] **Optional grid / rule-of-thirds overlay.**
- [ ] **Onboarding coachmark** for first-time users.

### Future Consideration (v2+)

Deferred until validated by user request.

- [ ] **Export project as ZIP** (library + rooms JSON + blobs) and re-import — manual cross-device "sync."
- [ ] **Color/tone match** of placed items to room lighting.
- [ ] **Tags / search in library** (only if user library size justifies it).
- [ ] **Cross-room copy of placements.**
- [ ] **Crop / mask refinement tool** for BG removal cleanups.
- [ ] **Tap-to-paint-back** for restoring over-erased edges.
- [ ] **Per-room notes** ("budget: $200; need to measure wall").
- [ ] **Honest watermark / "Made with RoomDrop"** on exports (only if the app gets shared a lot).

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Room photo upload (camera + library) | HIGH | LOW | P1 |
| Product library upload | HIGH | LOW | P1 |
| BG removal (Fast + Quality) | HIGH | HIGH (mostly stack work) | P1 |
| BG removal progress UI | HIGH | LOW | P1 |
| Drag to reposition | HIGH | MEDIUM | P1 |
| Pinch-to-scale + rotate handles | HIGH | MEDIUM | P1 |
| Tap-to-select model | HIGH | LOW | P1 |
| Selection toolbar (delete, layer, duplicate) | HIGH | LOW | P1 |
| Persistence (state + blobs) | HIGH | MEDIUM | P1 |
| PNG export | HIGH | LOW | P1 |
| Reset/clear with clear semantics | MEDIUM | LOW | P1 |
| Responsive mobile layout | HIGH | MEDIUM | P1 |
| Multi-room **schema** (not UI) | HIGH (avoids rewrite) | LOW (if done early) | P1 |
| Multi-room UI (drawer + switcher) | MEDIUM | MEDIUM | P2 |
| Undo / redo | HIGH | MEDIUM | P2 |
| In-place re-BG-removal | MEDIUM | MEDIUM | P2 |
| Drop-shadow toggle | MEDIUM | MEDIUM | P2 |
| Web Share API | MEDIUM | LOW | P2 |
| PWA install + offline | HIGH | MEDIUM | P2 |
| Long-press contextual menu | MEDIUM | MEDIUM | P2 |
| Pinch-zoom whole stage | MEDIUM | MEDIUM | P2 |
| Onboarding coachmark | MEDIUM | LOW | P2 |
| Grid / rule-of-thirds overlay | LOW | LOW | P2 |
| Project ZIP export/import | MEDIUM | HIGH | P3 |
| Color/tone match | MEDIUM | HIGH | P3 |
| Library tags/search | LOW | MEDIUM | P3 |
| Real lighting/shadow | HIGH (perceptually) | VERY HIGH | **Anti** |
| Surface-aware placement | HIGH (perceptually) | VERY HIGH | **Anti** |
| Live AR | HIGH (wow factor) | VERY HIGH | **Anti** |
| Catalog / commerce | MEDIUM | HIGH + violates constraints | **Anti** |
| Accounts / cloud sync | MEDIUM | HIGH + violates constraints | **Anti** |

**Priority key:**
- **P1:** Must have for v1 launch.
- **P2:** Add for v1.x once v1 is validated.
- **P3:** Future / v2+.
- **Anti:** Documented as out of scope — see Anti-Features table.

## Competitor Feature Analysis

| Feature | IKEA Place | Houzz View in My Room 3D | DecorMatters | Pinterest Try-On | **RoomDrop v1** |
|---------|-----------|--------------------------|--------------|------------------|------------------|
| Room input | Live camera (AR) | Live camera (AR) + photo | Photo upload | Live camera | Photo upload (camera or library) |
| Product source | IKEA catalog (3D) | Houzz catalog (3D) | DecorMatters catalog (2D) | Pinterest pins (2D) | **User-uploaded (2D)** |
| Placement | AR plane detection | AR plane detection | Manual drag on photo | Auto-place (face) | **Manual drag on photo** |
| BG removal of products | N/A (3D models) | N/A (3D models) | Done server-side, hidden | N/A (curated) | **Client-side, user-toggled** |
| Scale + rotate | Auto + manual | Manual | Manual | N/A | **Manual (touch + handles)** |
| Layering | Implicit (3D depth) | Implicit (3D depth) | Manual | None | **Manual (toolbar)** |
| Persistence | Account + cloud | Account + cloud | Account + cloud | Account + cloud | **localStorage + IDB (device-local)** |
| Multiple rooms | Yes (saved scenes) | Yes (ideabook) | Yes (projects) | No | **Yes (v1.x)** |
| Export / share | Screenshot + commerce link | Save as Sketch | Share to social | Save to board | **PNG download + Web Share** |
| Realistic lighting | Yes (AR-engine handles it) | Yes (AR-engine handles it) | Partial (canned shadows) | No | **No (optional cheap drop-shadow)** |
| Undo/Redo | Limited | Limited | No | No | **Yes (v1.x)** — *RoomDrop differentiator* |
| BG removal exposure | N/A | N/A | Hidden | N/A | **User-controlled Fast/Quality** — *RoomDrop differentiator* |
| Cost to run | Funded by IKEA | Funded by Houzz | Freemium + ads | Funded by Pinterest | **$0 / free tier** |
| Backend | Heavy | Heavy | Heavy | Heavy | **None** |

**Where RoomDrop wins on the matrix:** transparent BG-removal control, undo/redo, true device-local privacy ("your room photo never leaves your phone" — a real selling point), $0 to run, no signup.

**Where RoomDrop is honestly worse:** no real lighting/shadow, no AR walk-around, no curated catalog, no cloud sync. Document these honestly in onboarding; don't try to hide them.

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Table stakes | HIGH | Synthesis of the PoC + PROJECT.md requirements + standard direct-manipulation idioms. Low risk. |
| Anti-features | HIGH | All anti-features are either explicit PROJECT.md out-of-scope items or have well-known prohibitive complexity (lighting/shadow/AR/inpainting). |
| MVP scope | HIGH | Matches PROJECT.md Active requirements 1:1 + adds the minimum UX glue (selection, toolbar, hit-target inflation, exposed BG removal progress) that the requirements imply but don't list. |
| Differentiators — undo/redo, multi-room, fast/quality toggle, PWA | HIGH | Stack supports them; complexity is well-understood. |
| Differentiators — drop-shadow toggle, color/tone match | MEDIUM | Both depend on a visual prototype to confirm they improve perceived realism rather than damaging it. Document as "needs prototype" not "ship blind." |
| Multi-touch gesture ergonomics (twist-to-rotate, pinch-stage vs pinch-item disambiguation) | MEDIUM | Konva supports them but real-device testing on mid-range Android will surface gotchas. Recommend an early prototype milestone. |
| Differentiator: web share API | HIGH | Well-supported on iOS Safari 17+ and Chrome Android; clean fallback. |

## Sources

- [IKEA Place AR feature set (Engadget, Sept 2019)](https://www.engadget.com/2019-09-23-ikea-place-app-room-sets.html) — multi-item place, walk-around, scale accuracy claim
- [IKEA Place "erase your furniture" inpainting (Engadget, 2022)](https://www.engadget.com/ikea-ar-app-lets-you-preview-its-furniture-in-your-own-house-130004284.html) — context for the anti-feature rationale
- [Houzz "View in My Room" 3D (Digital Trends)](https://www.digitaltrends.com/home/houzz-app-augmented-reality/) — AR + multi-object + capture-as-Sketch + ideabook share flow
- [Houzz Pro visualization tools overview](https://pro.houzz.com/for-pros/visualization-tool) — Houzz's pro feature matrix as a reference set
- [DecorMatters in interior-design-app roundup (Bonsai)](https://www.hellobonsai.com/blog/best-interior-design-apps) — AR + 2D drag + buy-this flow
- [DecorMatters in homedesigninstitute roundup](https://homedesigninstitute.com/question/10878/what_are_the_best_home_decor_apps/) — 3D + commerce + AR positioning
- [List of free online room-design tools (List in Progress)](https://listinprogress.com/free-online-room-design-tools-tested-and-ranked/) — feature comparison across non-AR competitors
- [SAP Fiori — touch gesture guidance](https://www.sap.com/design-system/fiori-design-web/v1-136/foundations/interaction/gestures) — gesture categorization (pinch, twist, double-tap) and best practices
- [UXmatters — Designing for Touch](https://www.uxmatters.com/mt/archives/2020/02/designing-for-touch.php) — hit-target sizing rationale
- [Android Developers — Drag and scale gestures](https://developer.android.com/develop/ui/views/touch-and-input/gestures/scale) — multi-pointer tracking pattern for drag-vs-pinch disambiguation
- [Konva Multi-touch Scale sandbox](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html) — Konva's documented pattern for pinch-zoom-stage (used in stage-pinch differentiator)
- [STACK.md (this project)](.planning/research/STACK.md) — capability boundaries for all features
- [PROJECT.md (this project)](.planning/PROJECT.md) — Active / Out-of-Scope requirements that anchor table-stakes and anti-features
- [poc/Cushion Stylist.dc.html (this project)](poc/) — UX reference for upload → drag → place → reset flow

---
*Feature research for: mobile-first, client-only in-room product visualization (composite-on-photo)*
*Researched: 2026-06-24*
