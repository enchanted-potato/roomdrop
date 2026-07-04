---
phase: 01
slug: foundations-image-pipeline
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-25
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` "## Validation Architecture" — planner fills the Per-Task Verification Map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom env) + @testing-library/react |
| **Config file** | `vite.config.ts` (test block) — installed in Wave 0 |
| **Quick run command** | `pnpm vitest run --reporter=dot` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~10 seconds (unit + jsdom only; no browser harness in Phase 1) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=dot`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite green + manual mobile-shell smoke (iPhone SE viewport)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

*Planner populates this table with one row per task in the generated PLAN.md files. Each task must have an automated command OR a Wave 0 dependency.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to fill_ | _to fill_ | _to fill_ | _to fill_ | — | _to fill_ | _to fill_ | _to fill_ | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` installed
- [ ] `vite.config.ts` updated with `test` block (env=jsdom, setupFiles, css=false)
- [ ] `src/test/setup.ts` — extends expect with jest-dom matchers, global `afterEach(cleanup)`
- [ ] `src/test/fixtures/` — small JPEG with EXIF orientation tag (orientation=6), tiny HEIC sample, sample PNG. Used by image-pipeline tests.
- [ ] `src/test/idb-mock.ts` — `fake-indexeddb` registered so idb-keyval tests can run in jsdom.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile-first shell renders correctly with safe-area handling on iPhone SE | FND-04 | Safe-area inset behavior is device-specific; no headless harness in Phase 1 | Open DevTools → device emulation → iPhone SE (375×667). Confirm header + footer respect `env(safe-area-inset-*)`. No horizontal scroll. |
| Camera capture launches native picker on iOS Safari | UPL-01 | `<input capture="environment">` behavior is real-device only | Open dev URL on a real iPhone; tap upload; confirm camera launches (not photo library). |
| Reload shows active room photo at first paint without flicker | PER-03 | Visual perception of first-paint flicker requires human observation | Upload photo → hard reload → observe no white flash before image appears. |
| Replaced photo is correctly EXIF-oriented at ≤2048 px long edge | PER-02 | Visual orientation correctness is a perceptual check | Upload a portrait phone photo with EXIF orientation=6. Confirm it renders upright. Inspect Blob in DevTools → IndexedDB → confirm `width<=2048 && height<=2048`. |
| HEIC file shows friendly error (not broken icon) | UPL-03 | Magic-byte sniff path needs real HEIC; not all CI runners can read HEIC fixtures | Upload an `.heic` from an iPhone via desktop file picker; expect inline error banner with copy from CONTEXT.md D-02. |
| "Open source" footer link opens repo URL | FND-03 | AGPL compliance is visual + click-through | Confirm footer link exists, target is repo URL, opens in new tab. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`--watch` forbidden in automated commands)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
