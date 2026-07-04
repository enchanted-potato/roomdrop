---
last_mapped_commit:
date: 2026-06-24
---

# Structure

## Top Level
```
roomdrop/
├── README.md                       # one-paragraph product pitch
├── poc/                            # Claude.ai dc-artifact prototype
│   ├── Cushion Stylist.dc.html     # editable prototype (uses ./support.js)
│   ├── Cushion Stylist (shareable).html  # self-contained share build (245 KB)
│   ├── support.js                  # generated dc-runtime bundle (1583 lines)
│   └── uploads/                    # sample input images for the prototype
│       ├── Screenshot 2026-06-23 at 17.37.22.png
│       └── pasted-1782232184295-0.png
└── .planning/                      # GSD planning artifacts (this folder)
```

## Key Locations
- **Prototype source of truth:** `poc/Cushion Stylist.dc.html` — what to study for UX intent.
- **Runtime (do not edit):** `poc/support.js` — header warns it is generated from a sibling `dc-runtime` repo.
- **Sample assets:** `poc/uploads/` — example room photos used while demoing the prototype.

## Naming Conventions Observed
- HTML files use Title-Case with spaces (`Cushion Stylist.dc.html`). Likely an artifact of Claude.ai export; the production app should adopt kebab-case or framework conventions.
- The `.dc.html` suffix marks files consumed by `support.js`'s `parseDcDocument`.

## What Is NOT Here
- No `src/`, `app/`, `pages/`, `components/`, `lib/`, `server/`, or `api/` directories.
- No tests, CI config, or scripts.
- No application configuration.

## Notes for Planning
- The production directory layout is unconstrained — `poc/` should remain a reference artifact and the real app should live alongside it (e.g. `apps/web/`, `packages/*`) once the stack is chosen.
