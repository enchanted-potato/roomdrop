# Roadmap: RoomDrop

## Overview

RoomDrop is a mobile-first, client-only SPA where you photograph your room and drop your own product cutouts onto it. The journey: ship the scaffolding + image pipeline + persistence first (so a room photo survives reload), then a usable editor that places library items as-uploaded (using the `cutoutId ?? originalId` seam so BG removal can land later without rewrites), then close the loop with PNG export, then unlock the perceptual win of in-browser background removal, then add onboarding + multi-tab safety, and finally deploy as a PWA to DanubeData so the second visit is free. Every phase delivers a usable end-to-end capability — the cutout seam means the editor is real before the ML lands.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundations & Image Pipeline** - Vite/React/TS scaffold, AGPL license, ImagePipeline, multi-room schema, IDB persistence, room photo upload survives reload (completed 2026-07-01)
- [x] **Phase 2: Library & Editor (originals)** - Product library + drag/scale/rotate/layer/delete editor using `cutoutId ?? originalId` seam (completed 2026-07-04)
- [x] **Phase 3: Export & Reset Semantics** - PNG export at native resolution, Web Share on mobile, three confirmed destructive actions (completed 2026-07-04)
- [x] **Phase 4: In-Browser Background Removal** - BgRemovalService with Fast/Quality, progress, cancel, re-run, failure fallback (completed 2026-07-04)
- [ ] **Phase 5: Onboarding & Multi-Tab Safety** - First-run honesty notice, empty-state CTA, sample room, post-placement coachmark, BroadcastChannel warning
- [ ] **Phase 6: Deploy & PWA** - vite-plugin-pwa with model caching, DanubeData deploy, build-ID footer, second-visit-is-free

## Phase Details

### Phase 1: Foundations & Image Pipeline
**Goal**: A deployed-ready Vite/React/TS app where a user can upload a room photo from camera or file picker and have it survive reload — with the multi-room schema, AGPL license, and image normalization seams in place from day one.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, UPL-01, UPL-03, PER-02, PER-03, PER-04
**Success Criteria** (what must be TRUE):
  1. User can open the app on iPhone SE through desktop and see a mobile-first responsive shell with correct safe-area handling
  2. User can upload a room photo from camera (mobile) or file picker (desktop), and an HEIC file shows a friendly error rather than a broken icon
  3. User can replace the active room photo, and the new one is correctly EXIF-oriented and resized to ≤2048 px long edge
  4. User can reload the page and the active room photo re-appears at first paint (Zustand metadata in localStorage; Blob in IndexedDB via idb-keyval)
  5. Repo contains an `AGPL-3.0` LICENSE file at root and an "Open source" footer link visible in the UI
**Plans**: TBD
**UI hint**: yes

### Phase 2: Library & Editor (originals)
**Goal**: A usable in-room editor: the user uploads product images into a personal library, drops them onto the room photo, and freely moves/scales/rotates/layers/deletes them with touch and mouse — using original uploads (no BG removal yet) via the `cutoutId ?? originalId` seam.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: UPL-02, UPL-04, UPL-05, EDT-01, EDT-02, EDT-03, EDT-04, EDT-05, EDT-06, EDT-07, EDT-08, EDT-09, EDT-10, EDT-11, PER-01
**Success Criteria** (what must be TRUE):
  1. User can upload one or more product images into a library and see thumbnails with a (placeholder) BG-removal status badge per item
  2. User can drag a library item onto the room photo and freely move, pinch-scale, and rotate it on touch; corner handles work with mouse
  3. User can tap an item to select it (Transformer chrome appears), tap empty stage to deselect, and the stage doesn't fight page scroll or browser pinch-zoom
  4. User can bring forward, send backward, duplicate, flip horizontally, and delete the selected item (with one-level undo for accidental delete)
  5. User can delete a library item without losing placements that already used it, and reload the page to find the library, placements, and layer order intact
**Plans**: TBD
**UI hint**: yes

### Phase 3: Export & Reset Semantics
**Goal**: Close the loop: user can export the designed room as a PNG and share it, and has three distinct, clearly-named destructive actions when they want to start over.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: EXP-01, EXP-02, EXP-03, PER-05
**Success Criteria** (what must be TRUE):
  1. User can export the designed room as a PNG at the room photo's native resolution (not the on-screen stage size)
  2. On mobile, export opens the native share sheet (`navigator.share({ files })`) so the user can save to Photos or send to a messenger
  3. On desktop, export downloads as `roomdrop-YYYYMMDD-<shortId>.png`
  4. User sees three confirmed destructive actions (Clear placements, Change room photo, Reset everything) and accidentally tapping one does not destroy data
**Plans**: TBD
**UI hint**: yes

### Phase 4: In-Browser Background Removal
**Goal**: Library items have their backgrounds removed fully in the browser; the user controls the Fast vs Quality tradeoff, sees honest progress and download size, can cancel mid-job, and recovers gracefully on failure — making placed items actually sit in the scene.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: BGR-01, BGR-02, BGR-03, BGR-04, BGR-05, BGR-06
**Success Criteria** (what must be TRUE):
  1. Every product image uploaded after this phase ships has its background removed in the browser (no server call) and the cutout replaces the original on the stage via the `cutoutId ?? originalId` seam
  2. User can switch between Fast and Quality in Settings; the default is chosen by a WebGPU capability probe and the first-run model download shows a determinate progress + size hint
  3. User can cancel a BG-removal job mid-flight without leaking workers, freezing the UI, or corrupting library state
  4. When BG removal fails, the original image is still placeable and the user is told why it failed
  5. User can re-run BG removal on a library item (e.g. after switching Fast → Quality) and the new cutout replaces the old one
**Plans**: TBD
**UI hint**: yes

### Phase 5: Onboarding & Multi-Tab Safety
**Goal**: A first-time visitor understands what RoomDrop is and can try it without uploading; an existing user is warned (not silently corrupted) when they open the app in a second tab.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: FND-05, ONB-01, ONB-02, ONB-03, PER-06
**Success Criteria** (what must be TRUE):
  1. First load shows a clear "Upload a room photo" empty-state CTA and a one-time, non-blocking honesty notice ("photos stay on this device, nothing sent to a server")
  2. User can tap "Try with a sample room" and immediately drag pre-cutout sample products onto a bundled demo room — no upload required
  3. After the user places their first item, a one-time tooltip explains pinch-to-scale and pinch-to-rotate
  4. Opening RoomDrop in a second tab surfaces a "RoomDrop is open in another tab" banner via BroadcastChannel rather than silently corrupting the store
**Plans**: TBD
**UI hint**: yes

### Phase 6: Deploy & PWA
**Goal**: The app is live on DanubeData free tier as a PWA: the first visit downloads the ONNX model from imgly's CDN with a visible build ID; the second visit reuses the cached model and is free.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: BGR-07
**Success Criteria** (what must be TRUE):
  1. App is reachable at a public DanubeData URL, with the build ID visible in the footer next to the "Open source" link
  2. ONNX model is fetched from imgly's CDN (not self-hosted in our bundle, so the 10 GB/mo cap is not at risk)
  3. On a second visit, the model loads from the PWA cache without re-downloading, and a "New version available — refresh" toast appears after a redeploy
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations & Image Pipeline | 4/4 | Complete   | 2026-07-01 |
| 2. Library & Editor (originals) | 1/1 | Complete | 2026-07-04 |
| 3. Export & Reset Semantics | 1/1 | Complete | 2026-07-04 |
| 4. In-Browser Background Removal | 1/1 | Complete | 2026-07-04 |
| 5. Onboarding & Multi-Tab Safety | 0/TBD | Not started | - |
| 6. Deploy & PWA | 0/TBD | Not started | - |
