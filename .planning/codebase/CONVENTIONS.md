---
last_mapped_commit:
date: 2026-06-24
---

# Conventions

## Status
No production code yet, so there are no real conventions to honor. The only patterns visible are inside the prototype.

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
