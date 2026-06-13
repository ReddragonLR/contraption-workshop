import type { GameController } from '../modes/controller';
import { burstConfetti } from './confetti';

export interface ModalAction {
  label: string;
  testid: string;
  primary?: boolean;
  onClick(): void;
}

let openModal: HTMLElement | null = null;
let modalKeydown: ((e: KeyboardEvent) => void) | null = null;
let restoreFocus: HTMLElement | null = null;

function focusable(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !el.hasAttribute('disabled'));
}

export function closeModal(): void {
  if (modalKeydown) {
    document.removeEventListener('keydown', modalKeydown, true);
    modalKeydown = null;
  }
  document.getElementById('app')?.removeAttribute('aria-hidden');
  openModal?.remove();
  openModal = null;
  // Restore focus to wherever it was before the modal opened (PRD §10).
  restoreFocus?.focus();
  restoreFocus = null;
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
  restoreFocus = document.activeElement as HTMLElement | null;
  document.body.appendChild(backdrop);
  openModal = backdrop;
  // Background is inert while the dialog is open, so aria-modal is truthful.
  document.getElementById('app')?.setAttribute('aria-hidden', 'true');

  // Keyboard: Escape closes; Tab/Shift+Tab cycle within the dialog (focus trap).
  modalKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    } else if (e.key === 'Tab') {
      const items = focusable(modal);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && (active === first || !modal.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', modalKeydown, true);

  const primary = actions.querySelector('button.primary') as HTMLButtonElement | null;
  (primary ?? focusable(modal)[0])?.focus();
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
