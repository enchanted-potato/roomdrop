---
last_mapped_commit:
date: 2026-06-24
---

# Stack

## Status
The repository currently contains **only a Claude.ai "dc" artifact prototype** under `poc/` — there is no production application, build tooling, or package manifest yet. Treat the project as effectively greenfield.

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
