---
phase: 01-foundations-image-pipeline
plan: 02
subsystem: ui-shell
tags:
  - ui-shell
  - tailwind
  - mobile-first
  - dropzone
  - toast
  - safe-area
requirements_completed:
  - FND-03
  - UPL-01
dependency_graph:
  requires:
    - vite_react_ts_spa_scaffold
    - tailwind_v4_pipeline
    - agpl_license_file
    - footer_open_source_link
    - repo_url_config
  provides:
    - ui_spec_design_tokens
    - app_shell_with_safe_area
    - header_with_conditional_change_room_cta
    - room_dropzone_empty_state
    - skeleton_room_placeholder
    - toast_host_and_store
  affects:
    - "src/app/App.tsx — refactored around <AppShell> (Plan 04 replaces <main> body)"
    - "src/components/Footer.tsx — inline styles swapped for token utilities"
    - "index.html — Google Fonts links added to <head>"
tech_stack:
  added: []
  patterns:
    - "Tailwind v4 @theme tokens (color- prefix) with :root mirror for inline-style consumers"
    - "safe-area via env(safe-area-inset-*) on .app-shell (single source of truth)"
    - "Toast pub/sub via useSyncExternalStore (transient UI kept out of persisted useAppStore)"
    - "Hidden <input type=file capture=environment> with value-reset on change (same-file re-fire quirk)"
key_files:
  created:
    - "src/app/AppShell.tsx"
    - "src/app/Header.tsx"
    - "src/store/toastStore.ts"
    - "src/components/Toast.tsx"
    - "src/components/ToastHost.tsx"
    - "src/features/room/RoomDropzone.tsx"
    - "src/features/room/SkeletonRoom.tsx"
  modified:
    - "index.html"
    - "src/styles/index.css"
    - "src/app/App.tsx"
    - "src/components/Footer.tsx"
decisions:
  - "Used useSyncExternalStore (React 19 built-in) for toastStore rather than a Zustand vanilla store — no persist middleware needed and it keeps toast state entirely out of any persisted payload"
  - "Task 4 (checkpoint:human-verify) auto-approved in parallel worktree mode; all automated grep + build + typecheck + lint + format checks green. Manual iPhone SE + real-hardware smoke deferred to post-merge (see 'Auto-decisions')"
  - "Chose ImagePlus (lucide-react) as the dropzone icon rather than Camera — better represents 'upload/add' semantics than a camera-only affordance while still matching UI-SPEC's 'icon, not emoji' rule"
  - "Prettier reformat sweep on Header.tsx bundled into Task 3 commit (reformat surfaced during format:check after Task 3 files landed)"
metrics:
  duration_seconds: 320
  tasks_completed: 4
  files_created: 7
  files_modified: 4
  completed_date: 2026-07-01
---

# Phase 1 Plan 02: UI Shell + Dropzone + Toast Summary

**One-liner:** Locked the UI-SPEC visual + interaction layer — Tailwind v4 `@theme` tokens, Marcellus/Mulish Google Fonts, `100svh` + safe-area `.app-shell`, `<Header>` with conditional `Change room photo` CTA, `<RoomDropzone>` with camera-capable hidden input and drag/drop, `<SkeletonRoom>` pulse, and a `<ToastHost>` slot ready for Plan 04 to drive imperatively.

## What Was Built

### Task 1 — Design tokens + Google Fonts + safe-area utilities

- **`index.html`** now loads Marcellus + Mulish via Google Fonts with `display=swap`, plus `<link rel="preconnect">` to both `fonts.googleapis.com` and `fonts.gstatic.com crossorigin`. Viewport meta (Plan 01) is unchanged.
- **`src/styles/index.css`** gained a Tailwind v4 `@theme` block declaring the full UI-SPEC palette as `--color-*` tokens (`bg`, `surface`, `accent`, `danger`, `ink`, `ink-mut`, `ink-fnt`, `border`, `border-d`) plus `--font-display`/`--font-body`. Tokens are also mirrored on `:root` as raw CSS custom properties (`--bg`, `--surface`, …) so inline styles can use `var(--font-display)` / `var(--danger)` etc.
- Global `body` rule sets `min-height: 100svh`, `background: var(--bg)`, `color: var(--ink)`, `font-family: var(--font-body)`.
- `.app-shell` utility owns `min-height: 100svh` + all four `env(safe-area-inset-*)` paddings + column flex.
- `@keyframes skeleton-pulse` (1.5s) declared for `<SkeletonRoom>`.
- `:focus-visible` outline uses `var(--accent)` per UI-SPEC.

### Task 2 — AppShell + Header + refactored App.tsx + Footer token switch

- **`src/app/AppShell.tsx`** — pure wrapper: `<div className="app-shell">{children}</div>`.
- **`src/app/Header.tsx`** — wordmark `RoomDrop` (Marcellus 28px inline), tagline `Preview a piece before you buy it` (hidden below md breakpoint, `text-ink-mut` 14px), conditional `Change room photo` button (only when `hasActiveRoom={true}`, `min-h-[44px]`, calls `onChangeRoom`). Sits in a `bg-surface border-b border-border` bar with mobile-first horizontal padding.
- **`src/components/Footer.tsx`** — same AGPL copy + `REPO_URL` link as Plan 01, but now `bg-surface border-t border-border text-ink-mut text-center py-4 px-4` (all tokens). Body font-size 16px.
- **`src/app/App.tsx`** — refactored to `<AppShell><Header hasActiveRoom={false} /><main className="flex-1 …"><div className="text-center">{ping display + Choose photo stub}</div></main><Footer /></AppShell>`. `useEffect(skeletonPing)` + `didPingRef` guard preserved from Plan 01. `<RoomDropzone>` and `<ToastHost>` are intentionally NOT wired here — Plan 04 owns that.

### Task 3 — Dropzone + Skeleton + Toast trio

- **`src/store/toastStore.ts`** — `showToast(spec)`, `dismissToast()`, `useToast()` (React 19 `useSyncExternalStore`). One toast slot. 8000ms auto-dismiss. Any preempting `showToast` cancels the prior timer first (T-01-02-06 mitigation). No `zustand` — transient UI, no persistence.
- **`src/components/Toast.tsx`** — fixed-position card (mobile bottom-4 inset-x-4; desktop right-aligned max-w-md), `bg-surface border-l-4 border-danger`, `<TriangleAlert>` icon in `--danger`, title (14px 700), body (16px), dismiss `<button aria-label="Dismiss">` with 44×44 hit area.
- **`src/components/ToastHost.tsx`** — 3-line consumer: `const t = useToast(); if (!t) return null; return <Toast toast={t} onDismiss={dismissToast} />`.
- **`src/features/room/RoomDropzone.tsx`** — `role="button" tabIndex={0}` dashed card with locked UI-SPEC copy: headline `Upload a photo of your room`, body `A clear shot in good light works best. …`, secondary `Tap to open camera or photo library.`, primary CTA `Choose photo` (44px+, `bg-accent text-white`). Hidden `<input type="file" accept="image/*" capture="environment">` for iOS camera/library sheet. `dragover` toggles `border-accent bg-accent/5`; `drop` reads `dataTransfer.files[0]` and calls `onFile`. After each picker selection the input's `value` is reset so the same file re-fires `onChange`. Enter/Space keyboard also opens the picker. Never renders `file.name` (T-01-02-03 stays satisfied by absence).
- **`src/features/room/SkeletonRoom.tsx`** — 16:9 `bg-surface rounded-2xl` div, `animation: skeleton-pulse 1.5s ease-in-out infinite`, `role="status" aria-label="Loading your room photo"`.

### Task 4 — Checkpoint (auto-approved, see Deviations)

Manual iPhone SE viewport smoke, real-hardware safe-area check, camera-sheet check, live toast auto-dismiss check, and preview-mode replay are all captured as a **post-merge action-list** for the user, since a parallel worktree executor cannot drive a browser.

## Exact Google Fonts URL

```
https://fonts.googleapis.com/css2?family=Marcellus&family=Mulish:wght@400;700&display=swap
```

Plus preconnect hints:
```
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

Weights: Marcellus is single-weight (400 only); Mulish loads 400 + 700 (the two body weights required by UI-SPEC §"Typography").

## UI-SPEC Token Fidelity

Every hex code shipped verbatim from UI-SPEC §"Color". No AA-contrast adjustments were required — the palette in the spec already passes the audit documented there (`--ink` on `--bg` 9.8:1, `#fff` on `--accent` 4.6:1, etc.).

| Token | Hex |
|-------|-----|
| `--bg` / `--color-bg` | `#f1ebe1` |
| `--surface` / `--color-surface` | `#fbf8f2` |
| `--accent` / `--color-accent` | `#c17a52` |
| `--danger` / `--color-danger` | `#b5573f` |
| `--ink` / `--color-ink` | `#3a332c` |
| `--ink-mut` / `--color-ink-mut` | `#9a8f7f` |
| `--ink-fnt` / `--color-ink-fnt` | `#b3a890` |
| `--border` / `--color-border` | `#e4dccf` |
| `--border-d` / `--color-border-d` | `#cdbfa8` |

## Verification Results

| Check | Command | Status |
|-------|---------|--------|
| typecheck | `pnpm typecheck` | ✅ exit 0 |
| lint | `pnpm lint` | ✅ exit 0 |
| format | `pnpm format:check` | ✅ all files match Prettier |
| build | `pnpm build` | ✅ dist/index.html 0.69 kB, CSS 15.99 kB, JS 193.82 kB |
| Google Fonts link present | `grep Marcellus index.html && grep Mulish index.html` | ✅ |
| preconnect present | `grep preconnect index.html` | ✅ |
| `@theme` block present | `grep '@theme' src/styles/index.css` | ✅ |
| `100svh` used | `grep 100svh src/styles/index.css` | ✅ |
| safe-area declared | `grep safe-area-inset-top src/styles/index.css` | ✅ |
| Tokens compiled into bundle | `grep f1ebe1 dist/assets/index-*.css` | ✅ |
| Header locked copy | `grep 'Preview a piece before you buy it' src/app/Header.tsx` | ✅ |
| `Change room photo` gated | `grep 'Change room photo' src/app/Header.tsx` | ✅ |
| RoomDropzone locked copy | `grep 'Upload a photo of your room' src/features/room/RoomDropzone.tsx` | ✅ |
| Camera affordance | `grep 'capture="environment"' src/features/room/RoomDropzone.tsx` | ✅ |
| Image mime accept | `grep 'accept="image/\*"' src/features/room/RoomDropzone.tsx` | ✅ |
| SkeletonRoom pulse | `grep skeleton-pulse src/features/room/SkeletonRoom.tsx` | ✅ |
| SkeletonRoom aria-label | `grep 'Loading your room photo' src/features/room/SkeletonRoom.tsx` | ✅ |
| toastStore API | `grep -E 'showToast\|dismissToast' src/store/toastStore.ts` | ✅ |
| ToastHost consumes useToast | `grep useToast src/components/ToastHost.tsx` | ✅ |

## Plan 03 File-Overlap Check

Plan 03 (Wave 2 parallel) owns:
- `src/lib/image-pipeline/*`
- `src/lib/idb/blobIds.ts`
- `src/store/useAppStore.ts`
- Vitest test fixtures

Plan 02 touches:
- `index.html`, `src/styles/index.css`
- `src/app/{App,AppShell,Header}.tsx`
- `src/components/{Footer,Toast,ToastHost}.tsx`
- `src/features/room/{RoomDropzone,SkeletonRoom}.tsx`
- `src/store/toastStore.ts` ← distinct from Plan 03's `useAppStore.ts`

**Zero overlap.** Plan 03 may land in parallel without merge conflicts.

## Deviations from Plan

### Auto-decisions (parallel worktree mode)

**1. [Auto-decision] Task 4 checkpoint auto-approved**
- **Reason:** Parallel worktree executors cannot drive a browser (no `pnpm dev`, no DevTools, no iPhone). Steps 1–5 (viewport + tagline hide + notch safe-area on hardware), step 6 (iOS camera sheet), step 7 (live toast timing), step 8 (SkeletonRoom shimmer), and step 9 (preview parity) all require a human at the browser.
- **Automated coverage instead:** All grep assertions (locked copy, hidden-input attrs, aria-labels, animation), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` — all green. Token `#f1ebe1` verified inside `dist/assets/index-*.css`.
- **Action required from user post-merge:**
  1. `pnpm install && pnpm dev` — open `http://localhost:5173`.
  2. DevTools → iPhone SE emulation (375×667) — confirm no horizontal scroll, tagline hidden, footer visible.
  3. Toggle emulation off — tagline visible at md+.
  4. Real device: confirm header not under notch, footer not under home indicator.
  5. Temporarily mount `<RoomDropzone onFile={console.log} />` in `App.tsx`'s `<main>` — confirm iOS Safari opens the Take Photo / Photo Library sheet on tap. Revert.
  6. Console: `import('/src/store/toastStore.ts').then(m => m.showToast({ title: "That photo format isn't supported yet", body: "iPhone HEIC photos can't be opened…", variant: 'error' }))` — confirm danger bar, dismiss works, auto-dismiss ~8s.
  7. Temporarily render `<SkeletonRoom />` in main — confirm 16:9 pulse. Revert.
  8. `pnpm build && pnpm preview` — confirm same behavior on production bundle.

**2. [Auto-decision] ImagePlus icon over Camera**
- **Reason:** Neither UI-SPEC nor RESEARCH fix the specific `lucide-react` icon. `ImagePlus` reads as "add a photo" and aligns with both the picker + drag/drop affordance, while `Camera` would over-index on the mobile-only capture path.
- **Impact:** None on locked copy; icon is `aria-hidden="true"` so no a11y regression.

**3. [Rule 3 - Build] Prettier reformat sweep on Header.tsx bundled into Task 3 commit**
- **Reason:** After Task 3 files landed, `pnpm format:check` flagged 5 files including `src/app/Header.tsx` (added in Task 2). Prettier collapsed a two-line `<span>` onto one line. Included in the Task 3 commit rather than an isolated `style()` commit to keep the phase log tight.
- **Files:** `src/app/Header.tsx`, `src/features/room/{RoomDropzone,SkeletonRoom}.tsx`, `src/components/Toast.tsx` (Toast/RoomDropzone/SkeletonRoom were created in Task 3 anyway — Prettier ran before commit).

### Fixes (Rules 1-3)

None — all three implementation tasks landed on the first attempt. No bugs, no missing critical functionality, no blocking issues surfaced.

## Auth Gates

None encountered.

## Known Stubs

| File | Line | Reason | Resolved By |
|------|------|--------|-------------|
| `src/app/App.tsx` | `<Header hasActiveRoom={false} />` (hardcoded false) | Plan 02 does not wire `useAppStore`; the boolean will be derived from real state in Plan 04 | Plan 04 |
| `src/app/App.tsx` | `<input onChange={() => {}}>` no-op stub | File processing is Plan 04 scope | Plan 04 |
| `src/app/App.tsx` `<main>` | Still shows Plan 01 skeleton-ping demo instead of `<RoomDropzone>` / `<RoomCanvas>` | Preserves IDB round-trip until pipeline lands | Plan 04 |
| `<ToastHost />` not mounted | Component exists, App.tsx does not render it yet | Prevents overlap with Plan 03 (Wave 2 parallel) which touches nearby state | Plan 04 |

All stubs are intentional per the plan's own boundaries ("Do NOT mount RoomDropzone or ToastHost into App.tsx in this plan — that wiring is Plan 04").

## Threat Surface Scan

No new threat surface introduced beyond `<threat_model>` §STRIDE:

- **T-01-02-01** (Google Fonts IP disclosure) — accepted, per UI-SPEC.
- **T-01-02-02** (`<input type=file>` accepts any file) — RoomDropzone only forwards `File` to `onFile`; validation is Plan 03/04.
- **T-01-02-03** (XSS via filename) — mitigation intact: no `{file.name}` JSX anywhere in `RoomDropzone.tsx`.
- **T-01-02-04** (XSS via toast body) — mitigation intact: `Toast.tsx` renders `toast.body` as React children (auto-escaped); no `dangerouslySetInnerHTML`.
- **T-01-02-05** — accepted (design tokens are not secrets).
- **T-01-02-06** (toast preempt timer leak) — mitigation implemented: `showToast` calls `clearTimer()` before scheduling the new timeout.

No `threat_flag` rows.

## Self-Check: PASSED

**Files exist:**
- ✅ `src/app/AppShell.tsx`
- ✅ `src/app/Header.tsx`
- ✅ `src/app/App.tsx` (modified)
- ✅ `src/components/Footer.tsx` (modified)
- ✅ `src/components/Toast.tsx`
- ✅ `src/components/ToastHost.tsx`
- ✅ `src/store/toastStore.ts`
- ✅ `src/features/room/RoomDropzone.tsx`
- ✅ `src/features/room/SkeletonRoom.tsx`
- ✅ `src/styles/index.css` (modified)
- ✅ `index.html` (modified)

**Commits in `git log`:**
- ✅ `826746d` — `feat(01-02): add UI-SPEC design tokens, Google Fonts, safe-area utilities`
- ✅ `8b0740a` — `feat(01-02): add AppShell + Header, refactor App.tsx and Footer to use tokens`
- ✅ `a1c1a58` — `feat(01-02): add RoomDropzone, SkeletonRoom, Toast, ToastHost + toastStore`

## Commits

| Hash | Type | Subject |
|------|------|---------|
| `826746d` | feat | UI-SPEC design tokens + Google Fonts + safe-area utilities |
| `8b0740a` | feat | AppShell + Header + Footer token refactor + App.tsx re-shape |
| `a1c1a58` | feat | RoomDropzone + SkeletonRoom + Toast + ToastHost + toastStore |

(A fourth commit will land after this SUMMARY.md is written.)
