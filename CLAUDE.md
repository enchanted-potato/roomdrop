<!-- GSD:project-start source:PROJECT.md -->
## Project

**RoomDrop**

A mobile-first web app where you upload a photo of your room, then drop in cushions, furniture, and wall art from your own product images to see how they'd look. Backgrounds are removed automatically so items sit naturally in the scene. Aimed at friends, family, and as a portfolio piece — not a commercial product.

**Core Value:** You can take a photo of your real room and convincingly preview how a product you're considering buying would look in it — without leaving the browser and without it costing anything to run.

### Constraints

- **Budget**: Must run on the DanubeData free tier (100 MB storage, 10 GB/mo bandwidth) indefinitely — no monthly bill for hosting, storage, or inference. Vercel Hobby was rejected because its ToS forbids commercial use and we may monetize later.
- **Architecture**: Client-only. No backend, no database, no server-side ML. All compute happens in the user's browser.
- **Persistence**: `localStorage` only. No accounts, no cloud, no cross-device sync.
- **Device target**: Mobile-first responsive. Must work on a mid-range phone — including the background-removal step.
- **Catalog**: Bring-your-own product images. No product database, no scraping, no affiliate plumbing in v1.
- **Background removal**: Must run fully client-side, with a user-selectable quality/speed tradeoff to accommodate weaker devices.
- **Reference UX**: The prototype's upload → drag → place → reset flow is the spec for cushions. Furniture and wall art extend the same model (free move/scale/rotate, no surface snapping).
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Status
## Languages & Runtime
- **HTML + inline JS** — the prototype is shipped as standalone `.html` files opened directly in a browser.
- **JavaScript (browser, no bundler)** — `poc/support.js` is a pre-built ES2015+ IIFE; no module system on the consumer side.
- **No Node.js project** — no `package.json`, `tsconfig.json`, lockfile, or `node_modules`.
## Frameworks
- **React (via CDN-style globals)** — `support.js` looks up `window.React` / `window.ReactDOM` and bails if absent. React itself is not vendored in this repo; it is supplied by the Claude.ai artifact host that renders these files.
- **dc-runtime** — `poc/support.js` is a generated bundle from an external `dc-runtime/src/*.ts` project (see header comment: `GENERATED from dc-runtime/src/*.ts — do not edit. Rebuild with cd dc-runtime && bun run build`). It parses custom `<x-dc>` / `<sc-if>` / `<sc-for>` tags into React elements.
- **Google Fonts** — `Marcellus` + `Mulish` loaded via `<link>` from `fonts.googleapis.com` (see `poc/Cushion Stylist.dc.html:22-24`).
## Dependencies
- None declared in this repo.
- Implicit runtime deps: `window.React`, `window.ReactDOM`, and the dc-runtime helpers in `poc/support.js`.
## Configuration
- No config files (`.env`, `tsconfig`, `vite.config`, `next.config`, etc.).
- `.git/` is initialized; `README.md` is one paragraph.
## Build & Tooling
- No build step in this repo.
- `poc/support.js:1` documents that it is rebuilt elsewhere with `bun run build` in a sibling `dc-runtime` project.
## Notes for Planning
- Stack choices for the real product are **wide open** — nothing here constrains framework, language, or runtime selection.
- The POC demonstrates intended UX, not the production tech stack.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Status
## Patterns Visible in `poc/`
- **Inline styles, no CSS framework.** Every element in `poc/Cushion Stylist.dc.html` uses `style="..."` attributes — Tailwind, CSS Modules, or stylesheets are not used.
- **Custom-tag templating.** `<sc-if value="{{ … }}">`, `<sc-for list="{{ … }}" as="c">`, `<x-import>`, and `{{ expr }}` interpolations are dc-runtime conventions, not standard HTML/JSX. They are prototype-only and should not be carried into the production app.
- **Event handlers as expressions.** `onClick="{{ clearPlaced }}"` references identifiers resolved by `support.js` at runtime.
- **JS runtime is opaque.** `poc/support.js` is generated code with minified-style names (`__defProp`, `__publicField`, etc.) and is not meant to be read or modified directly.
## Error Handling
- `support.js` throws explicit errors when host globals are missing: `throw new Error("dc-runtime: window.React is not available yet")` (`poc/support.js:11`). That is the only error-handling pattern observed.
## Linting / Formatting
- No `.editorconfig`, `eslint`, `prettier`, or formatter config in the repo.
## Commit / Branch Conventions
- Single commit so far: `ee39313 Initial commit`. No established style yet.
## Notes for Planning
- Pick conventions deliberately during the stack/setup phase: linting, formatter, commit-message style, and a real styling solution (CSS-in-JS, Tailwind, or stylesheets) — none of these are pre-decided.
- Do **not** treat anything in `poc/support.js` as a pattern to follow.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Status
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
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
