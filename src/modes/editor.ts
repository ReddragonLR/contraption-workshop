import type { GameController, SceneSetup } from './controller';
import type { Renderer } from '../render/renderer';
import type { PointerInput } from '../ui/pointerInput';
import type { LevelDef, LevelPartEntry } from '../levels/types';
import type { GoalDef } from '../engine/winDetect';
import type { OptionValue, Placement } from '../parts/types';
import { allParts, getPart, defaultOptions } from '../parts/registry';
import { validateLevel } from '../levels/schema';
import { saveCustomLevel, customLevelId } from '../store/editorStore';
import { showToast } from '../ui/toast';
import { palette } from '../parts/palette';
import { snap, type Rect } from '../util/math';

const WORLD = { width: 960, height: 600, gravity: { x: 0, y: 1 } };
const EDITOR_STOCK = 99;

interface BinRow {
  partId: string;
  count: number;
}

interface Draft {
  title: string;
  hint: string;
  goalType: 'object-in-zone' | 'device-on' | 'objects-collide';
  goalDescription: string;
  objectTag: string;
  deviceTag: string;
  tagA: string;
  tagB: string;
  sustainMs: number;
  zone: Rect | null;
  bin: BinRow[];
}

const freshDraft = (): Draft => ({
  title: 'My Contraption',
  hint: '',
  goalType: 'object-in-zone',
  goalDescription: 'Get the ball into the target.',
  objectTag: '',
  deviceTag: '',
  tagA: '',
  tagB: '',
  sustainMs: 300,
  zone: null,
  bin: [{ partId: 'ramp', count: 2 }],
});

/**
 * Level editor (PRD §3, M6): place parts, mark them bolted-down, tag them,
 * define a goal + zone, configure the player bin, then save/load/play.
 * Reuses the exact placement machinery the game uses; locked-ness is held
 * in a side-set so everything stays draggable while editing.
 */
export class LevelEditor {
  draft: Draft = freshDraft();
  /** instanceIds exported as fixedParts. */
  private lockMarks = new Set<string>();
  private panel: HTMLElement;
  private zoneDrawing = false;
  private zoneStart: { x: number; y: number } | null = null;
  active = false;

  constructor(
    private controller: GameController,
    private renderer: Renderer,
    private canvas: HTMLCanvasElement,
    private pointer: PointerInput,
    private hooks: { onPlayTest(def: LevelDef): void },
  ) {
    this.panel = this.buildPanel();
    controller.on('change', () => {
      if (this.active) this.refreshSelection();
    });
    canvas.addEventListener('pointerdown', this.onZoneDown);
    window.addEventListener('pointermove', this.onZoneMove);
    window.addEventListener('pointerup', this.onZoneUp);
  }

  // ── Mode lifecycle ───────────────────────────────────────────────

  enter(def?: LevelDef): void {
    this.active = true;
    if (def) this.loadDef(def);
    else this.controller.loadScene(this.editorScene([]), 'editor');
    this.panel.classList.remove('hidden');
    this.refreshAll();
  }

  exit(): void {
    this.active = false;
    this.zoneDrawing = false;
    this.pointer.suspended = false;
    this.panel.classList.add('hidden');
  }

  private editorScene(placements: Placement[]): SceneSetup {
    return {
      id: 'editor',
      title: 'Level Editor',
      world: { ...WORLD },
      placements,
      bin: allParts()
        .filter((d) => d.movableByPlayer)
        .map((d) => ({ partId: d.id, count: EDITOR_STOCK })),
      goalDescription: 'Design your own contraption!',
    };
  }

  // ── Serialization ────────────────────────────────────────────────

  /** Build a LevelDef from the canvas + form. Throws if invalid. */
  serialize(): LevelDef {
    const placements = this.controller.placements;
    // Linked parts (rope endpoints/via) must carry tags to survive JSON.
    const tagOf = new Map<string, string>();
    let autoTag = 0;
    const ensureTag = (instanceId: string): string => {
      const p = placements.find((q) => q.instanceId === instanceId);
      if (!p) return instanceId; // already a tag
      if (!p.tag) p.tag = `part-${++autoTag}${p.tag ?? ''}`;
      tagOf.set(instanceId, p.tag);
      return p.tag;
    };

    const toEntry = (p: Placement): LevelPartEntry => {
      const def = getPart(p.partId);
      const defaults = defaultOptions(def);
      const options: Record<string, OptionValue> = {};
      for (const [k, v] of Object.entries(p.options)) {
        if (defaults[k] !== v) options[k] = v;
      }
      return {
        partId: p.partId,
        x: p.x,
        y: p.y,
        ...(p.rotation ? { rotation: p.rotation } : {}),
        ...(p.tag ? { tag: p.tag } : {}),
        ...(Object.keys(options).length ? { options } : {}),
        ...(p.link
          ? {
              link: {
                a: { ref: ensureTag(p.link.a.ref), anchorId: p.link.a.anchorId },
                b: { ref: ensureTag(p.link.b.ref), anchorId: p.link.b.anchorId },
                ...(p.link.via?.length ? { via: p.link.via.map(ensureTag) } : {}),
              },
            }
          : {}),
      };
    };

    const goal = this.buildGoal();
    const def: LevelDef = {
      id: customLevelId(this.draft.title),
      title: this.draft.title.trim() || 'Untitled',
      version: 1,
      world: { ...WORLD, airPressure: 1 },
      goal,
      fixedParts: placements.filter((p) => this.lockMarks.has(p.instanceId)).map(toEntry),
      placedParts: placements.filter((p) => !this.lockMarks.has(p.instanceId)).map(toEntry),
      bin: this.draft.bin
        .filter((r) => r.count > 0)
        .map((r) => ({ partId: r.partId, count: r.count })),
      ...(this.draft.hint.trim() ? { hint: this.draft.hint.trim() } : {}),
    };
    return validateLevel(JSON.parse(JSON.stringify(def)));
  }

  private buildGoal(): GoalDef {
    const d = this.draft;
    const description = d.goalDescription.trim() || 'Solve it!';
    switch (d.goalType) {
      case 'object-in-zone':
        if (!d.zone) throw new Error('Draw a goal zone first (Goal → Draw zone).');
        if (!d.objectTag) throw new Error('Pick which object must reach the zone.');
        return {
          type: 'object-in-zone',
          objectTag: d.objectTag,
          zone: d.zone,
          sustainMs: d.sustainMs,
          description,
        };
      case 'device-on':
        if (!d.deviceTag) throw new Error('Pick which device must turn on.');
        return { type: 'device-on', deviceTag: d.deviceTag, description };
      case 'objects-collide':
        if (!d.tagA || !d.tagB) throw new Error('Pick the two objects that must touch.');
        return { type: 'objects-collide', tagA: d.tagA, tagB: d.tagB, description };
    }
  }

  loadDef(def: LevelDef): void {
    this.draft = freshDraft();
    this.draft.title = def.title;
    this.draft.hint = def.hint ?? '';
    this.draft.bin = def.bin.map((b) => ({ partId: b.partId, count: b.count }));
    const g = def.goal;
    this.draft.goalDescription = g.description;
    if (g.type === 'object-in-zone') {
      this.draft.goalType = 'object-in-zone';
      this.draft.objectTag = g.objectTag;
      this.draft.zone = { ...g.zone };
      this.draft.sustainMs = g.sustainMs ?? 300;
    } else if (g.type === 'device-on') {
      this.draft.goalType = 'device-on';
      this.draft.deviceTag = g.deviceTag;
    } else if (g.type === 'objects-collide') {
      this.draft.goalType = 'objects-collide';
      this.draft.tagA = g.tagA;
      this.draft.tagB = g.tagB;
    } else {
      showToast('Composite goals are view-only in the editor for now.');
    }

    this.controller.loadScene(this.editorScene([]), 'editor');
    this.lockMarks.clear();
    // Re-place every part through the controller so ids/links resolve.
    const placedIds: string[] = [];
    const place = (entry: LevelPartEntry, locked: boolean): void => {
      if (entry.link) return; // connectors second pass
      const slot = this.controller.bin.findIndex((s) => s.partId === entry.partId);
      const p = this.controller.placeFromBin(slot, entry.x, entry.y, entry.rotation ?? 0);
      if (!p) return;
      p.tag = entry.tag;
      for (const [k, v] of Object.entries(entry.options ?? {})) {
        this.controller.setOption(p.instanceId, k, v);
      }
      if (locked) this.lockMarks.add(p.instanceId);
      placedIds.push(p.instanceId);
    };
    def.fixedParts.forEach((e) => place(e, true));
    def.placedParts.forEach((e) => place(e, false));
    for (const entry of [...def.fixedParts, ...def.placedParts]) {
      if (!entry.link) continue;
      const slot = this.controller.bin.findIndex((s) => s.partId === entry.partId);
      this.controller.placeRope(slot, entry.link, entry.x, entry.y);
    }
    this.controller.select(null);
    this.refreshAll();
  }

  // ── Zone drawing ─────────────────────────────────────────────────

  private startZoneDraw(): void {
    this.zoneDrawing = true;
    this.pointer.suspended = true;
    this.canvas.style.cursor = 'crosshair';
    showToast('Drag a rectangle where the goal zone should be.');
  }

  private onZoneDown = (e: PointerEvent): void => {
    if (!this.active || !this.zoneDrawing) return;
    const w = this.renderer.screenToWorld(e.clientX, e.clientY);
    this.zoneStart = { x: snap(w.x, 10), y: snap(w.y, 10) };
  };

  private onZoneMove = (e: PointerEvent): void => {
    if (!this.active || !this.zoneDrawing || !this.zoneStart) return;
    const w = this.renderer.screenToWorld(e.clientX, e.clientY);
    this.draft.zone = normRect(this.zoneStart, { x: snap(w.x, 10), y: snap(w.y, 10) });
  };

  private onZoneUp = (): void => {
    if (!this.active || !this.zoneDrawing || !this.zoneStart) return;
    this.zoneDrawing = false;
    this.zoneStart = null;
    this.pointer.suspended = false;
    this.canvas.style.cursor = '';
    if (this.draft.zone && (this.draft.zone.w < 20 || this.draft.zone.h < 20)) {
      this.draft.zone = null;
      showToast('Zone too small — try again.');
    }
  };

  drawOverlay = (g: CanvasRenderingContext2D): void => {
    if (!this.active) return;
    if (this.draft.zone) {
      const z = this.draft.zone;
      g.save();
      g.fillStyle = 'rgba(232,163,61,0.12)';
      g.fillRect(z.x, z.y, z.w, z.h);
      g.strokeStyle = palette.brass;
      g.setLineDash([8, 6]);
      g.lineWidth = 2.5;
      g.strokeRect(z.x, z.y, z.w, z.h);
      g.setLineDash([]);
      g.restore();
    }
    // Mark bolted-down parts with a lock glyph.
    for (const p of this.controller.placements) {
      if (!this.lockMarks.has(p.instanceId)) continue;
      g.save();
      g.font = '13px sans-serif';
      g.fillStyle = 'rgba(45,42,38,0.7)';
      g.fillText('🔩', p.x - 6, p.y + 5);
      g.restore();
    }
  };

  // ── Panel DOM ────────────────────────────────────────────────────

  private buildPanel(): HTMLElement {
    const el = document.createElement('aside');
    el.className = 'editor-panel hidden';
    el.innerHTML = `
      <h3>Level Editor</h3>
      <label>Title <input data-ed="title" maxlength="48"></label>
      <label>Hint <input data-ed="hint" maxlength="120"></label>
      <fieldset>
        <legend>Goal</legend>
        <label>Type
          <select data-ed="goalType">
            <option value="object-in-zone">Object reaches zone</option>
            <option value="device-on">Device turns on</option>
            <option value="objects-collide">Two objects touch</option>
          </select>
        </label>
        <label>Goal text <input data-ed="goalDescription" maxlength="90"></label>
        <div data-ed-section="object-in-zone">
          <label>Object <select data-ed="objectTag"></select></label>
          <button data-ed="drawZone">▦ Draw zone</button>
          <span data-ed="zoneInfo" class="ed-dim"></span>
        </div>
        <div data-ed-section="device-on">
          <label>Device <select data-ed="deviceTag"></select></label>
        </div>
        <div data-ed-section="objects-collide">
          <label>Object A <select data-ed="tagA"></select></label>
          <label>Object B <select data-ed="tagB"></select></label>
        </div>
      </fieldset>
      <fieldset data-ed="selection">
        <legend>Selected part</legend>
        <div class="ed-dim" data-ed="selNone">Click a placed part to edit it.</div>
        <div data-ed="selControls" class="hidden">
          <label><input type="checkbox" data-ed="selLocked"> Bolted down (fixed)</label>
          <label>Tag <input data-ed="selTag" maxlength="24" placeholder="e.g. ball-1"></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Player's bin</legend>
        <div data-ed="binRows"></div>
        <button data-ed="binAdd">+ Add part</button>
      </fieldset>
      <div class="ed-actions">
        <button data-ed="play" class="primary" data-testid="editor-play">▶ Play-test</button>
        <button data-ed="save" data-testid="editor-save">💾 Save</button>
        <button data-ed="download" data-testid="editor-download">⬇ Download</button>
        <button data-ed="upload" data-testid="editor-upload">⬆ Load file</button>
        <button data-ed="new" data-testid="editor-new">✨ New</button>
      </div>
      <input type="file" accept=".json,application/json" data-ed="file" class="hidden">
    `;
    document.body.appendChild(el);

    const q = <T extends HTMLElement>(sel: string): T => el.querySelector(`[data-ed="${sel}"]`) as T;
    q<HTMLInputElement>('title').addEventListener('input', (e) => {
      this.draft.title = (e.target as HTMLInputElement).value;
    });
    q<HTMLInputElement>('hint').addEventListener('input', (e) => {
      this.draft.hint = (e.target as HTMLInputElement).value;
    });
    q<HTMLInputElement>('goalDescription').addEventListener('input', (e) => {
      this.draft.goalDescription = (e.target as HTMLInputElement).value;
    });
    q<HTMLSelectElement>('goalType').addEventListener('change', (e) => {
      this.draft.goalType = (e.target as HTMLSelectElement).value as Draft['goalType'];
      this.refreshGoalSections();
    });
    for (const key of ['objectTag', 'deviceTag', 'tagA', 'tagB'] as const) {
      q<HTMLSelectElement>(key).addEventListener('change', (e) => {
        this.draft[key] = (e.target as HTMLSelectElement).value;
      });
    }
    q('drawZone').addEventListener('click', () => this.startZoneDraw());
    q('binAdd').addEventListener('click', () => {
      this.draft.bin.push({ partId: 'ramp', count: 1 });
      this.refreshBinRows();
    });
    q<HTMLInputElement>('selLocked').addEventListener('change', (e) => {
      const id = this.controller.selectedId;
      if (!id) return;
      if ((e.target as HTMLInputElement).checked) this.lockMarks.add(id);
      else this.lockMarks.delete(id);
    });
    q<HTMLInputElement>('selTag').addEventListener('input', (e) => {
      const id = this.controller.selectedId;
      const p = id ? this.controller.placementById(id) : null;
      if (p) {
        p.tag = (e.target as HTMLInputElement).value.trim() || undefined;
        this.refreshTagSelects();
      }
    });
    q('play').addEventListener('click', () => this.playTest());
    q('save').addEventListener('click', () => this.save());
    q('download').addEventListener('click', () => this.download());
    q('upload').addEventListener('click', () => q<HTMLInputElement>('file').click());
    q<HTMLInputElement>('file').addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const def = validateLevel(JSON.parse(await file.text()));
        this.loadDef(def);
        showToast(`Loaded “${def.title}”.`);
      } catch (err) {
        showToast(`Couldn't load: ${(err as Error).message.split('\n')[0]}`);
      }
      (e.target as HTMLInputElement).value = '';
    });
    q('new').addEventListener('click', () => {
      this.draft = freshDraft();
      this.lockMarks.clear();
      this.controller.loadScene(this.editorScene([]), 'editor');
      this.refreshAll();
    });
    return el;
  }

  playTest(): void {
    try {
      const def = this.serialize();
      this.hooks.onPlayTest(def);
    } catch (err) {
      showToast((err as Error).message.split('\n')[0]);
    }
  }

  save(): LevelDef | null {
    try {
      const def = this.serialize();
      saveCustomLevel(def);
      showToast(`Saved “${def.title}” — it's in the Levels list.`);
      return def;
    } catch (err) {
      showToast((err as Error).message.split('\n')[0]);
      return null;
    }
  }

  private download(): void {
    try {
      const def = this.serialize();
      const blob = new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${def.id}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      showToast((err as Error).message.split('\n')[0]);
    }
  }

  // ── Refresh helpers ──────────────────────────────────────────────

  private q<T extends HTMLElement>(sel: string): T {
    return this.panel.querySelector(`[data-ed="${sel}"]`) as T;
  }

  refreshAll(): void {
    this.q<HTMLInputElement>('title').value = this.draft.title;
    this.q<HTMLInputElement>('hint').value = this.draft.hint;
    this.q<HTMLInputElement>('goalDescription').value = this.draft.goalDescription;
    this.q<HTMLSelectElement>('goalType').value = this.draft.goalType;
    this.refreshGoalSections();
    this.refreshTagSelects();
    this.refreshBinRows();
    this.refreshSelection();
  }

  private refreshGoalSections(): void {
    this.panel.querySelectorAll<HTMLElement>('[data-ed-section]').forEach((s) => {
      s.classList.toggle('hidden', s.dataset.edSection !== this.draft.goalType);
    });
    const z = this.draft.zone;
    this.q('zoneInfo').textContent = z ? `${z.w}×${z.h} @ (${z.x},${z.y})` : 'no zone yet';
  }

  private refreshTagSelects(): void {
    const tags = this.controller.placements.filter((p) => p.tag).map((p) => p.tag!) ?? [];
    for (const key of ['objectTag', 'deviceTag', 'tagA', 'tagB'] as const) {
      const sel = this.q<HTMLSelectElement>(key);
      const current = this.draft[key];
      sel.innerHTML =
        '<option value="">— pick —</option>' +
        tags.map((t) => `<option value="${t}">${t}</option>`).join('');
      sel.value = tags.includes(current) ? current : '';
      this.draft[key] = sel.value;
    }
  }

  private refreshBinRows(): void {
    const host = this.q('binRows');
    host.innerHTML = '';
    const partOptions = allParts()
      .filter((d) => d.movableByPlayer && !d.connector)
      .map((d) => `<option value="${d.id}">${d.name}</option>`)
      .join('');
    this.draft.bin.forEach((row, i) => {
      const div = document.createElement('div');
      div.className = 'ed-bin-row';
      div.innerHTML = `
        <select>${partOptions}</select>
        <input type="number" min="0" max="20" value="${row.count}">
        <button title="Remove">✕</button>
      `;
      const sel = div.querySelector('select')!;
      sel.value = row.partId;
      sel.addEventListener('change', () => {
        row.partId = sel.value;
      });
      const num = div.querySelector('input')!;
      num.addEventListener('input', () => {
        row.count = Math.max(0, Math.min(20, Number(num.value) || 0));
      });
      div.querySelector('button')!.addEventListener('click', () => {
        this.draft.bin.splice(i, 1);
        this.refreshBinRows();
      });
      host.appendChild(div);
    });
  }

  private refreshSelection(): void {
    const id = this.controller.selectedId;
    const p = id ? this.controller.placementById(id) : null;
    this.q('selNone').classList.toggle('hidden', !!p);
    this.q('selControls').classList.toggle('hidden', !p);
    if (p) {
      this.q<HTMLInputElement>('selLocked').checked = this.lockMarks.has(p.instanceId);
      const tagInput = this.q<HTMLInputElement>('selTag');
      if (document.activeElement !== tagInput) tagInput.value = p.tag ?? '';
    }
    this.refreshTagSelects();
  }
}

function normRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}
