---
last_mapped_commit:
date: 2026-06-24
---

# Integrations

## Status
No backend, no external APIs, no auth, no database. The prototype is fully client-side.

## External Services
| Service | Purpose | Location | Notes |
|---|---|---|---|
| Google Fonts | Marcellus + Mulish web fonts | `poc/Cushion Stylist.dc.html:22-24` | CDN `<link>` only |

## Things You Might Expect, But Aren't Here Yet
The README states: *"Backgrounds are removed automatically so everything sits naturally in the space."* That implies a background-removal step that **does not yet exist** anywhere in this repo. Likely candidates for the production build:
- A background-removal API (e.g. remove.bg, Photoroom, Replicate `birefnet`/`u2net`, or a self-hosted ONNX model in-browser).
- Object storage / CDN for user-uploaded room photos and product cutouts.
- A product/catalog source for "cushions, furniture, wall art" once it goes beyond user-uploaded images.

None of the above are wired up — flag as new work, not pre-existing integrations.

## Webhooks / Inbound
None.

## Auth
None.

## Secrets
No `.env`, no inline keys, no token references in `poc/`. Repo is clean from a secret-leak standpoint.
