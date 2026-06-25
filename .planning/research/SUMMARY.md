# Research Summary — RoomDrop

**Domain:** Mobile-first, client-only in-room product visualization SPA (composite-on-photo, in-browser ML background removal, static EU hosting, $0 budget)
**Synthesized:** 2026-06-25
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Executive Summary

RoomDrop is a thick-client SPA whose architecture is dominated by a tight set of well-understood patterns: a **Vite 7 + React 19 + TypeScript** scaffold, a **react-konva** stage for direct-manipulation editing, **@imgly/background-removal** for in-browser ML segmentation with a user-exposed Fast/Quality toggle, a **Zustand store** that holds only metadata + blob ids, and an **IndexedDB-backed persistence service** (via `idb-keyval`) that owns all Blob lifecycles. Deployment is static to **DanubeData free tier** (EU residency, commercial-use allowed, 10 GB/mo bandwidth). The competitive landscape (IKEA Place, DecorMatters, Pinterest Try-On) is dominated by AR + catalog + backend apps; RoomDrop deliberately wins on transparency (exposed BG-removal quality toggle), privacy ("photo never leaves your phone"), and zero-cost operation — and concedes realistic lighting, AR walk-around, and catalogs.

The single biggest perceptual lever is **background-removal quality**; the single biggest engineering risk is **mid-range mobile memory** (a 12 MP iPhone photo + an 80 MB ONNX model crashes iOS Safari without aggressive resize). The architecture is structured so a usable v1 ships *without* BG removal — the `library.cutoutId` seam lets Phase 1 render originals and Phase 2 layer in segmentation without rewriting Phase 1. Three other risks deserve up-front decisions: **AGPL-3.0 obligations** on the BG-removal library (decide and document v1 license now), **iOS Safari 7-day IndexedDB eviction** (ship Export/Import as the real backup; encourage PWA install), and **multi-room schema** (design it on day one even if v1 UI exposes a single room — retrofitting is brutal).

Confidence is **HIGH** across stack, table-stakes features, architectural seams, and most pitfalls. The areas requiring real-device measurement before declaring "done" are **mid-range Android / iPhone SE BG-removal latency and OOM behavior**, **two-finger gesture ergonomics on Konva**, and the **drop-shadow visual fidelity** that determines whether the optional v1.x cheap-shadow feature actually improves perceived realism.

---

## Key Findings

### Stack (HIGH confidence)

- **Vite 7 + React 19 + TypeScript 5.x** — de-facto SPA stack; pin to current stable lines.
- **react-konva 19 + Konva 9** — first-class React binding, multi-layer canvas, built-in `Transformer`, unified touch+mouse pointer events.
- **@imgly/background-removal ^1.7** — primary BG removal; ships its own Web Worker around ONNX Runtime Web (WebGPU + WASM fallback). Models: `isnet_quint8` (~44 MB, "Fast") and `isnet_fp16` (~80 MB, "Quality"). **AGPL-3.0 — decision deferred (see PROJECT.md Key Decisions).**
- **Zustand 5 + `persist` middleware** — small payload, allowlist via `partialize`, never let Blobs reach `JSON.stringify`.
- **idb-keyval 6** — IndexedDB Blob store; do NOT use Dexie/localforage (overkill).
- **browser-image-compression** — non-optional pre-resize to ≤2048 px on the long edge.
- **Tailwind 4 + `@tailwindcss/vite`**, **Vitest**, **Playwright**, **vite-plugin-pwa** for offline model caching.
- **Host: DanubeData free tier** (EU, commercial-use allowed); **Cloudflare Pages** as portable fallback if bandwidth is breached.

### Features (HIGH on table stakes & anti-features)

**Must-have (v1, P1):** room photo upload (camera + library), product library upload, in-browser BG removal with Fast/Quality toggle + progress UI, drag/scale/rotate on touch + mouse, Konva `Transformer` corner handles, pinch-to-scale, tap-to-select, selection toolbar (delete, layer ordering, duplicate), persistence (state + blobs), PNG export at source-photo resolution, reset/clear with clear semantics, responsive mobile-first layout, **multi-room schema designed but single-room UI**.

**Should-have (v1.x, P2):** multi-room UI, undo/redo (coalesced transforms, cap 50), long-press contextual menu, in-place re-BG-removal, optional drop-shadow toggle, pinch-zoom whole stage, Web Share API, PWA install + offline, onboarding coachmark.

**Anti-features (deliberately skipped):** realistic shadow/lighting, surface-aware placement, perspective warp, live AR, curated catalog, accounts/cloud sync, shareable preview URLs, real-time collaboration, AI suggestions, 3D models, server-side BG removal, inpainting.

### Architecture (HIGH confidence)

Four hard boundaries:

1. **`Stage` (react-konva)** — sole consumer of Konva imports.
2. **`BgRemovalService`** — sole consumer of `@imgly/background-removal`; lazy import, serial job queue (concurrency 1), capability probe, progress + cancel via Zustand.
3. **`PersistenceService`** — sole owner of IDB and `URL.createObjectURL` lifecycle; ref-counted; three IDB stores (`originals`, `cutouts`, `thumbs`).
4. **Zustand store** — six slices (`rooms`, `library`, `placements`, `settings`, `bgJobs`, `ui`); only the first four are persisted via `partialize`. **No Blobs in store ever** — only blob ids.

**Critical invariants:** images enter exactly once via `ImagePipeline` (HEIC sniff → EXIF orient → resize); room photo is a *background bitmap*, never BG-removed; `library.cutoutId` is optional and rendering falls back to `originalId` so v1 ships before BG removal lands.

### Pitfalls (HIGH confidence on most)

**Critical (rewrites or data loss):**

- **C1** `localStorage` quota corrupted by Blob payloads → strict `partialize`.
- **C2** iOS Safari evicts IDB after 7 idle days → ship Export/Import library backup; encourage PWA install.
- **C3** EXIF rotation breaks on Chrome/Android → `createImageBitmap(file, { imageOrientation: 'from-image' })`.
- **C4** HEIC uploads break off-Safari → narrow `accept`, sniff first 12 bytes.
- **C5** Tainted canvas → keep v1 strictly file-upload only.
- **C6** iOS Safari OOM with 12 MP photo + ONNX model → **mandatory** pre-resize to ≤2048 px; release ImageBitmaps eagerly.
- **C7** Self-hosting ONNX model blows 10 GB/mo cap → let imgly CDN serve; PWA-runtime-cache the URL.
- **C8** AGPL-3.0 obligations → decision deferred but flagged ⚠️ Revisit in PROJECT.md before any closed-source commercialization.

**Top moderate:** `touch-action: none` on stage container (M1, M8), `100svh` not `100vh` (M3), big touch handles (M7), abort BG-removal on unmount (M5), correct PNG export pixel ratio (M9), Web Share API on iOS export (M10), multi-tab BroadcastChannel warning (M11).

---

## Implications for Roadmap

The architecture document already implies a clean three-phase split that matches feature dependencies and pitfall avoidance.

### Suggested Phases

**Phase 1 — Foundations + Editor (ship without BG removal)**

- *Rationale:* The `cutoutId` seam lets the editor ship end-to-end while BG removal lands separately. Builds confidence on the highest-value interaction (drag/scale/rotate) before the highest-risk compute (in-browser ML).
- *Delivers:* Vite/React/TS scaffold; `ImagePipeline` (HEIC sniff, EXIF orient, resize); `PersistenceService` (full IDB schema including unused `cutouts` store); Zustand with all six slices and multi-room schema; `UploadSheet`; `LibraryDrawer` (renders originals); `Stage` + `PlacementNode` + `Toolbar`; selection model with inflated hit targets; `ExportService`; `BootService`; AGPL LICENSE + footer link.
- *Pitfalls in scope:* C1, C3, C4, C5, C8, M1, M2, M3, M7, M8, M11, M12, m1, m2, m6, m7, m8.

**Phase 2 — Background Removal**

- *Rationale:* Highest perceptual lever and highest engineering risk. Must follow Phase 1.
- *Delivers:* `BgRemovalService` (lazy-import, serial queue, AbortController, capability probe); `bgJobs` slice; Settings panel (Fast/Quality toggle + storage usage); library status badges; in-place re-run; first-run model download UX; migration that auto-queues Phase-1 library items.
- *Pitfalls in scope:* C6, C7, C8 (verify license), M4, M5, M6.
- *Research flag:* **Yes.** Real iPhone SE + mid-range Android benchmarks; verify `@imgly/background-removal` v1.7+ progress + abort API at integration.

**Phase 3 — Polish, Persistence Resilience, Deploy**

- *Rationale:* Closes the loop on portfolio-quality polish and ships a PWA that survives iOS Safari's 7-day eviction. Multi-room UI lights up since the schema already exists.
- *Delivers:* Multi-room drawer + switcher; undo/redo (coalesced transforms, cap 50); long-press contextual menu; duplicate/flip; Web Share API; PWA install + offline model caching via `vite-plugin-pwa`; Export/Import library ZIP backup; first-run honesty notice; onboarding coachmark; optional drop-shadow toggle (gated on visual prototype); DanubeData deploy with build-ID footer and bandwidth monitoring; Cloudflare Pages fallback documented.
- *Pitfalls in scope:* C2, C7 (model PWA scoping), M10, M13, M14, m4, m5.
- *Research flag:* **Partial.** Drop-shadow visual prototype only.

### Phase Sequencing Constraints

1. `PersistenceService` and Zustand slices (with full multi-room schema and `cutoutId?`) **must** land before any UI.
2. Selection model must precede every transform feature.
3. Atomic store mutations (not Konva-ref mutations) must precede undo/redo.
4. AGPL decision and LICENSE must land before public deploy.
5. `IngestImage` pipeline must be the single door for all image input.

### Research Flags

| Phase | Needs research? | Why |
|-------|------------------|-----|
| 1 — Foundations + Editor | No | All patterns documented; stack choices verified. |
| 2 — BG Removal | **Yes** | Real-device latency/OOM measurement; verify `@imgly/background-removal` v1.7+ progress + abort API. |
| 3 — Polish + Deploy | Partial | Drop-shadow visual prototype; verify DanubeData free-tier terms at deploy time. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (framework, canvas, state, storage, host) | HIGH | Mainstream, current-major versions verified. |
| BG removal library choice | HIGH | API + model sizes verified. |
| BG removal mobile latency / OOM thresholds | MEDIUM | Needs real iPhone SE + mid-range Android measurement in Phase 2. |
| Table-stakes & anti-features | HIGH | Direct synthesis of PROJECT.md, PoC, and competitive set. |
| MVP scope | HIGH | Matches PROJECT.md Active 1:1. |
| Differentiators (drop-shadow, color/tone match) | MEDIUM | Need visual prototype. |
| Multi-touch gesture ergonomics | MEDIUM | Real-device testing will surface gotchas. |
| Architecture seams & invariants | HIGH | Boundaries are well-known. |
| Critical pitfalls | HIGH | All eight have concrete prevention. |
| iOS Safari behaviors | MEDIUM | Drift release-to-release; verify on a real device. |
| AGPL-3.0 obligations | HIGH on the rule; MEDIUM on the scope reading | **Not legal advice.** |

### Gaps to Address in Requirements/Roadmap

- AGPL decision is logged as **Pending / Revisit** in PROJECT.md — not blocking v1.
- Phase 2 entry needs defined real-device test bed and measurable exit criterion.
- Drop-shadow visual prototype must precede committing the differentiator.
- Multi-tab strategy v1 = warn via BroadcastChannel; future merge semantics deferred.
- Monetization fork: library swap from `@imgly/background-removal` (AGPL) to `@huggingface/transformers` + RMBG-1.4 is a planned clean swap at the `BgRemovalService` seam.

---

*Project research synthesis for: RoomDrop — mobile-first, client-only in-room product visualization SPA*
*Synthesized: 2026-06-25*
