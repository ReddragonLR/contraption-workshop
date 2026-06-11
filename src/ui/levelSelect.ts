import { allLevels } from '../levels';
import { solvedLevels } from '../store/progress';
import { closeModal, showModal } from './modals';

/** Level-select grid with solved checkmarks (PRD §9). */
export function showLevelSelect(onPick: (levelId: string) => void): void {
  const solved = solvedLevels();
  const grid = document.createElement('div');
  grid.className = 'level-grid';
  allLevels().forEach((lvl, i) => {
    const card = document.createElement('button');
    card.className = 'level-card';
    card.dataset.testid = `level-card-${lvl.id}`;
    const isSolved = solved.has(lvl.id);
    card.innerHTML = `
      <span class="num">#${String(i + 1).padStart(2, '0')}</span>
      <span class="name">${lvl.title}</span>
      <span class="check">${isSolved ? '✓ Solved' : ''}</span>
    `;
    card.addEventListener('click', () => {
      closeModal();
      onPick(lvl.id);
    });
    grid.appendChild(card);
  });
  showModal({
    testid: 'modal-levels',
    title: 'Choose a Puzzle',
    body: grid,
    actions: [{ label: 'Close', testid: 'btn-levels-close', onClick: () => {} }],
  });
}
