# Phase 5: Onboarding & Multi-Tab Safety - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Mode:** Auto-accepted (autonomous run, config mode: yolo)

<domain>
## Phase Boundary
First-run honesty notice, sample-room try-out, post-placement coachmark, and a BroadcastChannel second-tab banner. Covers FND-05, ONB-01..03, PER-06. (ONB-01's empty-state CTA shipped in Phase 1; this phase adds the notice + sample entry.)
</domain>

<decisions>
## Implementation Decisions

### Honesty notice (FND-05)
- One-time dismissible card above the dropzone (not a blocking modal, not a cookie banner): "Your photos stay on this device — nothing is sent to a server." Dismissal stored in a `roomdrop-notices` localStorage key (module store, not the core schema).

### Sample room (ONB-02)
- Assets are generated at dev time by `scripts/generate-samples.mjs` (sharp renders SVG scenes) and committed under `src/assets/samples/`: 1 room JPEG + 4 product PNGs with alpha (cushion, framed art, plant, side table). Imported via Vite `?url` so they're fingerprinted into the bundle (~tens of KB, no external fetches).
- "Try with a sample room" secondary action on the dropzone. Loads the room through the normal `uploadRoom` pipeline; sample library items use **fixed ids** (`sample-*`) with `cutoutBlobId = originalBlobId` and `bgStatus: 'done'` (pre-cutout — no model download needed to try the product). Fixed ids make the load idempotent and reset-safe.

### Coachmark (ONB-03)
- After the first-ever placement, a one-time dismissible tooltip over the stage: "Pinch to scale, twist to rotate. On a computer, drag the corner handles." Auto-dismisses after 8 s. Flag in `roomdrop-notices`.

### Second tab (PER-06)
- `BroadcastChannel('roomdrop-tabs')`: post `hello` on boot; any receiver replies `present`; receiving either message shows a persistent dismissible banner under the header: "RoomDrop is open in another tab. Close one to avoid losing changes." No write-locking (M11 scope: warn, don't merge).

### Claude's Discretion
Sample artwork styling; banner/notice visuals per UI-SPEC tokens.
</decisions>

<code_context>
## Existing Code Insights
- `uploadRoom` handles pipeline + eviction; reuse for the sample room.
- Notices flags follow the toastStore module pattern.
</code_context>

<specifics>
## Specific Ideas
None.
</specifics>

<deferred>
## Deferred Ideas
- Export/Import ZIP backup (PER2-01) remains the real answer to iOS 7-day eviction — v2.
</deferred>
