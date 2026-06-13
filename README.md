# Contraption Workshop

A browser recreation of the classic 1993 puzzle game *The Incredible Machine*: each
level hands you a half-finished Rube Goldberg machine and a bin of spare parts. Arrange
the parts, press **Run**, and watch deterministic 2D physics either solve the puzzle in
a gloriously convoluted way — or fail hilariously.

Built with TypeScript, [matter.js](https://brm.io/matter-js/), Vite, and an original
flat-vector art style. No copyrighted assets from the original game are used.

## Features

- **Puzzle mode** — 10 hand-authored levels with a difficulty curve, win detection,
  and persistent progress (localStorage).
- **Sandbox mode** — the full parts catalog, no goal, just build.
- **Level editor** — place parts, bolt them down, tag them, draw goal zones, configure
  the player's bin, then save/load levels (localStorage + JSON download/upload) and play them.
- **Deterministic physics** — fixed-timestep simulation; the same machine always does
  the same thing. Re-running an unchanged contraption yields the identical outcome.
- Parts: ramps, walls, three kinds of balls, buckets, conveyor belts, fans (with wind
  fields), balloons, trampolines, seesaws, ropes, pulleys, and pressure-plate buttons.

## Getting started

Prerequisites: **Node 20+** (see `.nvmrc`), npm.

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build at http://localhost:4173 |
| `npm test` | Vitest unit tests (determinism, win detection, part behaviors, level solvability) |
| `npm run test:e2e` | Playwright end-to-end tests (auto-builds + serves the app) |
| `npm run test:e2e:headed` | Same, with a visible browser for debugging |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run deploy` | Test-gated deploy to Firebase Hosting |

## Controls

- **Drag** parts from the bin onto the canvas; drag placed parts to move them.
- **Scroll wheel** or **[** / **]** rotate the selected part (15° steps).
- **Delete/Backspace** removes the selected part (back into the bin).
- **Space** runs/stops the machine, **R** resets it. **Esc** cancels/deselects.
- **Rope**: click the rope tile, then click two anchor points (◎) on placed parts.
  If the line passes near a pulley, the rope routes over it automatically.

## Testing

Two layers (PRD §13):

- **Unit (Vitest)** — physics determinism (identical world hashes after 600 steps),
  win-condition semantics, level schema validation round-trips, per-part behavior tests
  (balloon rises, conveyor carries, fan pushes, rope severs, trampoline caps), a
  `Math.random` guard over all simulation code, and a **solvability harness**: every
  shipped level is played through the real game controller with its documented solution
  and must win — and must *not* win with an empty bin.
- **E2E (Playwright)** — boot, drag-and-drop placement, bin counts, auto-solving level 1
  to the Win modal, reset semantics, sandbox mode, editor round-trip, progress persistence.
  The app exposes test hooks on `window.__GAME__` only when loaded with `?test=1`.

## Deploying (Firebase Hosting)

One-time setup:

```bash
npm i -g firebase-tools
firebase login
```

Then:

```bash
npm run deploy                      # uses the project in .firebaserc
PROJECT_ID=my-project npm run deploy  # or override
```

The script runs the full test suite, builds, and deploys `dist/` to Firebase Hosting
(global CDN, SSL, atomic deploys). The site goes live at
`https://<PROJECT_ID>.web.app`. Config: `firebase.json` (SPA rewrite + cache headers),
`.firebaserc` (default project).

## Project structure

```
src/
├── engine/     simulation (fixed-step matter.js wrapper), win/settle detection
├── parts/      one definition file per part + registry (physics, behavior, art)
├── render/     canvas renderer with interpolation, goal-zone markers
├── ui/         toolbox, HUD, modals, pointer input, audio, confetti, level select
├── modes/      game controller state machine, sandbox, level editor
├── levels/     level JSON data + loader/validator
├── store/      event emitter, progress + editor persistence
└── util/       math helpers, seeded PRNG, hashing
tests/
├── unit/       Vitest suites + per-level solutions for the solvability harness
└── e2e/        Playwright specs
```

See `PARTS.md` for part physics constants and `LEVELS.md` for level solutions (spoilers!).

## Future work

- Stretch parts: gears, candles + flames, magnifying glass, scissors, mouse & cat…
- Community level sharing backend; preview channels per branch; custom domain.
- Mobile-portrait layout (currently desktop/tablet).
