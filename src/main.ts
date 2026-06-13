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
import { LevelEditor } from './modes/editor';
import { getCustomLevel, savedCustomLevels } from './store/editorStore';
import type { LevelDef } from './levels/types';
import { markSolved, solvedLevels, clearProgress } from './store/progress';
import { AudioEngine } from './ui/audio';
import { drawGoalZones, goalZones } from './render/zones';
import { installTestApi } from './testapi';
import type Matter from 'matter-js';

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
const audio = new AudioEngine(muted);
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
    if (controller.mode === 'editor') editor.exit();
    hideBackToEditor();
    if (mode === 'sandbox') {
      controller.loadScene(sandboxScene(), 'sandbox');
    } else if (mode === 'puzzle') {
      loadLevelById(currentLevelId ?? firstUnsolvedLevelId());
    } else {
      editor.enter();
    }
  },
  onLevels: () => openLevelSelect(),
  onMute: () => {
    muted = !muted;
    audio.muted = muted;
    localStorage.setItem('cw-muted', muted ? '1' : '0');
  },
  isMuted: () => muted,
};

controller.on('action', (action) => {
  const map = {
    placed: 'place',
    removed: 'delete',
    rotated: 'rotate',
    moved: 'place',
    denied: 'invalid',
  } as const;
  audio.play(map[action]);
});
controller.on('simEvent', ({ name, payload }) => {
  if (name === 'collision') {
    const pair = payload as Matter.Pair;
    const rel = Math.hypot(
      pair.bodyA.velocity.x - pair.bodyB.velocity.x,
      pair.bodyA.velocity.y - pair.bodyB.velocity.y,
    );
    if (rel > 2) audio.play('bounce', rel);
  } else if (name === 'bounce') {
    audio.play('bounce', 8);
  } else if (name === 'balloon-pop') {
    audio.play('pop');
  } else if (name === 'rope-cut') {
    audio.play('cut');
  } else if (name === 'device-on' || name === 'button-press') {
    audio.play('press');
  }
});
controller.on('runState', (rs) => {
  if (rs === 'running') audio.play('run');
  else if (rs === 'won') audio.play('win');
  else if (rs === 'settled') audio.play('settle');
});

const pointer = new PointerInput(canvas, wrap, controller, renderer, hooks);
new Toolbox(document.querySelector('.bin')!, controller, (start) => pointer.beginBinDrag(start));
new Hud(
  document.querySelector('.topbar')!,
  document.querySelector('.bottombar')!,
  controller,
  hooks,
);

// ── Level editor (M6) ──────────────────────────────────────────────
let testingDef: LevelDef | null = null;
const backBtn = document.createElement('button');
backBtn.textContent = '← Back to Editor';
backBtn.className = 'back-to-editor hidden';
backBtn.dataset.testid = 'back-to-editor';
document.body.appendChild(backBtn);

function hideBackToEditor(): void {
  backBtn.classList.add('hidden');
}

const editor = new LevelEditor(controller, renderer, canvas, pointer, {
  onPlayTest(def) {
    testingDef = def;
    editor.exit();
    currentLevelId = null;
    controller.loadScene(levelToScene(def), 'puzzle');
    backBtn.classList.remove('hidden');
    showToast('Play-testing — solve it like a player would!');
  },
});

backBtn.addEventListener('click', () => {
  hideBackToEditor();
  if (testingDef) editor.enter(testingDef);
});

function openLevelSelect(): void {
  showLevelSelect(
    (id) => {
      if (controller.mode === 'editor') editor.exit();
      hideBackToEditor();
      if (id.startsWith('custom-')) {
        const def = getCustomLevel(id);
        if (def) {
          currentLevelId = id;
          controller.loadScene(levelToScene(def), 'puzzle');
        }
      } else {
        loadLevelById(id);
      }
    },
    savedCustomLevels().map((l) => ({ id: l.id, title: l.title })),
  );
}

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
    openLevelSelect();
  },
});

const loop = new FixedLoop(
  () => controller.tickRun(),
  (alpha) =>
    renderer.render(controller.sim, controller.runState === 'running' ? alpha : 1, (g) => {
      drawGoalZones(g, goalZones(controller.scene?.goal), controller.sim?.stepIndex ?? 0);
      editor.drawOverlay(g);
      pointer.drawOverlay(g);
    }),
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
  api.extras.editorEnter = () => hooks.onMode('editor');
  api.extras.editorSerialize = () => editor.serialize();
  api.extras.editorSave = () => editor.save();
  api.extras.editorLoadDef = (def: LevelDef) => editor.loadDef(def);
  api.extras.editorSetDraft = (patch: Record<string, unknown>) => {
    Object.assign(editor.draft, patch);
    editor.refreshAll();
  };
  api.extras.editorPlayTest = () => editor.playTest();
  api.extras.listCustomLevels = () => savedCustomLevels().map((l) => ({ id: l.id, title: l.title }));
}
