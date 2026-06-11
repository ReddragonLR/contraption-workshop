import type { GameController } from '../modes/controller';
import { burstConfetti } from './confetti';

export interface ModalAction {
  label: string;
  testid: string;
  primary?: boolean;
  onClick(): void;
}

let openModal: HTMLElement | null = null;

export function closeModal(): void {
  openModal?.remove();
  openModal = null;
}

export function showModal(opts: {
  testid: string;
  title: string;
  body?: string | HTMLElement;
  actions: ModalAction[];
}): HTMLElement {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.dataset.testid = opts.testid;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', opts.title);
  const h = document.createElement('h2');
  h.textContent = opts.title;
  modal.appendChild(h);
  if (typeof opts.body === 'string') {
    const p = document.createElement('p');
    p.textContent = opts.body;
    modal.appendChild(p);
  } else if (opts.body) {
    modal.appendChild(opts.body);
  }
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  for (const a of opts.actions) {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    btn.dataset.testid = a.testid;
    if (a.primary) btn.classList.add('primary');
    btn.addEventListener('click', () => {
      closeModal();
      a.onClick();
    });
    actions.appendChild(btn);
  }
  modal.appendChild(actions);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  openModal = backdrop;
  (actions.querySelector('button.primary') as HTMLButtonElement | null)?.focus();
  return backdrop;
}

export interface RunModalHooks {
  onNextLevel(): void;
  hasNextLevel(): boolean;
  onLevelSelect(): void;
  onSolved(levelId: string): void;
}

/** Watches the controller and pops Win / Settled modals (PRD §9). */
export function bindRunModals(controller: GameController, hooks: RunModalHooks): void {
  controller.on('runState', (rs) => {
    if (rs === 'won') {
      const sceneId = controller.scene?.id;
      if (controller.mode === 'puzzle' && sceneId) hooks.onSolved(sceneId);
      burstConfetti();
      showModal({
        testid: 'modal-win',
        title: 'Solved!',
        body: 'The contraption worked — gloriously over-engineered.',
        actions: [
          ...(hooks.hasNextLevel()
            ? [
                {
                  label: 'Next Level →',
                  testid: 'btn-next-level',
                  primary: true,
                  onClick: () => hooks.onNextLevel(),
                },
              ]
            : []),
          {
            label: 'Watch Again',
            testid: 'btn-replay',
            onClick: () => {
              controller.reset();
              controller.run();
            },
          },
          {
            label: 'Keep Tinkering',
            testid: 'btn-tinker',
            onClick: () => controller.reset(),
          },
          {
            label: 'All Levels',
            testid: 'btn-win-levels',
            onClick: () => hooks.onLevelSelect(),
          },
        ],
      });
    } else if (rs === 'settled') {
      showModal({
        testid: 'modal-settled',
        title: 'Hmm, it settled…',
        body: 'The machine ran out of momentum before reaching the goal. Tweak the contraption and try again!',
        actions: [
          {
            label: '↺ Back to Building',
            testid: 'btn-settle-reset',
            primary: true,
            onClick: () => controller.reset(),
          },
        ],
      });
    }
  });
}
