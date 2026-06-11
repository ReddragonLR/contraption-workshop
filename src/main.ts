import './style.css';
import '@fontsource/bungee/index.css';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/caveat/700.css';
import { registerAllParts } from './parts';
import { GameController, type Mode } from './modes/controller';
import { sandboxScene } from './modes/sandbox';
import { FixedLoop } from './engine/loop';
import { Renderer } from './render/renderer';
import { Toolbox } from './ui/toolbox';
import { Hud } from './ui/hud';
import { PointerInput } from './ui/pointerInput';
import { showToast } from './ui/toast';
import { installTestApi } from './testapi';

registerAllParts();

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar"></header>
  <aside class="bin" aria-label="Parts bin"></aside>
  <main class="stage">
    <div class="canvas-wrap">
      <canvas id="game-canvas" aria-label="Play area"></canvas>
    </div>
  </main>
  <footer class="bottombar"></footer>
`;

const controller = new GameController();
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const wrap = document.querySelector<HTMLElement>('.canvas-wrap')!;
const renderer = new Renderer(canvas);

let muted = localStorage.getItem('cw-muted') === '1';

const hooks = {
  onRun: () => controller.run(),
  onStop: () => controller.stop(),
  onReset: () => controller.reset(),
  onSpeed: (s: number) => {
    loop.speed = s;
  },
  onMode: (mode: Mode) => {
    if (mode === controller.mode) return;
    if (mode === 'sandbox') {
      controller.loadScene(sandboxScene(), 'sandbox');
    } else {
      showToast(`${mode[0].toUpperCase()}${mode.slice(1)} mode arrives in a later milestone.`);
    }
  },
  onLevels: () => showToast('Level select arrives with the puzzle set.'),
  onMute: () => {
    muted = !muted;
    localStorage.setItem('cw-muted', muted ? '1' : '0');
  },
  isMuted: () => muted,
};

const pointer = new PointerInput(canvas, wrap, controller, renderer, hooks);
new Toolbox(document.querySelector('.bin')!, controller, (start) => pointer.beginBinDrag(start));
new Hud(
  document.querySelector('.topbar')!,
  document.querySelector('.bottombar')!,
  controller,
  hooks,
);

const loop = new FixedLoop(
  () => controller.tickRun(),
  (alpha) =>
    renderer.render(controller.sim, controller.runState === 'running' ? alpha : 1, pointer.drawOverlay),
);

controller.on('scene', (scene) => {
  renderer.setWorldSize(scene.world.width, scene.world.height);
});
controller.on('runState', (rs) => {
  loop.setRunning(rs === 'running');
});

new ResizeObserver(() => renderer.fit()).observe(wrap);

controller.loadScene(sandboxScene(), 'sandbox');
loop.start();

installTestApi(controller, loop);
