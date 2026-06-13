import { allLevels } from '../levels';
import { solvedLevels } from '../store/progress';
import { closeModal, showModal } from './modals';

/** Level-select grid with solved checkmarks + custom levels (PRD §9). */
export function showLevelSelect(
  onPick: (levelId: string) => void,
  customs: { id: string; title: string }[] = [],
): void {
  const solved = solvedLevels();
  const grid = document.createElement('div');
  grid.className = 'level-grid';
  const addCard = (id: string, num: string, title: string): void => {
    const card = document.createElement('button');
    card.className = 'level-card';
    card.dataset.testid = `level-card-${id}`;
    // Build with textContent — titles come from untrusted level JSON, so never
    // interpolate them into innerHTML (would be a stored-XSS sink).
    const mk = (cls: string, text: string): HTMLElement => {
      const el = document.createElement('span');
      el.className = cls;
      el.textContent = text;
      return el;
    };
    card.append(
      mk('num', num),
      mk('name', title),
      mk('check', solved.has(id) ? '✓ Solved' : ''),
    );
    card.addEventListener('click', () => {
      closeModal();
      onPick(id);
    });
    grid.appendChild(card);
  };
  allLevels().forEach((lvl, i) => addCard(lvl.id, `#${String(i + 1).padStart(2, '0')}`, lvl.title));
  customs.forEach((lvl) => addCard(lvl.id, '🔧', lvl.title));
  showModal({
    testid: 'modal-levels',
    title: 'Choose a Puzzle',
    body: grid,
    actions: [{ label: 'Close', testid: 'btn-levels-close', onClick: () => {} }],
  });
}
