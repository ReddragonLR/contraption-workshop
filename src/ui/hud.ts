import type { GameController, Mode } from '../modes/controller';
import { showToast } from './toast';

export interface HudHooks {
  onRun(): void;
  onStop(): void;
  onReset(): void;
  onSpeed(speed: number): void;
  onMode(mode: Mode): void;
  onLevels(): void;
  onMute(): void;
  isMuted(): boolean;
}

const STATE_LABELS: Record<string, string> = {
  editing: 'Building',
  running: 'Running…',
  won: 'Solved!',
  settled: 'Settled',
};

/** Top bar (title, goal, mode switch) + bottom bar (run controls). */
export class Hud {
  private speed = 1;

  constructor(
    private top: HTMLElement,
    private bottom: HTMLElement,
    private controller: GameController,
    private hooks: HudHooks,
  ) {
    this.buildTop();
    this.buildBottom();
    controller.on('change', () => this.refresh());
    controller.on('scene', () => this.refresh());
    this.refresh();
  }

  private buildTop(): void {
    this.top.innerHTML = `
      <div class="brand">Contraption Workshop</div>
      <div class="level-info">
        <span class="level-title" data-testid="level-title"></span>
        <span class="goal-note" data-testid="goal-text"></span>
      </div>
      <div class="actions">
        <button class="ghosted" data-testid="btn-hint" title="Show hint" aria-label="Show hint">💡</button>
        <button data-testid="btn-levels" title="Choose a puzzle">Levels</button>
        <div class="seg" role="group" aria-label="Mode">
          <button data-mode="puzzle" data-testid="mode-puzzle">Puzzle</button>
          <button data-mode="sandbox" data-testid="mode-sandbox">Sandbox</button>
          <button data-mode="editor" data-testid="mode-editor">Editor</button>
        </div>
        <button class="ghosted" data-testid="btn-mute" title="Toggle sound" aria-label="Toggle sound">🔊</button>
      </div>
    `;
    this.top.querySelector('[data-testid=btn-levels]')!.addEventListener('click', () => {
      this.hooks.onLevels();
    });
    this.top.querySelector('[data-testid=btn-hint]')!.addEventListener('click', () => {
      showToast(this.controller.scene?.hint ?? 'No hint for this one — wing it!');
    });
    this.top.querySelectorAll<HTMLButtonElement>('.seg button').forEach((btn) => {
      btn.addEventListener('click', () => this.hooks.onMode(btn.dataset.mode as Mode));
    });
    this.top.querySelector('[data-testid=btn-mute]')!.addEventListener('click', () => {
      this.hooks.onMute();
      this.refresh();
    });
  }

  private buildBottom(): void {
    this.bottom.innerHTML = `
      <button class="primary" data-testid="btn-run">▶ RUN</button>
      <button class="danger" data-testid="btn-stop">⏹ STOP</button>
      <button data-testid="btn-reset">↺ RESET</button>
      <button class="ghosted" data-testid="btn-speed" aria-pressed="false" title="Run speed">1×</button>
      <div class="run-status" data-testid="run-status" data-state="editing" role="status">
        <span class="dot"></span><span class="label">Building</span>
      </div>
    `;
    this.q('btn-run').addEventListener('click', () => this.hooks.onRun());
    this.q('btn-stop').addEventListener('click', () => this.hooks.onStop());
    this.q('btn-reset').addEventListener('click', () => this.hooks.onReset());
    this.q('btn-speed').addEventListener('click', () => {
      this.speed = this.speed === 1 ? 2 : 1;
      const btn = this.q('btn-speed');
      btn.textContent = `${this.speed}×`;
      btn.setAttribute('aria-pressed', String(this.speed === 2));
      this.hooks.onSpeed(this.speed);
    });
  }

  private q(id: string): HTMLButtonElement {
    return (this.top.querySelector(`[data-testid=${id}]`) ??
      this.bottom.querySelector(`[data-testid=${id}]`)) as HTMLButtonElement;
  }

  refresh(): void {
    const c = this.controller;
    const title = this.top.querySelector('[data-testid=level-title]')!;
    const goal = this.top.querySelector('[data-testid=goal-text]')!;
    title.textContent = c.scene?.title ?? '';
    goal.textContent = c.scene?.goalDescription ? `“${c.scene.goalDescription}”` : '';
    (goal as HTMLElement).title = c.scene?.goalDescription ?? '';
    const hintBtn = this.top.querySelector<HTMLElement>('[data-testid=btn-hint]')!;
    hintBtn.style.visibility = c.scene?.hint ? 'visible' : 'hidden';
    this.top.querySelectorAll<HTMLButtonElement>('.seg button').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === c.mode));
    });
    const muteBtn = this.q('btn-mute');
    muteBtn.textContent = this.hooks.isMuted() ? '🔇' : '🔊';

    this.q('btn-run').disabled = c.runState === 'running';
    this.q('btn-stop').disabled = c.runState === 'editing';
    const status = this.bottom.querySelector<HTMLElement>('[data-testid=run-status]')!;
    status.dataset.state = c.runState;
    status.querySelector('.label')!.textContent = STATE_LABELS[c.runState] ?? c.runState;
  }
}
