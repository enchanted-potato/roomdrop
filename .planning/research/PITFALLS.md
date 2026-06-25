# Pitfalls — RoomDrop

**Domain:** Mobile-first, client-only image-editing SPA with in-browser ML segmentation, react-konva canvas, IndexedDB + localStorage persistence, single-PoP EU static hosting.
**Researched:** 2026-06-24
**Confidence:** HIGH on most pitfalls; MEDIUM on a few iOS Safari behaviors that drift release-to-release — flagged inline.

**Phase aliases used below (the roadmap step will refine):** `Foundations` (scaffolding + upload pipeline), `BG-Removal`, `Editor` (Konva stage), `Persistence`, `Export`, `Deploy`.

---

## Critical Pitfalls

These cause rewrites, silent data loss, or "doesn't work on iPhone."

### C1. `localStorage` quota silently corrupted by image blobs
- **What goes wrong:** A `dataURL`/`Blob` reaches the Zustand `persist` payload; iOS Safari's ~5 MB quota throws `QuotaExceededError`. The `persist` middleware swallows it by default, leaving the store half-written and the next rehydrate inconsistent.
- **Warning signs:** Items reappear after refresh, library entries vanish, `QuotaExceededError` warnings, Devtools shows a single localStorage key near 5 MB.
- **Prevention:** Strict `partialize` in Zustand `persist` — allowlist only id/transform/order primitives; never let a `Blob`/`File`/`HTMLImageElement` reach `JSON.stringify`. Unit-test the persisted JSON size (<100 KB). Wire `onRehydrateStorage` to log quota failures in dev. All bytes live in IndexedDB via idb-keyval.
- **Phase:** Persistence (design the boundary on day 1).

### C2. iOS Safari evicts IndexedDB after 7 days of no Safari use
- **What goes wrong:** WebKit's storage policy deletes IndexedDB, LocalStorage, SW registrations, and Cache Storage for origins the user hasn't interacted with in 7 days. Returning users find an empty library and a re-downloaded model.
- **Warning signs:** Tester returns after a week; library empty; model re-downloads. No error — just an empty store.
- **Prevention:** UI hint near the library ("Saved on this device — may be cleared by your browser"). Ship **Export/Import library** (zip of room + product images + placements JSON) as the real backup. Encourage **Add to Home Screen** — PWA installs are exempt. `navigator.storage.persist()` is *not* honored on Safari.
- **Phase:** Persistence (UI + Export/Import) + Deploy (PWA manifest).

### C3. EXIF orientation rotates uploads sideways on Chrome/Android (but not iOS)
- **What goes wrong:** iPhone JPEGs store landscape bytes + `Orientation: 6` EXIF tag. iOS Safari honors it; canvas `drawImage()` does not unless you opt in. Result: room photo rotates between the preview and the BG-removal worker, or comes out rotated on export.
- **Warning signs:** Photo correct on iPhone, sideways on Android. BG-removed output rotated relative to the thumbnail. Export rotated.
- **Prevention:** Use `createImageBitmap(file, { imageOrientation: 'from-image' })` for every image entering the pipeline — the canonical 2026 fix. Or let `browser-image-compression` (already in stack) normalize as a side effect of resize. Add a manual rotate-90° button as an escape hatch. Test with a real iPhone portrait photo on a real Android phone.
- **Phase:** Foundations (one `IngestImage` pipeline, before BG removal or display).

### C4. HEIC uploads from iPhone Photos fail on non-Safari browsers
- **What goes wrong:** Photos are stored as HEIC. Safari 17+ usually re-encodes to JPEG on `<input>` upload, but behavior is inconsistent. A `.heic` file picked from Files app, AirDrop, or desktop Chrome stays raw HEIC — no browser canvas can decode it.
- **Warning signs:** Broken image icon on upload; MIME `image/heic`/`image/heif`. Works on iPhone Safari, fails on iPad Files / desktop Chrome.
- **Prevention:** Narrow `accept` to `image/jpeg,image/png,image/webp` (this prompts iOS Photos to convert; avoid bare `accept="image/*"`). Sniff the first 12 bytes for `ftypheic|ftypheix|ftypmif1|ftyphevc` and show a friendly error ("Turn on Settings → Camera → Formats → Most Compatible"). Optionally lazy-load `heic2any` (~150 KB gz) only when HEIC is detected.
- **Phase:** Foundations (upload validation).

### C5. Canvas tainted by cross-origin image → `toBlob` throws `SecurityError`
- **What goes wrong:** Drawing a cross-origin image into a canvas without CORS taints it; `canvas.toBlob`, `toDataURL`, `getImageData` throw. v1 uploads files (`blob:` URLs — safe). The risk lands the first time someone ships "paste image URL" or a seeded catalog.
- **Warning signs:** Export fine for uploaded images, fails for URL-imported. Console: `Tainted canvases may not be exported.`
- **Prevention:** Keep v1 strictly file-upload — document it in code. If URL import later lands: set `image.crossOrigin = 'anonymous'` *before* `src`, and require ACAO on the source server. Safer pattern: `fetch().blob() → URL.createObjectURL()` so CORS surfaces before it reaches canvas.
- **Phase:** Editor + Export (gate the import surface).

### C6. iOS Safari OOM when ONNX runtime + a 12 MP photo coexist
- **What goes wrong:** A 12 MP iPhone JPEG decodes to ~48 MB RGBA. The `isnet_fp16` model adds ~80 MB. iOS Safari per-tab memory ceiling is tight (~250-500 MB depending on device). Loading model + input + intermediate tensors + output mask simultaneously crashes the tab.
- **Warning signs:** Tab reloads itself mid-segmentation on iPhone 12/13/SE; works on iPhone 15 Pro and desktop; worse with Quality.
- **Prevention:** **Mandatory pre-resize** with `browser-image-compression` to ≤2048 px on the long edge, JPEG q≈0.85, *before* the image enters BG removal *or* the editor. Default mid-range/older devices to Fast (`isnet_quint8`). Release input `Blob`/`ImageBitmap` (`bitmap.close()`) as soon as inference returns. Keep inference in the worker (imgly does — don't undo it). Measure on real iPhone SE + mid-range Android before declaring BG-Removal done.
- **Phase:** Foundations (resize pipeline) + BG-Removal (model selection).

### C7. Self-hosting the ONNX model blows the DanubeData 10 GB/mo cap
- **What goes wrong:** 10 GB ÷ 80 MB ≈ 125 downloads; one viral post burns through it. The default — letting imgly's CDN serve the model — keeps the cost off our bandwidth meter entirely.
- **Warning signs:** Considering committing the ONNX file. Considering "I'll precache with PWA" without scoping. Bandwidth dashboard climbing after a share.
- **Prevention:** **Do not self-host the ONNX model.** Let `@imgly/background-removal` fetch from imgly's CDN. Use `vite-plugin-pwa` to runtime-cache the model URL (`CacheFirst`, long `maxAgeSeconds`) so the *second* visit is free — but scope the rule to `*.onnx` + WASM/WebGPU artifacts, not "cache everything." Surface size up-front ("First-run download: ~44 MB"). Monitor DanubeData; CF Pages fallback ready.
- **Phase:** BG-Removal (don't self-host) + Deploy (PWA caching + monitoring).

### C8. AGPL-3.0 obligations on `@imgly/background-removal` for a publicly-deployed app
- **What goes wrong:** AGPL's network clause: providing the software's functionality over a network obliges you to offer users the complete corresponding source under AGPL. The safer reading is that this applies to the program as a whole when the AGPL component provides material functionality (BG removal does — it's the headline feature). Implications: (1) the whole app must be open source under AGPL or compatible; (2) closing the source or commercializing requires imgly's commercial license; (3) adding ads/affiliate to an AGPL app is legally fine but you still must publish source.
- **Warning signs:** Considering closing the source. Considering "I'll use it but not link my repo." Adding affiliate links or a paid tier without a license swap.
- **Prevention:** Decide now in `PROJECT.md` Key Decisions: RoomDrop v1 is open-source under AGPL-3.0. Add an `AGPL-3.0` `LICENSE` file in repo root + `license` field in `package.json` + a visible footer link "Open source — view source" pointing to the GitHub repo. The network clause is satisfied by *offering* the source — visible link in the UI is the canonical pattern. If monetization later: swap to `@huggingface/transformers` + RMBG-1.4 (verify per-model license at swap time) *before* commercializing — the pipeline boundary ("image in → image-with-alpha out") is a clean swap point per STACK.md.
- **Phase:** Foundations (LICENSE + footer link) + PROJECT.md decision before any code.

---

## Moderate Pitfalls

### M1. Drag-vs-scroll conflict on Konva — page scrolls instead of dragging item
- **What:** A touch on a Konva node fires `pointerdown` for Konva, but `touchstart` bubbles to the document and the browser scrolls. On a viewport-filling canvas, "moving a cushion" and "scrolling the page" become indistinguishable.
- **Signs:** Drag works on first try, then page scrolls and the item stays put. Worse on iOS Safari's momentum scroll.
- **Prevention:** `touch-action: none` on the Konva stage container (CSS), not body. Editor route: `html, body { overscroll-behavior: none; overflow: hidden; }`. Toolbar/drawer separately scrollable. Trust Konva's pointer normalization — do not mix `onTouchStart` + `onMouseDown`.
- **Phase:** Editor.

### M2. Missing or wrong meta viewport breaks mobile layout
- **What:** Without `<meta name="viewport" content="width=device-width, initial-scale=1">`, iOS Safari renders at 980 px wide. `user-scalable=no` breaks accessibility and doesn't reliably block pinch on iOS 10+. Notch/home indicator UI needs `viewport-fit=cover`.
- **Signs:** Microscopic render on iPhone; bottom toolbar hidden behind home indicator.
- **Prevention:** Exactly: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Use `env(safe-area-inset-bottom)` for any fixed bottom bar. Do NOT set `user-scalable=no`. Block pinch with `touch-action: none` on the *stage element only*.
- **Phase:** Foundations.

### M3. iOS Safari address-bar resize causes layout jank and Konva size drift
- **What:** URL bar collapses on scroll, changing visible height 50-80 px. `100vh` includes the bar; visible area doesn't. Konva stages bound to `window.innerHeight` resize on every scroll → flicker, items "shift."
- **Signs:** Stage flashes or items move on scroll/keyboard focus. Resize loop in profiler.
- **Prevention:** `100svh` (small viewport height) for the editor container — *not* `100vh` or `100dvh`. Lock editor scroll. Throttle Konva size updates with `ResizeObserver` + `rAF`; never bind directly to `innerHeight`.
- **Phase:** Editor.

### M4. First-run BG-removal model download UX (40-80 MB blank screen)
- **What:** User clicks "Remove background." 30-90 s blank wait on 4G. They close the tab.
- **Signs:** Testers: "I clicked and nothing happened." High bounce on first BG-removal attempt.
- **Prevention:** Hook imgly's progress callback → determinate progress bar with MB downloaded. Surface size *before* the download: "First time setup: downloading background removal model (~44 MB on Wi-Fi recommended)." Confirm-to-proceed on cellular (`navigator.connection.effectiveType` as a hint). PWA-cache the model (C7) so it's a one-time hit. Optionally pre-warm the model in the background after the first image upload.
- **Phase:** BG-Removal.

### M5. User navigates away mid-segmentation → leaked worker + unmounted-state warnings
- **What:** BG removal takes 3-15 s. If the user closes the editor or switches tabs, the worker keeps running, model stays resident, and the result resolves into a destroyed React component. Contributes to iOS OOM.
- **Signs:** React unmount warnings after fast nav. Memory grows after each abandoned attempt. iOS reloads tab after 2-3 tries.
- **Prevention:** Wrap each BG-removal call in an `AbortController`; pass `signal` to imgly's API (v1.7+ supports cancellation — verify at integration). On editor unmount: abort, terminate any owned worker, `bitmap.close()` ImageBitmap inputs. Use `visibilitychange` to pause/abort when the tab backgrounds. Treat segmentation as a background job with explicit lifecycle, not an `await` inside a render effect.
- **Phase:** BG-Removal.

### M6. WebGPU detection wrong → model picks WASM unnecessarily (or crashes on WASM-only)
- **What:** `navigator.gpu` exists but `requestAdapter()` returns null (Firefox flag, Safari with WebGPU disabled, low-end Android). Picking WebGPU-only paths crashes the worker; treating "no WebGPU" as "no BG removal" disables iOS Safari <18 entirely.
- **Signs:** "BG removal failed" on a subset of devices. `Failed to create GPU adapter` console.
- **Prevention:** `if (navigator.gpu) { const adapter = await navigator.gpu.requestAdapter(); webgpu = !!adapter; }` — both checks, async. Let imgly choose unless you have a measured reason to override. Default **Fast** on WASM-only; offer Quality as an opt-in with a "slow" badge. Test on: iPhone 14 (no WebGPU pre-18), iPhone 15 (WebGPU on 18+), mid-range Android, desktop Chrome, Safari 17 + 18.
- **Phase:** BG-Removal.

### M7. Transformer handles too small for touch — can't grab rotate handle
- **What:** Konva `Transformer` `anchorSize` defaults to 10 px — brutal for thumb. Rotate handle sits ~25 px from the bounding box, same size. Users miss it and conclude rotation is broken.
- **Signs:** "I can move but can't rotate." iPad fine, iPhone not.
- **Prevention:** `<Transformer anchorSize={isTouchDevice ? 24 : 10} rotateAnchorOffset={isTouchDevice ? 48 : 25} />`. Bump `anchorStrokeWidth`/`anchorCornerRadius` for visual feedback. Pad active hit area (`padding={6}` per-anchor in Konva 9).
- **Phase:** Editor.

### M8. Two-finger gestures conflict with browser pinch-zoom
- **What:** Without `touch-action: none` on the stage, pinch zooms the whole page including chrome — user can't recover.
- **Signs:** Pinch zooms the entire UI; pinch-out doesn't fully restore.
- **Prevention:** `touch-action: none` on the Konva stage container (not body). Implement scene-zoom inside Konva using the [Multi-touch Scale](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html) pattern. **Provide a Reset zoom button**. Honestly evaluate whether scene-zoom belongs in v1 at all if per-item scale is good enough.
- **Phase:** Editor.

### M9. PNG export blurry on retina or wrong size
- **What:** Konva's `stage.toCanvas()` / `toBlob()` exports at display size, not source resolution. A 4032×3024 input becomes a 750×563 PNG on non-retina; bloated on retina.
- **Signs:** Exported PNG soft/pixelated when reopened; file size inconsistent across devices for the same composition.
- **Prevention:** Export at the room photo's native resolution: `stage.toBlob({ pixelRatio: roomImage.naturalWidth / stage.width(), mimeType: 'image/png' })`. Cap at 2.0× to avoid absurd files. Better: render the composition into an offscreen `<canvas>` at the chosen output size, draw room + items with final transforms, `canvas.toBlob('image/png')` — decouples display from export.
- **Phase:** Export.

### M10. Export filename collides / has no extension on iOS
- **What:** iOS Safari historically ignores `<a download="…">` for blob URLs — saves with random name, no extension, to Files. Users can't find it; when they do, it won't open.
- **Signs:** "Where did the file go on iPhone?" No `.png` extension. Downloads folder has 5 files named `roomdrop`.
- **Prevention:** Filename: `roomdrop-YYYYMMDD-shortId.png`. On desktop: `URL.createObjectURL` + `<a download>`. On iOS Safari: **Web Share API** with a `File` (`navigator.share({ files: [file] })`) — saves to Photos/Files via the native sheet. Feature-detect with `navigator.canShare({ files: [...] })`. Always `URL.revokeObjectURL` after trigger. `file-saver` covers most of this — verify on a real iPhone.
- **Phase:** Export.

### M11. Multi-tab race writes corrupt the store
- **What:** Two tabs (or tab + home-screen install) both hydrate, both think they're authoritative, last write wins per transaction. The user loses placements made in the first tab.
- **Signs:** Items vanish after closing the first tab; persisted state diverges between tabs.
- **Prevention:** For v1, ship a `storage`/`BroadcastChannel` listener that surfaces a "you've opened RoomDrop in another tab — close one to avoid losing work" banner. Honest and cheap. Full multi-tab merge is out of scope.
- **Phase:** Persistence.

### M12. Structured-clone failure on `Blob` references
- **What:** IndexedDB accepts `Blob` values, but storing a `URL.createObjectURL(blob)` *string* (instead of the blob itself) breaks across reload — the URL is a per-tab handle. Rarer: `File` with weird metadata throwing `DataCloneError`.
- **Signs:** Library entries display as broken images after reload; console errors about URL not resolving or `DataCloneError`.
- **Prevention:** Store **`Blob` instances** in IndexedDB via idb-keyval, never object URLs. Generate object URLs *on demand* at load time; revoke on component unmount. Wrap storage in a typed module: `saveImage(id, blob: Blob)` / `loadImage(id): Promise<Blob>` — never expose URLs from the storage layer.
- **Phase:** Persistence.

### M13. GDPR cookie/consent needed even with zero analytics (ePrivacy nuance)
- **What:** ePrivacy Directive applies to any non-essential storage on the user's device — IndexedDB and localStorage included, not just cookies. Strict reading: consent needed before storing the photo. Lenient reading (likely defensible here): persistence *is* the requested service (the app's value is "remember my room"), so it's essential storage and no banner is required.
- **Signs:** EU testers ask where the cookie banner is. Future plan to add analytics/affiliate → strict consent required.
- **Prevention:** Ship a one-time, non-blocking "RoomDrop stores your photos on this device. Nothing is sent to a server." disclosure on first run — an honesty notice, not a cookie banner. Clear `/privacy` page: no third-party scripts, no analytics, no cookies (DanubeData only terminates TLS). When/if analytics or affiliate links arrive: use a real consent library (`Klaro!`, `cookie-consent`); don't roll your own. **Not legal advice.**
- **Phase:** Deploy.

### M14. Stale bundle served after deploy due to aggressive caching
- **What:** DanubeData caches immutable assets 1 year. Vite's filename hashing handles JS/CSS, but if `index.html` or the SW is cached aggressively, users get stuck on old code.
- **Signs:** Deploy a fix → users still see the old bug; hard reload fixes it for that user only.
- **Prevention:** Verify Vite's default `[name].[hash].js` is intact in `rollupOptions.output`. Verify DanubeData serves `index.html` with `Cache-Control: no-cache` (default; verify response headers). `vite-plugin-pwa` with `registerType: 'autoUpdate'` + a "New version available — refresh" toast on SW activation. Surface a build ID in the footer (`Build: abc123`) — instant version verification.
- **Phase:** Deploy.

---

## Minor Pitfalls

### m1. Konva z-order vs React reconciliation drift
**What:** Naive array splice for reorder + index keys → React tears down/remounts nodes on every reorder, losing transformer selection.
**Prevention:** Stable IDs as React keys (`key={item.id}`). Sort by separate `zIndex` field; reorder by mutating `zIndex`, not array position.
**Phase:** Editor.

### m2. Accidental delete with no undo
**What:** Fat-touch on "Delete" instead of "Bring forward" → cushion gone.
**Prevention:** Confirm destructive actions on touch, or a single-level undo (last placement snapshot in a ref, not full history). Place delete away from common-tap targets (long-press / swipe).
**Phase:** Editor.

### m3. Hairline strokes fuzzy on retina
**What:** Anchor strokes at 1× look fine, fuzzy at 2×/3× DPR. Minor for a bitmap-heavy editor.
**Prevention:** Integer pixel values; set Konva `pixelRatio` explicitly to `devicePixelRatio` for display layers.
**Phase:** Editor.

### m4. ServiceWorker ships a broken shell on first deploy
**What:** Hand-rolled SW or misconfigured PWA caches `index.html` aggressively → next deploy → users stuck.
**Prevention:** Use `vite-plugin-pwa` defaults. Do not write SW logic by hand for v1. Expose a `?nosw=1` query string to bypass SW in emergencies — and document it.
**Phase:** Deploy.

### m5. Single-PoP latency for non-EU visitors
**What:** DanubeData has one PoP (Falkenstein, DE). US/AU first load ~300-500 ms RTT until cache warms.
**Prevention:** Accept it for v1 (audience is EU). If non-EU traction materializes, fall back to Cloudflare Pages — static bundle is portable per STACK.md.
**Phase:** Deploy (monitor, don't pre-optimize).

### m6. 60 fps drag stutters with many items
**What:** Dragging with 20 other transparent PNGs on the same Konva layer redraws all of them every frame.
**Prevention:** Use Konva's layer architecture — room on one layer, items on another, transformer on a third. `Layer.listening(false)` for the room. `Layer.cache()` only if profiling shows the need.
**Phase:** Editor.

### m7. `URL.createObjectURL` leaks if not revoked
**What:** Every blob URL reserves memory until revoked or document unloads.
**Prevention:** Centralize URL creation in a `useObjectURL(blob)` hook that revokes on unmount. Audit each editor session.
**Phase:** Editor.

### m8. `<input type="file" capture="environment">` behavior varies
**What:** On Android, `capture` may force the camera and skip Photos picker. On desktop it's ignored.
**Prevention:** Offer two buttons: "Take photo" (with `capture="environment"`) and "Choose photo" (without `capture`). One control optimized per flow.
**Phase:** Foundations.

---

## Phase-Specific Warnings (Roadmap Cheat Sheet)

| Phase | Pitfalls (refs) | Top-Line Mitigation |
|---|---|---|
| **Foundations / Upload** | C3, C4, C6 (resize), C8 (LICENSE), M2, m8 | Bake an `IngestImage` pipeline: HEIC sniff → `createImageBitmap({ imageOrientation: 'from-image' })` → resize ≤2048 px → store as `Blob`. One door in, normalized blobs out. AGPL LICENSE + footer link day one. |
| **BG-Removal** | C6, C7, M4, M5, M6 | Don't self-host the model. Use imgly's progress callback + `AbortController`. Default Fast on WASM-only. Benchmark on real iPhone SE + mid-range Android *before* declaring milestone done. |
| **Editor / Stage** | C5 (gate file-only), M1, M3, M7, M8, m1, m2, m6, m7 | `touch-action: none` on stage container; `100svh` height; big touch handles; stable React keys; three Konva layers (room / items / transformer); centralized `useObjectURL`. |
| **Persistence** | C1, C2, M11, M12 | Strict Zustand `partialize`. All bytes in IndexedDB via idb-keyval. Export/Import as the real backup. BroadcastChannel warning for multi-tab. |
| **Export** | C5, M9, M10 | Offscreen compositing canvas at `roomImage.naturalWidth`. `navigator.share({ files })` on iOS, `<a download>` elsewhere. Date-stamped filenames. |
| **Deploy** | C2 (PWA), C7 (bandwidth), M13, M14, m4, m5 | `vite-plugin-pwa` `autoUpdate` + update toast. Cache only the model + bundle, not everything. Privacy page + first-run honesty notice. Build ID in footer. Watch DanubeData bandwidth; CF Pages fallback ready. |

---

## Sources

- [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [WebKit blog — Updates to Storage Policy (7-day eviction)](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [Apple Developer Forums — Safari 17 HEIC auto-convert thread](https://developer.apple.com/forums/thread/743049)
- [shkspr.mobi — Coping with HEIC in the browser](https://shkspr.mobi/blog/2020/12/coping-with-heic-in-the-browser/)
- [justmarkup — Image orientation on the web](https://justmarkup.com/articles/2019-10-21-image-orientation/)
- [imgly/background-removal-js LICENSE](https://github.com/imgly/background-removal-js/blob/main/LICENSE.md)
- [TLDRLegal — AGPL-3.0 explained](https://www.tldrlegal.com/license/gnu-affero-general-public-license-v3-agpl-3-0)
- [Konva Multi-touch Scale Stage docs](https://konvajs.org/docs/sandbox/Multi-touch_Scale_Stage.html)
- [Konva FAQ — mobile/touch](https://konvajs.org/docs/faq.html)
