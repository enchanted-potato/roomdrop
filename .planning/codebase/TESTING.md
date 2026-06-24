---
last_mapped_commit:
date: 2026-06-24
---

# Testing

## Status
**There are no tests** in this repository. No test framework, no test files, no CI configuration, no coverage tooling.

## What Exists
- Nothing in `poc/` is tested.
- No `test/`, `tests/`, `__tests__/`, `*.test.*`, or `*.spec.*` files.
- No `jest`, `vitest`, `playwright`, `cypress`, `mocha`, `karma`, or any test runner referenced.

## Manual Verification (today)
The prototype is verified by opening `poc/Cushion Stylist.dc.html` in a browser that provides `window.React` / `window.ReactDOM` (e.g. the Claude.ai artifact host).

## Notes for Planning
- Choose a testing stack alongside the production framework choice. Recommended early on:
  - **Unit:** Vitest or Jest depending on framework.
  - **Component / E2E:** Playwright is the most defensible default for an upload+drag UX.
  - **Visual regression** may be valuable later, given the heavy visual UX (room photos + cushion overlays).
- Background-removal correctness will not be unit-testable in the usual way — plan for golden-image fixtures rather than equality assertions.
