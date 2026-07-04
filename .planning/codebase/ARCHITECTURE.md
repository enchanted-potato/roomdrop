---
last_mapped_commit:
date: 2026-06-24
---

# Architecture

## Status
There is no application architecture yet — only a single-page interactive **prototype** authored as a Claude.ai "dc" artifact. This document captures the prototype's shape so planning can deliberately decide what to preserve versus rebuild.

## Pattern
- **Client-only, declarative-template prototype.** The `.dc.html` files declare a `<x-dc>` root, custom control-flow tags (`<sc-if>`, `<sc-for>`), and `{{ … }}` interpolations. At load time, `poc/support.js` parses the document, compiles the template into React elements, and mounts it against `window.React` / `window.ReactDOM`.
- No client/server split. All state (uploaded room photo, cushion library, placed cushions) lives in the React component tree.

## Layers
| Layer | Where |
|---|---|
| Template / view | `poc/Cushion Stylist.dc.html` (header, stage, library aside, dropzone) |
| Component runtime | `poc/support.js` — DOM parsing, attribute compilation, hooks, hydration |
| Standalone export | `poc/Cushion Stylist (shareable).html` — same UX bundled for sharing |

## Data Flow
1. User uploads a room photo via `<input type="file" onChange="{{ onRoomFile }}">`.
2. Room image is shown in the stage; cushion thumbnails (also user-uploaded or seeded) appear in the right-hand library.
3. Drag-and-drop places cushions onto the room, stored in a `placed` array driving an `<sc-for list="{{ placed }}">` overlay.
4. `Clear sofa` / `New room` reset relevant state.

All data lives in memory; nothing is persisted across reloads.

## Entry Points
- `poc/Cushion Stylist.dc.html` — primary editable prototype (loads `./support.js`).
- `poc/Cushion Stylist (shareable).html` — self-contained share build (single file, 245 KB).

## Key Abstractions (in `poc/support.js`)
- `parseDcDocument` / `parseDcText` — extract `<x-dc>` template + props from raw HTML.
- Template compiler — converts custom tags (`sc-if`, `sc-for`, `x-import`, etc.) and `{{ expr }}` holes into React `createElement` calls.
- Reactive resolver — `resolve(vals, expr)` walks dotted-path expressions against the props/state context.
- Style helpers — `sc-shine` keyframes and pseudo-class machinery via `host.pseudoClass(...)`.

## Notes for Planning
- The prototype's UX (upload → drag → place → clear/reset) is the spec; the runtime mechanism (dc-runtime) is **not** a production architecture choice.
- Background removal — promised by the README — is unimplemented and needs its own architectural decision (in-browser model vs. server API).
- Persistence, accounts, sharing, and a real product catalog are all absent and need architecture from scratch.
