# Summary 05-01: Onboarding & Multi-Tab Safety

**Completed:** 2026-07-04

## What shipped
- **HonestyNotice** (FND-05/M13): one-time dismissible card above the dropzone — "Your photos stay on this device — nothing is sent to a server." Flags in a `roomdrop-notices` localStorage module store (survives "Reset everything" on purpose).
- **Sample room** (ONB-02): `scripts/generate-samples.mjs` renders committed SVG-based assets (`src/assets/samples/` — room.jpg + cushion/art/plant/table PNGs with alpha, ~140 KB total). `loadSampleRoom` pushes the room through the normal `uploadRoom` pipeline and adds 4 pre-cutout items with fixed `sample-*` ids (`cutoutBlobId = originalBlobId`, `bgStatus: 'done'`) — idempotent, zero uploads, zero model download.
- **Coachmark** (ONB-03): one-time tooltip after the first-ever placement ("Pinch to scale, twist to rotate…"), 8 s auto-dismiss, tap to dismiss.
- **Second-tab banner** (PER-06/M11): `BroadcastChannel('roomdrop-tabs')` hello/present handshake → persistent dismissible warning under the header. Warn-only; no merge attempt.

## Deviations
- Sample PNGs bypass ImagePipeline re-encoding (it would flatten alpha to JPEG); they're pre-normalized at generation time. Room JPEG still goes through the pipeline.

## Verification
`pnpm typecheck` / `lint` / `test` (33) / `build` green.
