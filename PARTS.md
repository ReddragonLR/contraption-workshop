# Parts Catalog — physics constants & behaviors

All parts are registry-driven (`src/parts/defs/*.ts`): one definition file per part
covering physics, behavior hooks, and vector art. Placement coordinates refer to the
part's center; rotation is degrees clockwise. The placement grid is 10px / 15°.

Matter.js conventions: density × area = mass; velocity is px per fixed step (1/60s);
gravity y=1 ≈ 0.3 px/step² downward. Pair friction = min of both bodies, pair
restitution = max (so a bouncy ball stays bouncy on dull surfaces).

## Structure

| Part | Size | Static | Constants | Notes |
|---|---|---|---|---|
| Brick Wall `wall` | 100×26 | ✓ | friction 0.6, restitution 0.1 | Universal blocker/shelf |
| Ramp `ramp` | 150×14 | ✓ | friction 0.05 | Low-friction plank; balls roll freely |

## Balls

| Part | Radius | Density | Restitution | Friction | Character |
|---|---|---|---|---|---|
| Basketball `basketball` | 22 | 0.0012 (m≈1.8) | 0.60 | 0.04 | The all-rounder; lively bounce |
| Bowling Ball `bowling-ball` | 25 | 0.006 (m≈11.7) | 0.08 | 0.06 | Heavy hitter; thuds, never bounces out |
| Tennis Ball `tennis-ball` | 13 | 0.0008 (m≈0.42) | 0.85 | 0.03 | Featherweight; flies in wind |

All balls: frictionAir 0.002, anchor `center` for ropes.

## Mechanisms

- **Conveyor Belt `conveyor`** (140×24, static, rotatable) — options `direction`
  (right/left), `speed` (1–5). Carries resting bodies at ≈ `speed × 0.55` px/step along
  the belt tangent, adjusting velocity by ≤0.12 px/step² (also slows faster objects to
  belt speed). Animated chevrons show direction.
- **Fan `fan`** (48×66, static, rotatable) — option `startsOn` (bool). Blows along its
  local +X: an oriented wind field 280px deep × 80px tall starting 24px past the face.
  Applies a constant (non-mass-scaled) force `0.00065 × falloff(1 → 0.25)` to bodies
  whose centroid is inside, skipping bodies already moving >9 px/step downwind — so
  light objects fly and heavy ones barely shiver. Can be switched on mid-run by a
  button powering the fan's tag; exposes `state.isOn` for `device-on` goals.
- **Balloon `balloon`** (r22, dynamic) — density 0.00018, frictionAir 0.018,
  restitution 0.4. Buoyancy force −1.9× its gravity each step ⇒ rises at ~0.9g and hugs
  ceilings. Pops (body removed + `balloon-pop` event) on contact with sharp/flame parts
  (stretch hook); `popBalloon()` exported for future scissors/candle. Rope anchor `knot`
  at its base.
- **Trampoline `trampoline`** (120×30, static, rotatable) — bouncy bed (restitution
  0.93) on a frame. On impact ≥2 px/step adds a kick `min(2.5, 0.25×vₙ)` along the bed
  normal; **total exit speed hard-capped at 16 px/step** to prevent runaway. Emits
  `bounce`.
- **Seesaw `seesaw`** (190 plank on a 34px base, rotatable) — plank (density 0.0022)
  pinned at the placement point; tips freely under weight. Rope anchors `left`/`right`
  at the plank ends. Drop something heavy on one end to fling the other end's cargo.
- **Rope `rope`** (connector) — ties two anchors; optionally routed over pulleys via
  `link.via`. Implemented as a custom unilateral path-length constraint
  (|A→pulley→B| ≤ L) solved positionally + by velocity each step: inextensible under
  any mass ratio, slack when shorter (ropes never push), draws with sag when slack.
  `sim.cutRope(tag)` severs it (`rope-cut` event) and all tension vanishes.
- **Pulley `pulley`** (wheel r20 + housing bar, static) — redirects ropes listed in
  their `via`. The housing bar stops balls from riding over the crown; falling weight
  on one side hoists cargo on the other.
- **Button `button`** (72×20, static, rotatable) — option `powers` (a device tag). Any
  dynamic body touching it latches `state.pressed`, emits `button-press`, and turns the
  powered tag on through the simulation's power network (`device-on` event) — e.g.
  starting a fan with `startsOn:false`.

## Containers

- **Bucket `bucket`** (96×84, static) — three-walled open container; interior ≈78px
  wide. Balls can only enter from above (this is what makes "get the ball in the
  bucket" levels honest). Win zones are defined by the level, usually inside the mouth.
  Note: a basketball dropped >250px above the rim can bounce back out.

## Determinism rules (PRD §6)

- All simulation advances in fixed 1000/60 ms steps; rendering interpolates.
- No `Math.random` in `src/engine`, `src/parts`, `src/levels`, `src/util` — enforced by
  an ESLint rule *and* a unit test. Seeded PRNG (`util/prng.ts`) available if jitter is
  ever needed.
- Every run rebuilds the world from the placement list, so Reset is exact and replays
  are byte-identical (verified by hashing all body transforms after 600 steps).
