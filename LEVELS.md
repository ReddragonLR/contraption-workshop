# Levels — design notes & solutions (QA, spoilers!)

⚠️ This file contains intended solutions for QA. The game never shows them to
players. Every level is verified by `tests/unit/solvability.test.ts`, which plays
the documented solution (in `tests/unit/solutions/<id>.ts`) through the real game
controller and asserts a win — and asserts the level does *not* win with an empty
bin. All placements respect the player's 10px position grid and 15° rotation steps.

The difficulty curve: 1–3 teach a single part; 4–7 introduce two- and three-part
chains; 8–10 are multi-stage Rube-Goldberg machines.

---

### level-01 — "Roll With It"  (teaches: ramp)
**Goal:** Get the basketball into the bucket. · **Bin:** ramp ×2
**Solution:** A basketball sits top-left; a bucket waits on the floor at x≈650.
Place a ramp at (230, 280) rot 15 to catch the falling ball and send it right,
then a second ramp at (450, 430) rot 15 to bounce it onward — it arcs into the
bucket.

### level-02 — "Special Delivery"  (teaches: conveyor)
**Goal:** Carry the basketball to the bucket. · **Bin:** conveyor ×1 (right, speed 5), ramp ×1
**Solution:** Place the ramp at (520, 180) rot 15 so the ball drops in and rolls
right; place the conveyor at (660, 380). The ramp drops the ball onto the belt,
which carries it right and tips it off the end, over the fence and into the bucket.

### level-03 — "Updraft"  (teaches: fan / wind)
**Goal:** Blow the balloon into the marked sky corner. · **Bin:** fan ×1
**Solution:** A balloon rises from the floor and hugs the ceiling. Place the fan at
(140, 60) rot 0 (blowing right) near the ceiling; its wind pushes the drifting
balloon along the ceiling into the goal zone in the upper-middle sky.

### level-04 — "Pop Fly"  (teaches: seesaw)
**Goal:** Launch the tennis ball into the floating target. · **Bin:** seesaw ×1, ramp ×1, trampoline ×1 (decoy)
**Solution:** Place the seesaw at (450, 570) so the hovering tennis ball drops onto
its left half and rolls into the pocket against the fixed backstop. Place the ramp
at (650, 140) rot 345 so the bowling ball from the top-right rolls off and free-falls
onto the plank just right of the pivot, catapulting the tennis ball up through the
target.

### level-05 — "Air Mail"  (teaches: trampoline)
**Goal:** Post the basketball into the bucket on the pedestal. · **Bin:** trampoline ×1, ramp ×1, wall ×1 (decoy)
**Solution:** Place the ramp at (140, 230) rot 30 to convert the ball's drop into a
fast rightward run-up; place the trampoline flat at (380, 580). The ball slams the
bed diagonally and rebounds (capped at 16 px/step) over the 270px brick barrier,
dropping gently into the elevated bucket.

### level-06 — "Pressing Engagement"  (teaches: button + power)
**Goal:** Turn on the fan. · **Bin:** ramp ×2, conveyor ×1 (right, speed 5)
**Solution:** A bowling ball falls from the top-left; the fan's switch sits in a
fenced pen reachable only from above. Place ramp 1 at (200, 200) rot 15 and ramp 2
at (410, 360) rot 15 to cascade the ball right, then the conveyor at (590, 440) as a
bridge over the left fence. The belt flings the ball into the pen onto the button,
powering the fan.

### level-07 — "Counterweight"  (teaches: rope + pulley)
**Goal:** Hoist the tennis ball up to the marked window. · **Bin:** bowling-ball ×1, ramp ×2
**Solution:** A bowling-ball "weight" rests on a shelf, roped over a pulley to a
tennis-ball "cargo" on the floor. Drop your own bowling ball onto the shelf beside
the weight (place it at (220, 80)); it wedges the weight off the edge, and the
falling weight hauls the roped tennis ball up into the window.

### level-08 — "Reunion"  (objects-collide; multi-stage)
**Goal:** Reunite the two basketballs. · **Bin:** ramp ×4
**Solution:** Two basketballs sit in opposite high corners above a fixed central
V-valley. Build a two-ramp chute on each side — left: (210,230) rot 30 + (300,380)
rot 15; right: (750,230) rot 330 + (660,380) rot 345 — to carry each ball down toward
the valley. By symmetry they arrive together at the vertex and collide.

### level-09 — "Assembly Line"  (multi-stage chain)
**Goal:** Send the ball down the line to the far loading bay. · **Bin:** ramp ×3, trampoline ×1
**Solution:** Cascade the ball onto the fixed conveyor with two ramps: (150,200) rot
30 + (270,290) rot 15. The belt accelerates it and flings it off the end, clearing
the central barrier and landing in the loading bay on the right floor.

### level-10 — "The Grand Finale"  (all-of composite goal)
**Goal:** Park the ball in the bay AND throw the victory switch. · **Bin:** ramp ×3, trampoline ×1
**Solution:** One trip does both. Feed the ball onto the belt with ramps at (150,200)
rot 30 and (270,290) rot 15. It flies over the barrier into the bay (object-in-zone),
then rolls back across the victory switch on the bay floor (device-on: the fan turns
on) — satisfying both halves of the composite goal.
