import './style.css';
import { registerAllParts } from './parts';
import { PlacementFactory } from './parts/placements';
import { Simulation, type WorldSpec } from './engine/simulation';
import { FixedLoop } from './engine/loop';
import { Renderer } from './render/renderer';

// M2 demo shell: a ball drops onto ramps and lands in a bucket.
// Replaced by the full game controller in M3.
registerAllParts();

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar"><h1>Contraption Workshop</h1></header>
  <main class="stage">
    <div class="canvas-wrap"><canvas id="game-canvas"></canvas></div>
  </main>
  <footer class="bottombar">
    <button id="btn-run">▶ Run</button>
    <button id="btn-stop">⏹ Stop</button>
    <button id="btn-reset">↺ Reset</button>
  </footer>
`;

const world: WorldSpec = { width: 960, height: 600, gravity: { x: 0, y: 1 } };

function buildPlacements() {
  const f = new PlacementFactory();
  return [
    f.make('ramp', 280, 250, { rotation: 14 }),
    f.make('ramp', 620, 400, { rotation: -16 }),
    f.make('bucket', 180, 540),
    f.make('basketball', 200, 60),
    f.make('bowling-ball', 700, 80),
    f.make('tennis-ball', 420, 120),
  ];
}

let sim = new Simulation(world, buildPlacements());

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const renderer = new Renderer(canvas);
renderer.setWorldSize(world.width, world.height);

const loop = new FixedLoop(
  () => sim.step(),
  (alpha) => renderer.render(sim, alpha),
);
loop.start();
window.addEventListener('resize', () => renderer.fit());

document.querySelector('#btn-run')!.addEventListener('click', () => loop.setRunning(true));
document.querySelector('#btn-stop')!.addEventListener('click', () => loop.setRunning(false));
document.querySelector('#btn-reset')!.addEventListener('click', () => {
  loop.setRunning(false);
  sim.destroy();
  sim = new Simulation(world, buildPlacements());
});
