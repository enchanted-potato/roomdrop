# Summary 04-01: In-Browser Background Removal

**Completed:** 2026-07-04

## What shipped
- `bgRemovalService`: sequential job queue over `@imgly/background-removal` 1.7.0 (dynamic import — ONNX glue stays out of the main bundle). Fast=`isnet_quint8`, Quality=`isnet_fp16`; device gpu/cpu by real `requestAdapter()` probe (M6). Model always from imgly CDN (C7/BGR-07 seam).
- Cancel (BGR-04): aborts model download via `fetchArgs.signal`; in-flight compute results are discarded; status returns to `none`. No AbortSignal exists for inference itself in v1.7.0 — documented limitation.
- Progress (BGR-03): determinate download % on the thumb badge; one-time honest size toast ("First-time setup… ~44/80 MB") triggered only when a real download starts (M4).
- Failure (BGR-05): `bgStatus: failed` + reason; original stays placeable via the seam; toast names cause → next step. Re-run (BGR-06) from thumb; new cutout replaces old blob.
- `settingsStore` (separate `roomdrop-settings` key): Fast/Quality with probe default (BGR-02); gear popover in header.
- Auto-enqueue on every library upload (BGR-01). `LibraryThumb`: badge states Original/Downloading %/Removing…/Cutout/Failed; delete button swaps to cancel while processing; re-run button on done/failed.

## Deviations
- protobufjs (transitive) build script explicitly disallowed in pnpm-workspace.yaml (postinstall unneeded).
- Cancellation of the compute stage is best-effort discard, not worker termination — imgly v1.7.0 API limit; memory is reclaimed when the worker settles.

## Verification
`pnpm typecheck` / `lint` / `test` (32) / `build` green. Real-device latency benchmarks pending (human).
