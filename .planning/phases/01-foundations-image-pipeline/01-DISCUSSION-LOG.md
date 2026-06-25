# Phase 1: Foundations & Image Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 01-foundations-image-pipeline
**Areas discussed:** Image pipeline libs, Store + IDB shape, Hydration sequence, Tooling & repo layout

---

## Image pipeline libs

### Q1: How should the ImagePipeline (EXIF orient + resize ≤2048px + format detection) be built?

| Option | Description | Selected |
|--------|-------------|----------|
| exifr + canvas, hand-rolled resize | Tiny exifr (~5KB orientation-only) + createImageBitmap + OffscreenCanvas + magic-byte HEIC sniff. ~10KB total. | ✓ |
| browser-image-compression (all-in-one) | Single library for resize + EXIF + worker offload; ~25-30KB; still need HEIC sniff. | |
| Native only — no deps | createImageBitmap `imageOrientation: 'from-image'`; smallest bundle; EXIF support browser-dependent. | |

**User's choice:** exifr + canvas, hand-rolled resize
**Notes:** Recommended option; aligns with mobile-first bundle discipline.

### Q2: How should HEIC be detected and rejected?

| Option | Description | Selected |
|--------|-------------|----------|
| Magic-byte sniff first 12 bytes | Read file head; check `ftypheic`/`ftypheix`/`ftyphevc`/`ftypmif1`. Reliable regardless of MIME/extension. | ✓ |
| MIME type + extension only | Simpler but iOS lies about both. | |
| Try-decode and catch failure | Generic error, no naming HEIC; less helpful copy. | |

**User's choice:** Magic-byte sniff first 12 bytes
**Notes:** Needed to deliver the specific HEIC toast copy locked in UI-SPEC.

---

## Store + IDB shape

### Q1: How should the Zustand store and IDB be partitioned?

| Option | Description | Selected |
|--------|-------------|----------|
| Single store, persist-middleware excludes blobs | One useAppStore; metadata persists; blob IDs reference idb-keyval keys. | ✓ |
| Sliced stores per domain | Separate stores per feature; more wiring for hydration. | |
| Zustand for transient + idb-keyval for everything persisted | Manual IDB reads/writes; no Zustand reactivity for persisted data. | |

**User's choice:** Single store, persist-middleware excludes blobs
**Notes:** Simple mental model; grows cleanly with Phases 2-4.

### Q2: How is the multi-room schema keyed in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| `rooms: Record<roomId, Room>` + `activeRoomId` | O(1) lookup; extends to multi-room UI in v2 with no migration. | ✓ |
| `rooms: Room[]` + `activeRoomId` | Matches requirement wording literally; array scans for find/update. | |

**User's choice:** `rooms: Record<roomId, Room>` + `activeRoomId`
**Notes:** Forward-compatible with EDT2-01 (v2 multi-room drawer) without schema migration.

---

## Hydration sequence

### Q1: First-paint hydration sequence on reload?

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton → IDB read → cross-fade `<img>` | Zustand rehydrates sync; SkeletonRoom paints immediately; async IDB blob; 150ms opacity cross-fade. | ✓ |
| Block first paint until IDB resolves | White stage 50-200ms; worse perceived perf on mobile. | |
| Persist a tiny base64 LQIP in localStorage | Best perceived perf; extra pipeline work + localStorage bloat. | |

**User's choice:** Skeleton → IDB read → cross-fade `<img>`
**Notes:** Matches the 150ms cross-fade already specified for "Change room photo" in UI-SPEC.

### Q2: What happens if the IDB read fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Clear stale metadata, show empty state + toast | Self-healing; honest copy: "We couldn't reload your last photo. Upload again to continue." | ✓ |
| Keep metadata, show error toast only | Leaves UI in broken-looking state. | |
| Silent fallback to empty state | User has no idea their previous photo is gone. | |

**User's choice:** Clear stale metadata, show empty state + toast
**Notes:** New toast copy line — planner should add it to the UI-SPEC toast catalog.

---

## Tooling & repo layout

### Q1: Package manager?

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm | Fast, disk-efficient, strict resolution. | ✓ |
| npm | Default; slower, looser hoisting. | |
| bun | Fastest; some Vite plugin rough edges. | |

**User's choice:** pnpm

### Q2: Folder structure under `src/`?

| Option | Description | Selected |
|--------|-------------|----------|
| Feature-sliced: `src/features/{room,library,editor}` + `src/lib` + `src/store` | Each feature owns its concerns; scales into Phases 2-4. | ✓ |
| Flat by type: `components/ hooks/ lib/ store/ types/` | Simpler at Phase 1; noisier by Phase 4. | |
| Domain folders mirroring schema | Maps to data model; less natural for React component locality. | |

**User's choice:** Feature-sliced

### Q3: Tests, lint, format — set up in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| ESLint + Prettier now; Vitest now with one ImagePipeline test | Lint/format from day one; one meaningful unit test. No Playwright. | ✓ |
| ESLint + Prettier only; defer Vitest | Add when editor logic justifies it. | |
| Defer all of it; ship Phase 1 minimal | Fight inconsistent formatting in Phase 2. | |

**User's choice:** ESLint + Prettier now; Vitest now with one ImagePipeline test

### Q4: Phase 1 deploy posture?

| Option | Description | Selected |
|--------|-------------|----------|
| Deploy-ready, no actual deploy | `dist/` is clean static; base path + SPA fallback configured; Phase 6 does the real deploy. | ✓ |
| Deploy a 'hello' build to DanubeData now | Smoke-test hosting early to de-risk Phase 6. | |

**User's choice:** Deploy-ready, no actual deploy
**Notes:** Honors the phase boundary; Phase 6 owns DanubeData + PWA.

---

## Claude's Discretion

- Exact TypeScript shapes for `Room`, `LibraryItem`, `Placement` (planner proposes; must be JSON-serializable for Zustand persist).
- `nanoid` vs `crypto.randomUUID()` for id generation.
- ESLint strictness beyond the recommended floor.
- Whether to add any Vite plugin beyond `@vitejs/plugin-react`.

## Deferred Ideas

- PWA + model caching → Phase 6 (BGR-07)
- Build-ID footer slot → Phase 6
- Library upload / Konva stage / Transformer → Phase 2
- Background removal worker + Fast/Quality toggle → Phase 4
- Destructive confirmation dialogs → Phase 3
- BroadcastChannel multi-tab guard → Phase 5 (PER-06)
- Sample room + onboarding tooltip + honesty notice → Phase 5
- PNG export + Web Share API → Phase 3
- Multi-room UI / room switcher drawer → v2 (EDT2-01)
- ZIP backup / restore → v2 (PER2-01)
