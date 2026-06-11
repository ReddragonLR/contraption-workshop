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
import { bindRunModals } from './ui/modals';
import { showLevelSelect } from './ui/levelSelect';
import { allLevels, getLevel, nextLevelId } from './levels';
import { levelToScene } from './levels/loader';
import { markSolved, solvedLevels, clearProgress } from './store/progress';
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
let currentLevelId: string | null = null;

function loadLevelById(id: string): boolean {
  const def = getLevel(id);
  if (!def) return false;
  currentLevelId = id;
  controller.loadScene(levelToScene(def), 'puzzle');
  return true;
}

function firstUnsolvedLevelId(): string {
  const solved = solvedLevels();
  return (allLevels().find((l) => !solved.has(l.id)) ?? allLevels()[0]).id;
}

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
    } else if (mode === 'puzzle') {
      loadLevelById(currentLevelId ?? firstUnsolvedLevelId());
    } else {
      showToast('The level editor arrives in a later milestone.');
    }
  },
  onLevels: () => showLevelSelect((id) => loadLevelById(id)),
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

bindRunModals(controller, {
  onSolved: (levelId) => markSolved(levelId),
  hasNextLevel: () =>
    controller.mode === 'puzzle' && !!currentLevelId && !!nextLevelId(currentLevelId),
  onNextLevel: () => {
    if (currentLevelId) {
      const next = nextLevelId(currentLevelId);
      if (next) loadLevelById(next);
    }
  },
  onLevelSelect: () => {
    controller.reset();
    showLevelSelect((id) => loadLevelById(id));
  },
});

const loop = new FixedLoop(
  () => controller.tickRun(),
  (alpha) =>
    renderer.render(
      controller.sim,
      controller.runState === 'running' ? alpha : 1,
      pointer.drawOverlay,
    ),
);

controller.on('scene', (scene) => {
  renderer.setWorldSize(scene.world.width, scene.world.height);
});
controller.on('runState', (rs) => {
  loop.setRunning(rs === 'running');
});

new ResizeObserver(() => renderer.fit()).observe(wrap);

loadLevelById(firstUnsolvedLevelId());
loop.start();

const api = installTestApi(controller, loop);
if (api) {
  api.extras.loadLevel = (id: string) => loadLevelById(id);
  api.extras.getLevels = () => allLevels().map((l) => ({ id: l.id, title: l.title }));
  api.extras.getSolved = () => [...solvedLevels()];
  api.extras.clearProgress = () => clearProgress();
  api.extras.currentLevelId = () => currentLevelId;
}
