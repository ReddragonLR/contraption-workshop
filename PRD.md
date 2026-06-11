# PRD & Build Prompt — "Contraption Workshop": A Browser Recreation of *The Incredible Machine*

> **How to use this document.** This file is a complete, self-contained prompt for Claude Code. Paste it (or point Claude Code at it) and instruct: *"Build the project described in PRD.md, end to end. Test locally with Playwright as you go, and when the milestones are green, deploy to Google Cloud."* The PRD doubles as the product specification and the agent's operating brief.

---

## 0. Instructions to the Building Agent (Claude Code)

You are building a browser-based recreation of the classic puzzle game *The Incredible Machine* (Sierra/Jeff Tunnell Productions, 1993). Work through the **Milestones** in §16 in order. After each milestone:

1. Run the unit tests (`npm test`) and the Playwright E2E tests (`npm run test:e2e`) and make them pass before moving on.
2. Show me a short summary of what was built and the test results.

Operating rules:
- **Build incrementally and keep the app runnable at every milestone.** Never leave the project in a broken state between milestones.
- **Prefer a small number of well-chosen dependencies** (see §4). Do not add heavy frameworks.
- **Determinism is a hard requirement** (see §6). No `Math.random()` anywhere in physics-affecting code.
- **Ask me before anything destructive or outward-facing**: the first cloud deploy, enabling paid GCP/Firebase features, or deleting files you did not create. Local file creation, installing npm deps, and running tests need no confirmation.
- For Firebase auth, if the Firebase CLI is not authenticated you cannot log in for me non-interactively — tell me to run `! firebase login` in the session and continue once it succeeds.
- When you need a value you don't have (GCP project ID, region), **ask me once**, then proceed.

---

## 1. Product Summary

**Working title:** Contraption Workshop
**Genre:** 2D physics puzzle / construction sandbox
**Platform:** Web browser (desktop-first, responsive down to tablet). No install.
**Vision:** Faithfully recapture the joy of *The Incredible Machine*: each level hands you a half-finished Rube Goldberg machine and a bin of spare parts. You arrange the parts, press **Run**, and watch deterministic physics either solve the puzzle in a gloriously convoluted way — or fail hilariously. Build it, run it, reset it, tweak it, win.

**Source material (for fidelity, not assets):**
- Wikipedia — *The Incredible Machine*, Gameplay section: https://en.wikipedia.org/wiki/The_Incredible_Machine
- Gameplay reference video: https://www.youtube.com/watch?v=EJbEDlDDVVc

> ⚠️ **IP note:** Do **not** copy original art, sound, level data, or trademarked names/logos. This is an original homage. Use original or properly-licensed (CC0 / MIT / public-domain) art and audio. The product name in the UI must be our own ("Contraption Workshop"), not "The Incredible Machine."

---

## 2. The Core Loop (must feel exactly like the original)

1. A puzzle loads showing a **scene**: a bounded play area containing **fixed parts** (immovable, pre-placed by the level) and a stated **goal** (e.g., *"Get the basketball into the bucket"* or *"Turn on the fan"*).
2. The player has a **parts bin** (inventory) with a limited count of each available part.
3. The player **drags parts from the bin into the scene**, positioning, rotating, and (where applicable) configuring them. Parts cannot overlap fixed geometry or each other invalidly.
4. The player presses **Run**. The physics simulation starts; everything obeys gravity, momentum, friction, ropes, air, etc.
5. If the **win condition** is satisfied, the player sees a **success** state (celebration + "Next Level"). If the machine settles without solving the goal, the player presses **Reset** (parts return to exactly where they were placed) and iterates.
6. **Stop/Reset** is always available during a run.

The defining flavor: **needlessly complex chain reactions performing a simple task.** Levels are designed so the obvious direct solution is impossible and the player must chain several parts together.

---

## 3. Goals & Non-Goals

### In scope (v1)
- Deterministic 2D physics sandbox with the parts catalog in §7 (MVP subset required; stretch subset optional).
- **Puzzle Mode:** at least **10 hand-authored levels** of increasing difficulty, data-driven from JSON, with win detection.
- **Sandbox / Freeform Mode:** an empty scene with the full parts bin and no goal.
- **Level Editor:** place parts + fixed geometry, define a goal, save/load a level as JSON (download/upload + localStorage). Editor-authored levels are playable.
- Drag-and-drop placement, rotation, deletion, part configuration; Run/Stop/Reset; goal HUD; win/lose feedback.
- Save progress (which levels are solved) in `localStorage`.
- Original visual style (clean, friendly, slightly cartoonish) and basic SFX.
- Full local Playwright E2E coverage of the core loop.
- One-command deploy to **Google Cloud**.

### Out of scope (v1, note as future work)
- Multiplayer / accounts / server-side persistence (everything is client-side).
- Mobile-phone-portrait layout (tablet/desktop only for v1).
- A community level-sharing backend (editor exports/imports JSON files instead).
- Original-game asset import.

---

## 4. Technology Stack (prescribed)

Use this stack. It is chosen for determinism, browser-native delivery, and testability.

| Concern | Choice | Notes |
|---|---|---|
| Language | **TypeScript** (strict mode) | |
| Build / dev server | **Vite** | Fast HMR; outputs a static `dist/`. |
| Physics engine | **matter.js** (`matter-js` + `@types/matter-js`) | 2D rigid bodies, constraints (ropes/springs), composites, sensors, collision filtering. Drive it with a **fixed timestep** for determinism. |
| Rendering | **HTML5 Canvas 2D**, custom renderer decoupled from physics | Read body transforms from Matter, draw sprites/vectors. You MAY use `Matter.Render` for early milestones to move fast, but the shipped renderer must be the custom sprite/vector one so visuals aren't tied to the debug renderer. (PixiJS is an acceptable upgrade if you want batching, but not required.) |
| UI shell | Plain TypeScript + HTML/CSS, or a thin layer of **Preact** if helpful | No heavy SPA framework. Keep the DOM UI (toolbox, HUD, menus) separate from the canvas game view. |
| State | Small hand-rolled store / event emitter | No Redux. |
| Unit tests | **Vitest** | Test physics rules, win-detection, level (de)serialization. |
| E2E / browser tests | **Playwright** (`@playwright/test`) | Drive the real app in Chromium (+ optionally WebKit/Firefox). |
| Lint/format | ESLint + Prettier | |
| Deploy target | **Firebase Hosting** (Google Cloud) | Static/SPA delivery with built-in global CDN, edge caching, free SSL, atomic deploys & instant rollbacks. A Firebase project *is* a GCP project, so it uses the project you already created. No container needed. See §15. |
| Node version | Node 20 LTS | Pin in `.nvmrc`. |

---

## 5. Architecture

Keep four layers cleanly separated so each is independently testable:

```
┌─────────────────────────────────────────────────────────┐
│  UI Shell (DOM)                                          │
│  Toolbox / parts bin · Goal HUD · Run-Stop-Reset ·       │
│  Level select · Editor panels · Win/Lose modals          │
└───────────────▲───────────────────────┬──────────────────┘
                │ events                 │ commands
┌───────────────┴───────────────────────▼──────────────────┐
│  Game Controller (orchestration / state machine)          │
│  Modes: Puzzle · Sandbox · Editor                         │
│  States: Editing → Running → (Won | Settled) → Editing    │
└───────────────▲───────────────────────┬──────────────────┘
                │ snapshots              │ step()
┌───────────────┴────────────┐ ┌─────────▼──────────────────┐
│  Renderer (Canvas 2D)      │ │  Simulation (matter.js)    │
│  Pure: world state → pixels│ │  Parts, bodies, constraints│
│  Interpolated, 60fps       │ │  Fixed-timestep, win-detect│
└────────────────────────────┘ └────────────────────────────┘
                                          ▲
                            ┌─────────────┴──────────────┐
                            │  Part definitions (data)    │
                            │  + Level JSON loader/saver   │
                            └─────────────────────────────┘
```

**Part definition registry:** every part is described by a declarative definition (id, display name, category, icon, body factory, behavior hooks, configurable options, default physics params). Adding a new part = adding one definition file + a sprite. The simulation, renderer, toolbox, and editor all read from this registry — no part should be special-cased across layers.

---

## 6. Physics & Determinism Rules

- **Fixed timestep.** Advance the engine with a constant delta (e.g., 1000/60 ms). Use an accumulator: render at the display refresh rate but step physics in fixed increments; interpolate render positions between steps. Do **not** pass variable frame deltas into `Matter.Engine.update`.
- **No randomness in simulation.** Forbid `Math.random()` in any code path that affects bodies. If you ever need jitter, use a seeded PRNG seeded from level data (so replays are identical). Add an ESLint rule or test that greps the sim modules for `Math.random`.
- **Determinism test:** running the same level with the same placements must produce byte-identical world state after N steps. Add a Vitest that asserts this (hash the positions after, say, 600 steps).
- **Gravity** points downward; expose it as a world constant. Some parts defy it (see balloons, 8-ball).
- **Air pressure / wind** is modeled as directional force fields emitted by fans/bellows acting on bodies within a region (lightweight: apply force to bodies whose centroid is inside the field polygon, scaled by distance).
- **Settling / failure detection:** the run is considered "settled" (failed if goal unmet) when total kinetic energy stays below a threshold for ~2 seconds, OR after a max run time (e.g., 60s). On settle without win, surface a gentle "Try again" affordance (do not hard-fail; let the player Reset).

---

## 7. Parts Catalog

Each part has: `id`, `name`, `category`, `movableByPlayer` (bool), `rotatable` (bool), physics params (density, friction, restitution), and behavior. **MVP parts are required for v1.** **Stretch parts** are nice-to-have; implement as many as time allows, but the engine and registry must make adding them trivial.

### 7.1 MVP parts (required)

**Structure / static (fixed geometry; some placeable by player):**
- **Wall / Brick** — solid static rectangle. Blocks everything.
- **Ramp / Incline** — angled static surface; rotatable. Balls roll down it.
- **Floor & Side Walls** — the scene boundary (level-defined, not in bin).

**Dynamic objects (obey gravity):**
- **Basketball** — medium mass, bouncy (restitution ~0.6), rolls.
- **Bowling ball** — heavy (high density), low bounce, strong momentum.
- **Tennis ball** — light, very bouncy.

**Mechanisms:**
- **Conveyor belt** — static body with a surface velocity; objects resting on it are carried left or right. **Configurable:** direction (L/R) and speed. (Implement via friction + applying tangential surface velocity at contacts.)
- **Seesaw / Teeter-totter** — a plank on a pivot constraint; tips under weight.
- **Rope** — a flexible link (chain of segments or a constraint) connecting two anchor points/objects; transmits tension, can be cut.
- **Pulley** — redirects a rope; combined with rope lets a falling weight lift another object.
- **Fan (electric)** — emits a directional wind field that pushes light objects/balloons; rotatable. **Configurable:** on/off at start, or triggered by power.
- **Balloon** — **floats upward** (negative net gravity via buoyancy force); pops on contact with anything sharp or a flame.
- **Trampoline** — bouncy surface; each bounce can add velocity (cap it to avoid runaway).

**Goal items / containers (level-defined, usually fixed):**
- **Bucket / Basket / Box** — open container; "object inside" is a common win condition. Implement the opening as a sensor zone.
- **Goal zone** — invisible sensor region used by win conditions.

### 7.2 Stretch parts (implement as time allows — original-game flavor)

- **Gears** — rotate; meshing adjacent gears transfer rotation (opposite directions); a driven gear can turn a belt/axle.
- **Belt + Pulleys (power transmission)** — connect two wheels so one drives the other.
- **Candle** — has a wick; starts lit or unlit; flame can burn through ropes and pop balloons; can be lit by another flame or focused light.
- **Match / fire source** — ignites things on contact.
- **Magnifying glass** — focuses a light beam; where the focused beam lands it can **ignite** a wick (line-of-sight + light source required).
- **Light bulb / light source** — emits light; can power things or feed a magnifying glass.
- **Scissors** — snip a rope when triggered.
- **Bellows** — when struck (from above/below) blows a gust of air (like a one-shot fan).
- **Extendo boxing glove** — punches horizontally when triggered, knocking an object forward.
- **Electric generator / motor / switch / wires** — a simple power network: a source + switch closes a circuit to drive a fan/motor/light. Keep the model simple (boolean powered state propagated along connections).
- **Mouse + Cheese** — the mouse runs toward the nearest cheese; can run on a treadmill/wheel to drive a mechanism.
- **Cat** — chases the nearest mouse (and flees nothing); adds comedic kinetic chains.
- **Pipe / Tube** — guides a ball along a curved path.
- **Vacuum / suction**, **mixer**, **windmill**, **see-saw variants**, **gravity/air-pressure region tweak** — optional extras.

> For each part, store sensible default physics constants in its definition and expose only the few options the original exposes (e.g., conveyor direction/speed, fan on/off, candle lit/unlit). Document the constants in `PARTS.md`.

### 7.3 Interaction matrix (must-have behaviors)

Implement these cross-part interactions (others are bonus):
- Fan/bellows wind **pushes** balloons and light balls; can **blow out** an unlit-relevant flame (stretch).
- Flame/match **pops** balloons and **burns** ropes (rope severs → tension releases).
- Scissors **cut** ropes on trigger.
- Magnifying glass + light **ignite** a candle wick (stretch).
- Mouse moves toward cheese; cat moves toward mouse (stretch).
- Conveyor **carries** any dynamic body resting on it.
- Trampoline **bounces** dynamic bodies.
- Rope+pulley+weight **lifts** a connected object.

---

## 8. Level / Puzzle Data Schema

Levels are pure JSON (data-driven). Define a TypeScript type and a runtime validator (e.g., a hand-written guard or `zod` if you add it). Editor saves/loads this exact shape.

```jsonc
{
  "id": "level-03",
  "title": "Wake the Cat",
  "version": 1,
  "world": {
    "width": 960,
    "height": 600,
    "gravity": { "x": 0, "y": 1 },
    "airPressure": 1.0
  },
  "goal": {
    "type": "object-in-zone",        // see goal types below
    "objectTag": "basketball-1",
    "zone": { "x": 820, "y": 480, "w": 90, "h": 90 },
    "sustainMs": 300,                // must stay satisfied this long
    "description": "Get the basketball into the bucket."
  },
  "fixedParts": [                    // immovable, pre-placed
    { "partId": "ramp", "x": 200, "y": 300, "rotation": 18, "tag": "ramp-1", "movable": false },
    { "partId": "bucket", "x": 820, "y": 500, "rotation": 0, "tag": "bucket-1", "movable": false }
  ],
  "placedParts": [                   // optional pre-placed movable parts
    { "partId": "basketball", "x": 120, "y": 120, "rotation": 0, "tag": "basketball-1" }
  ],
  "bin": [                           // inventory available to the player
    { "partId": "conveyor", "count": 1, "options": { "direction": "right", "speed": 3 } },
    { "partId": "ramp", "count": 2 },
    { "partId": "fan", "count": 1 }
  ],
  "hint": "Balls roll downhill. Belts carry. Air pushes."
}
```

**Goal types (implement at least the first four):**
- `object-in-zone` — a tagged object's centroid stays inside a zone for `sustainMs`.
- `device-on` — a device (fan/light/motor) is powered/active.
- `objects-collide` — two tagged objects touch (e.g., cat reaches mouse).
- `all-of` / `any-of` — composite of sub-goals.
- `pop-all` / `light-all` (stretch) — all balloons popped / all candles lit.

Ship **10+ levels** in `src/levels/*.json` covering a difficulty curve: levels 1–3 teach single parts (ramp, conveyor, fan), 4–7 require 2–3-part chains, 8–10 require multi-stage Rube-Goldberg chains. Include each level's intended solution in `LEVELS.md` for QA (do not show it to the player).

---

## 9. UI / UX Specification

**Layout (desktop):**
- **Top bar:** level title, goal text, level-select button, mode switch (Puzzle / Sandbox / Editor), mute toggle.
- **Left rail — Parts Bin:** scrollable, category-grouped tiles, each showing the part icon and remaining count. Drag a tile onto the canvas to place; the placed instance decrements the count. Drag a placed part back to the bin (or hit Delete) to return it.
- **Center — Play Area (canvas):** the scene. Fixed parts render with a subtle "locked" treatment. Movable parts have grab handles; show a rotation handle when selected. Invalid placement (overlap) highlights red and snaps back. Optional light grid + snap toggle.
- **Bottom bar:** **Run** ▶, **Stop** ⏹, **Reset** ↺, speed control (1×/2×), and a run-state indicator. **Reset returns all movable parts to their pre-run placement exactly.**
- **Modals:** Win ("Solved!" + confetti + Next Level), Settled-without-win (gentle nudge + Reset), Level Select grid (with solved checkmarks), Editor save/load.

**Controls:**
- Mouse drag to place/move; scroll-wheel or `[`/`]` (or a handle) to rotate selected part; `Delete`/`Backspace` removes selected; `Space` toggles Run/Stop; `R` resets.
- Touch support: tap-drag to place, two-finger or on-screen handle to rotate.

**Feel:** snappy, forgiving, playful. Placement should feel tactile (hover highlights, snap, satisfying drop). Running should feel alive (subtle sounds per interaction).

---

## 10. Visual & Audio Direction

- **Visual:** clean, friendly, lightly cartoonish — bright primary palette, chunky outlines, readable silhouettes. Original art only (simple vector shapes or CC0 sprites are fine for v1). Distinct, instantly-recognizable icon per part. Smooth 60fps rendering with interpolation.
- **Audio:** light, optional SFX for place/rotate/delete, run-start, collisions/bounces, success jingle. Use CC0/public-domain or self-generated (WebAudio) sounds. Respect the mute toggle and start muted-friendly (no autoplay surprises).
- **Accessibility:** keyboard operable; sufficient color contrast; don't rely on color alone for state (use icons/labels); honor `prefers-reduced-motion` (reduce confetti/shake).

---

## 11. Project Structure (suggested)

```
incredible-machine/
├── PRD.md                  ← this file
├── README.md               ← how to run, test, deploy
├── PARTS.md                ← part constants & behaviors
├── LEVELS.md               ← levels + intended solutions (QA)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .nvmrc                  ← 20
├── firebase.json           ← Firebase Hosting config (public: dist, SPA rewrite, cache headers)
├── .firebaserc             ← Firebase project alias (PROJECT_ID)
├── playwright.config.ts
├── index.html
├── public/                 ← static assets (icons, sfx)
├── src/
│   ├── main.ts             ← bootstrap
│   ├── engine/             ← simulation (matter.js wrapper, fixed-step loop, win-detect)
│   ├── parts/              ← one definition file per part + registry
│   ├── render/             ← canvas renderer + interpolation
│   ├── ui/                 ← toolbox, HUD, modals, level select, editor
│   ├── modes/              ← puzzle / sandbox / editor controllers
│   ├── levels/             ← *.json level data + loader/validator
│   ├── store/              ← state machine + persistence (localStorage)
│   └── util/               ← seeded prng, math, helpers
├── tests/
│   ├── unit/               ← Vitest
│   └── e2e/                ← Playwright specs
└── scripts/
    └── deploy.sh           ← Google Cloud deploy helper
```

---

## 12. Build, Run & Scripts

Provide these npm scripts (names are contractual — tests/CI rely on them):

- `npm run dev` — Vite dev server (default port 5173).
- `npm run build` — type-check + production build to `dist/`.
- `npm run preview` — serve the production build locally (used by Playwright).
- `npm test` — Vitest unit tests (CI mode, no watch).
- `npm run test:e2e` — Playwright E2E (auto-starts `preview` via `webServer` config).
- `npm run lint` / `npm run format`.
- `npm run deploy` — build then deploy to Firebase Hosting (wraps `scripts/deploy.sh`).

`README.md` must document each of these plus prerequisites (Node 20, Firebase CLI / `firebase-tools`).

---

## 13. Testing Requirements

Testing is part of "done," not an afterthought. Two layers:

### 13.1 Unit tests (Vitest) — at minimum:
- **Determinism:** same level + same placements ⇒ identical world hash after 600 fixed steps.
- **Win detection:** `object-in-zone` fires only after `sustainMs`; `objects-collide` fires on contact; composite goals.
- **Level (de)serialization:** round-trip a level JSON through loader→saver→loader unchanged; validator rejects malformed levels.
- **Part registry:** every level's referenced `partId`s exist in the registry; every part has required fields.
- **Specific behaviors:** balloon rises; conveyor carries a resting body in the configured direction; fan pushes a light body; rope severs on cut.
- **No-`Math.random` guard** over `src/engine` and `src/parts`.

### 13.2 Playwright E2E — at minimum these specs (run against `npm run preview`):
1. **App boots:** home/level-select renders; no console errors.
2. **Load a level:** goal text and parts bin render; canvas present.
3. **Place a part:** drag a part from the bin into the scene; bin count decrements; part appears (assert via an exposed test hook — see below).
4. **Solve the simplest level:** programmatically place the known-correct part(s), press Run, assert the **Win** modal appears within a timeout. (Use a deterministic "auto-solve" placement so the test is stable.)
5. **Reset restores state:** after a run, Reset returns placed parts to original positions and re-enables editing.
6. **Sandbox mode:** open Sandbox, place parts, Run, no goal, no errors.
7. **Editor round-trip:** create a tiny level in the Editor, save (download/localStorage), reload it, and play it.
8. **Persistence:** solving a level marks it solved in level-select after reload.

**Test hooks:** expose a minimal, build-stripped test API on `window` (e.g., `window.__GAME__` available only when `import.meta.env.MODE !== 'production'` or behind a `?test=1` flag) so Playwright can place parts, query world state, and read win-state deterministically without brittle pixel-picking. Document it.

Playwright `webServer` should auto-run `npm run preview`. Target Chromium for CI; optionally add WebKit/Firefox. Capture a trace/screenshot/video on failure. Add a `test:e2e:headed` for debugging.

---

## 14. Definition of Done (v1 acceptance criteria)

- [ ] `npm run dev` launches a playable app; `npm run build` succeeds with **zero TS errors** and **zero ESLint errors**.
- [ ] All MVP parts (§7.1) implemented and behaving per spec; registry-driven.
- [ ] **≥10 hand-authored, solvable levels** with a real difficulty curve; each verified solvable (documented in `LEVELS.md` and covered by at least one auto-solve E2E for the simplest).
- [ ] Puzzle, Sandbox, and Editor modes all functional; editor levels save/load/play.
- [ ] Deterministic physics verified by test.
- [ ] Drag/rotate/delete placement, Run/Stop/Reset, win/settle feedback, level-select with persisted progress — all working.
- [ ] All Vitest unit tests and all Playwright E2E specs in §13 pass locally.
- [ ] `npm run preview` serves the production build locally and is playable.
- [ ] Deployed to Firebase Hosting; the public URL loads and is playable; I (the user) can reach it.
- [ ] `README.md` documents run/test/deploy; `PARTS.md` and `LEVELS.md` exist.

---

## 15. Google Cloud Deployment (Firebase Hosting)

**Target: Firebase Hosting** — Google Cloud's purpose-built static/SPA host. It serves the built `dist/` over a **global CDN with edge caching**, **free automatic SSL**, **atomic deploys**, and **instant rollbacks**. A Firebase project *is* a Google Cloud project, so it slots into the GCP project you already created. For a fully static browser game this is **cheaper and simpler than Cloud Run** — no per-request compute, no container, no separately-assembled load balancer/CDN — and is effectively free at hobby scale.

### 15.1 What the agent must produce
- **`firebase.json`** — `hosting.public = "dist"`, an SPA rewrite of all routes to `/index.html`, and sensible cache headers (long `max-age, immutable` for content-hashed assets; `no-cache` for `index.html`).
- **`.firebaserc`** — default project alias pointing at `PROJECT_ID`.
- **`scripts/deploy.sh`** — builds then deploys; parameterized by `PROJECT_ID` (env var or arg). No Docker/nginx artifacts — none are needed.
- A "Deploying" section in `README.md` with the exact commands.

### 15.2 Deploy flow (the agent runs this, asking me for PROJECT_ID first)
```bash
# 0. One-time setup (I run these myself if needed):
#    ! npm i -g firebase-tools
#    ! firebase login

# 1. Point the CLI at my project
firebase use "$PROJECT_ID"        # first time: firebase use --add

# 2. Build the production bundle (gated on tests passing — see 15.3)
npm run build

# 3. Deploy only Hosting
firebase deploy --only hosting --project "$PROJECT_ID"

# 4. The CLI prints the live URL, e.g. https://$PROJECT_ID.web.app
```
> Prefer committing a hand-written `firebase.json` so deploys are non-interactive. If you must run `firebase init hosting`, set public dir = `dist`, configure as a single-page app = **yes**, and do **not** overwrite an existing `dist/index.html`.

### 15.3 Pre-deploy gate
**Do not deploy until** `npm run build`, `npm test`, and `npm run test:e2e` all pass locally **and** `npm run preview` serves the production build correctly on localhost. Then ask me to confirm the first deploy.

### 15.4 Cost & plan notes
- Firebase Hosting is available on the **free Spark plan**; its free tier (10 GB stored, ~360 MB/day egress) comfortably covers a hobby/demo game — effectively **$0/month**.
- On the **Blaze (pay-as-you-go)** plan, Hosting bills only beyond the free tier (~$0.026/GB-month storage, ~$0.15/GB transfer) with **no compute or per-request charge**; built-in CDN caching keeps egress low.
- This is cheaper than Cloud Run for static delivery: Cloud Run bills CPU/memory **per request** and needs an added HTTP load balancer (fixed ~$18/month) to gain a CDN; Firebase bundles CDN + SSL + caching for free.

### 15.5 Post-deploy
- Print the live `*.web.app` / `*.firebaseapp.com` URL prominently so I can open it.
- Add the one-paragraph "Deploying" section to `README.md` (commands + where to set `PROJECT_ID`).
- Do **not** wire up CI/CD or a custom domain in v1 (note as future work). Firebase **preview channels** (`firebase hosting:channel:deploy`) are a nice future addition for per-branch preview URLs.

### 15.6 Alternative (document, don't implement unless I ask)
If we later add a server/API, **Cloud Run** (containerized, scales to zero) becomes worthwhile and would justify a Dockerfile + nginx. For a purely static v1, Firebase Hosting is the chosen path.

---

## 16. Milestones (build in this order; tests green before advancing)

**M1 — Skeleton & harness.**
Vite + TS + ESLint/Prettier scaffold. Empty canvas, basic page shell, npm scripts, Vitest + Playwright wired with one trivial passing test each (`app boots`). Commit-ready, runnable.

**M2 — Physics core + renderer.**
matter.js fixed-step loop with accumulator + interpolated Canvas renderer. Drop a ball, watch it fall and bounce on a floor. Determinism unit test passing. Run/Stop/Reset controls operate the loop.

**M3 — Parts registry + placement.**
Part definition registry; implement Wall, Ramp, three balls, Bucket. Parts bin UI; drag-to-place, rotate, delete, overlap validation, snap-back. Reset restores placements. E2E: place a part, bin decrements.

**M4 — Win conditions + first levels.**
Level JSON schema + loader/validator; `object-in-zone` goal + sensor zones; settle detection; Win/Settle modals. Author levels 1–3 (ramp, then conveyor, then fan). Implement Conveyor, Fan (wind field), Balloon, Trampoline, Seesaw, Rope, Pulley. E2E: auto-solve level 1.

**M5 — Full puzzle set + modes.**
Author levels 4–10 with multi-part chains. Sandbox mode. Level-select screen with `localStorage` progress. Polish placement feel + SFX. Add remaining MVP behaviors and the interaction matrix (§7.3). Stretch parts as time allows.

**M6 — Level Editor.**
Place fixed + movable parts, define goal/zone, configure bin, save/load (download + upload + localStorage), play editor levels. E2E: editor round-trip.

**M7 — Hardening & Deploy.**
Full test pass; accessibility & responsive pass; verify `npm run build` + `npm run preview` serve a correct production build. Add `firebase.json` / `.firebaserc` / `scripts/deploy.sh`. Then (with my go-ahead) deploy to Firebase Hosting and hand me the live URL. Update README/PARTS/LEVELS.

After each milestone, report: what was built, test results, and anything you deferred.

---

## 17. Open Questions for the Lord Commander (ask once, then proceed with defaults)

1. **Firebase / GCP project ID** to deploy into? (Needed for §15. Firebase Hosting serves from a global CDN — no region to choose.)
2. Preferred **product name** in-UI — keep "Contraption Workshop" or your own title?
3. Any preference on **art style** (flat-vector vs. soft-cartoon) or should I choose?

If I don't answer, use the defaults above (project ID: ask and wait; name "Contraption Workshop"; flat-vector art) and keep building everything that doesn't depend on the answer.

---

### Appendix A — Faithfulness checklist (the "feels like TIM" test)
- Goals are trivially simple to *state*, hard to *achieve directly* — forcing chains. ✔
- Physics is deterministic; re-running an unchanged machine yields the same result. ✔
- A mix of immovable fixed parts and a limited bin of movable parts. ✔
- Parts have charming, specific interactions (wind pushes balloons, flame burns rope, conveyor carries, mouse seeks cheese…). ✔
- Build → Run → watch → Reset → tweak loop is instant and satisfying. ✔
- A freeform sandbox and a level editor exist. ✔
```
