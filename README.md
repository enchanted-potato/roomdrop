# RoomDrop

Upload a photo of your room, then drop in cushions, furniture, and wall art from your own product images to see how they'd look — design your room before you buy a thing.

Everything runs in your browser. There is no backend, no account, and nothing to pay for.

## Features

- **Room photo upload** — take or pick a photo of your real room; it becomes the editing canvas.
- **Bring-your-own product images** — add photos of items you're considering buying to a personal library.
- **Automatic background removal** — product backgrounds are removed on-device with [@imgly/background-removal](https://github.com/imgly/background-removal-js), with a quality/speed setting for weaker phones.
- **Manual background removal** — if the automatic cutout misses, open the wand editor and tap the background colours to remove them yourself, with tolerance, undo, and reset controls.
- **Free placement** — drag, scale, and rotate items anywhere in the scene (Konva canvas).
- **Export** — save the finished scene as an image.
- **Installable PWA** — works offline after the first visit; mobile-first throughout.

## Architecture

Client-only by design:

- No server, no database, no server-side ML — all compute happens in the browser.
- Persistence is local: app state in `localStorage`, image blobs in IndexedDB.
- Static hosting only, sized to run indefinitely on a free tier.

## Tech stack

React 19 + TypeScript, Vite, Tailwind CSS, zustand for state, react-konva for the canvas, `@imgly/background-removal` for on-device ML cutouts, Vitest for tests.

## Development

Requires Node ≥ 20 and pnpm.

```sh
pnpm install    # install dependencies
pnpm dev        # start the Vite dev server
pnpm test       # run the Vitest suite
pnpm build      # production build (outputs to dist/)
pnpm preview    # serve the production build locally
```

A `justfile` wraps the same commands (`just dev`, `just test`, `just build`, …) plus `just typecheck`, `just lint`, and `just format`.
