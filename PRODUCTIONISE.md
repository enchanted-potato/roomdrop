# Productionising RoomDrop

The app is feature-complete locally (branch `feat/complete-app`): upload → library → editor → export, in-browser background removal, onboarding, and a PWA build. This is what remains to take it live and keep it healthy.

## 1. Pre-flight (local)

- [ ] Merge `feat/complete-app` into `main` (all checks green: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`).
- [ ] Set the real repository URL in `src/app/config.ts` (`REPO_URL`) — the footer "Open source" link is an AGPL obligation, it must point at the actual public repo.
- [ ] Push the repo publicly (AGPL-3.0 requires offering the source; the footer link is the mechanism).
- [ ] Manual device pass (items listed in each `.planning/phases/*/VERIFICATION.md`):
  - iPhone-class device: pinch scale/rotate, transformer handles, share sheet saves to Photos, page doesn't scroll under the stage.
  - WASM-only device: Fast mode inference completes; Quality shows the "slow" hint.
  - Throttled network: model download shows determinate progress + size toast; cancel works.
  - Two tabs → second-tab banner; reload → room/library/placements persist.

## 2. Deploy to DanubeData (free tier)

1. Create the static site in the DanubeData dashboard (https://danubedata.ro/solutions/static-sites). Free tier: 100 MB storage, 10 GB/mo bandwidth, 2 sites/domains, auto Let's Encrypt.
2. Connect the Git repo for auto-deploy (or ZIP/CLI push of `dist/`):
   - Build command: `pnpm install && pnpm build`
   - Output directory: `dist`
   - Node: >= 20 (see `package.json` engines)
   - Optional: set `BUILD_ID` env to the commit SHA if the build environment lacks git; otherwise the config falls back to `git rev-parse --short HEAD`.
3. SPA config: no rewrites needed (single route). Confirm 404s fall back to `index.html` only if deep links are ever added.
4. Verify response headers after first deploy:
   - `index.html` and `sw.js`: `Cache-Control: no-cache` (or similarly short) — a long-cached `sw.js` strands users on old builds (Pitfall M14).
   - Hashed `assets/*`: long-lived immutable caching (DanubeData default: 1 year).
5. Smoke-test the live URL:
   - Footer shows the build SHA.
   - DevTools → Network: ONNX model + WASM load from `staticimgly.com`, **not** from your domain (this keeps the 10 GB/mo cap safe).
   - Second visit: model served from the `imgly-model` SW cache.
   - Deploy a trivial change → "New version available" toast appears; Refresh loads the new build ID.
   - Emergency SW bypass works: `https://<domain>/?nosw=1`.

## 3. Domain & TLS

- [ ] Either use the provided `*.danubedata` subdomain or attach a custom domain (free tier allows 2): add the CNAME/A records they specify; Let's Encrypt is automatic.
- [ ] If a custom domain is added later, redeploy is not required (no absolute URLs in the bundle — `base: './'`).

## 4. Monitoring & operations

- [ ] Watch the DanubeData bandwidth dashboard monthly. Budget math: ~2 MB/first visit (shell + fonts are external) → the 10 GB cap is ~5,000 visits/mo. The 24 MB local ONNX fallback assets in `dist/` are only fetched if imgly's CDN override ever fails — if bandwidth spikes, check for requests to `/assets/ort-*` first.
- [ ] Escape hatch: if bandwidth is exhausted or the host misbehaves, the bundle is host-agnostic — redeploy `dist/` to Cloudflare Pages (unlimited free bandwidth) in minutes.
- [ ] Uptime: point a free checker (e.g. UptimeRobot) at the live URL.
- [ ] Errors: there is deliberately no analytics/telemetry (privacy promise in the honesty notice). If error reporting is ever added, it triggers real ePrivacy consent requirements (Pitfall M13) — use a proper consent library, and update the notice + a `/privacy` page.

## 5. Legal / licensing hygiene

- [ ] `LICENSE` (AGPL-3.0) stays at repo root; keep the footer link working — this satisfies the AGPL network clause for `@imgly/background-removal`.
- [ ] If the app is ever commercialised or closed-sourced: swap to an MIT-friendly pipeline (`@huggingface/transformers` + RMBG) **before** doing so, or buy IMG.LY's commercial license. The seam is clean: "image blob in → alpha PNG out" in `src/features/bg-removal/bgRemovalService.ts`.

## 6. Nice-to-haves before wide sharing (v2 candidates)

- Export/Import library ZIP backup — the real mitigation for iOS Safari's 7-day IndexedDB eviction (`PER2-01`).
- Trim the unused ort fallback assets from `dist/` (saves ~28 MB of the 100 MB storage cap) via a post-build prune script, after confirming in production that all ONNX artifacts come from the CDN.
- Playwright touch-emulation E2E for the drag/pinch flow (unit tests cover stores/services; gestures are only human-verified today).
- Real-device latency benchmarks for Fast/Quality to tune the default (STACK.md estimates are unmeasured).
- Multi-room UI (`EDT2-01`) — the schema already supports it.

## Known limitations (accepted for v1)

- BG-removal cancel can't abort in-flight inference (imgly v1.7 API); the result is discarded safely.
- Hidden-but-referenced library items are never garbage-collected retroactively (micro-leak, metadata + blobs).
- iOS Safari may evict IndexedDB after 7 days of no Safari use; the PWA install path and the notice mitigate, ZIP backup fixes it properly.
- Single-PoP hosting (Falkenstein) — fine for EU/UK audience; move to Cloudflare Pages if non-EU traffic matters.
