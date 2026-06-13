import type { GameController } from '../modes/controller';
import { getPart } from '../parts/registry';
import type { PartCategory } from '../parts/types';

const ICON_SCALE = 2; // rasterize at 2× for crisp hi-dpi rendering
const iconCache = new Map<string, string>();

function iconDataUrl(partId: string): string {
  const cached = iconCache.get(partId);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 52 * ICON_SCALE;
  c.height = 52 * ICON_SCALE;
  const g = c.getContext('2d')!;
  g.scale(ICON_SCALE, ICON_SCALE);
  g.translate(26, 26);
  getPart(partId).drawIcon(g, 52);
  const url = c.toDataURL();
  iconCache.set(partId, url);
  return url;
}

const CATEGORY_ORDER: PartCategory[] = ['balls', 'structure', 'mechanisms', 'containers'];
const CATEGORY_LABELS: Record<PartCategory, string> = {
  balls: 'Balls',
  structure: 'Structure',
  mechanisms: 'Mechanisms',
  containers: 'Containers',
};

export interface BinDragStart {
  slotIndex: number;
  partId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
}

/**
 * The parts bin (left rail): category-grouped tiles with live counts.
 * Tiles are drag sources; the actual drag is owned by pointerInput.
 */
export class Toolbox {
  private root: HTMLElement;

  constructor(
    root: HTMLElement,
    private controller: GameController,
    private onDragStart: (start: BinDragStart) => void,
    /** Keyboard activation (Enter/Space on a tile): place at the grid cursor. */
    private onActivate: (slotIndex: number) => void,
  ) {
    this.root = root;
    controller.on('change', () => this.refreshCounts());
    controller.on('scene', () => this.rebuild());
    this.rebuild();
  }

  rebuild(): void {
    this.root.innerHTML = '<h2>Parts Bin</h2>';
    const byCategory = new Map<PartCategory, number[]>();
    this.controller.bin.forEach((slot, i) => {
      const def = getPart(slot.partId);
      const list = byCategory.get(def.category) ?? [];
      list.push(i);
      byCategory.set(def.category, list);
    });
    for (const cat of CATEGORY_ORDER) {
      const slots = byCategory.get(cat);
      if (!slots?.length) continue;
      const label = document.createElement('div');
      label.className = 'bin-category';
      label.textContent = CATEGORY_LABELS[cat];
      this.root.appendChild(label);
      const grid = document.createElement('div');
      grid.className = 'bin-grid';
      for (const slotIndex of slots) grid.appendChild(this.buildTile(slotIndex));
      this.root.appendChild(grid);
    }
    this.refreshCounts();
  }

  private buildTile(slotIndex: number): HTMLElement {
    const slot = this.controller.bin[slotIndex];
    const def = getPart(slot.partId);
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.testid = `bin-tile-${def.id}`;
    tile.dataset.slot = String(slotIndex);
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', `${def.name}, ${slot.count} available. ${def.description}`);
    tile.tabIndex = 0;
    tile.title = def.description;

    // Rasterize the icon once to an <img>; live canvases can drop their
    // buffers when Chromium hibernates them, an img never does.
    const icon = document.createElement('img');
    icon.src = iconDataUrl(def.id);
    icon.alt = '';
    icon.width = 52;
    icon.height = 52;
    icon.draggable = false;
    tile.appendChild(icon);

    const name = document.createElement('div');
    name.className = 'tile-name';
    name.textContent = def.name;
    tile.appendChild(name);

    const count = document.createElement('div');
    count.className = 'count';
    count.dataset.testid = `bin-count-${def.id}`;
    tile.appendChild(count);

    tile.addEventListener('pointerdown', (e) => {
      const s = this.controller.bin[slotIndex];
      if (!s || s.count <= 0 || !this.controller.editing) return;
      e.preventDefault();
      this.onDragStart({
        slotIndex,
        partId: s.partId,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    });
    // Keyboard placement: Enter/Space drops the part at the grid cursor, then
    // arrow keys nudge and [ ] rotate it (handled in PointerInput).
    tile.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const s = this.controller.bin[slotIndex];
      if (!s || s.count <= 0 || !this.controller.editing) return;
      e.preventDefault();
      e.stopPropagation();
      this.onActivate(slotIndex);
    });
    return tile;
  }

  refreshCounts(): void {
    this.root.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
      const slot = this.controller.bin[Number(tile.dataset.slot)];
      if (!slot) return;
      const badge = tile.querySelector<HTMLElement>('.count')!;
      badge.textContent = String(slot.count);
      tile.classList.toggle('empty', slot.count <= 0);
    });
  }
}
