/**
 * Tiny WebAudio synth for UI/game feedback (PRD §10). All sounds are
 * generated — no assets. The context is created lazily on first user gesture
 * (no autoplay surprises); everything respects the mute toggle.
 */
export type SfxName =
  | 'place'
  | 'delete'
  | 'rotate'
  | 'invalid'
  | 'run'
  | 'stop'
  | 'win'
  | 'settle'
  | 'bounce'
  | 'pop'
  | 'press'
  | 'cut';

export class AudioEngine {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private lastBounce = 0;

  constructor(muted: boolean) {
    this.muted = muted;
    const unlock = () => {
      this.ensure()?.resume();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  play(name: SfxName, intensity = 1): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'place':
        this.blip(ctx, t, 440, 660, 0.07, 'triangle', 0.18);
        break;
      case 'delete':
        this.blip(ctx, t, 330, 180, 0.09, 'triangle', 0.16);
        break;
      case 'rotate':
        this.blip(ctx, t, 520, 560, 0.04, 'square', 0.06);
        break;
      case 'invalid':
        this.blip(ctx, t, 220, 160, 0.12, 'sawtooth', 0.1);
        break;
      case 'run':
        this.blip(ctx, t, 200, 600, 0.18, 'triangle', 0.15);
        break;
      case 'stop':
        this.blip(ctx, t, 500, 200, 0.14, 'triangle', 0.12);
        break;
      case 'settle':
        this.blip(ctx, t, 320, 240, 0.25, 'sine', 0.12);
        break;
      case 'press':
        this.blip(ctx, t, 880, 880, 0.05, 'square', 0.1);
        break;
      case 'cut':
        this.blip(ctx, t, 1200, 300, 0.08, 'sawtooth', 0.1);
        break;
      case 'pop':
        this.noise(ctx, t, 0.06, 0.25);
        break;
      case 'bounce': {
        // Rate-limited; volume scales with impact.
        const now = performance.now();
        if (now - this.lastBounce < 70) return;
        this.lastBounce = now;
        const vol = Math.min(0.04 + intensity * 0.012, 0.14);
        this.blip(ctx, t, 180 + intensity * 18, 120, 0.05, 'sine', vol);
        break;
      }
      case 'win': {
        // Little victory arpeggio.
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => this.blip(ctx, t + i * 0.11, f, f, 0.18, 'triangle', 0.14));
        this.blip(ctx, t + 0.46, 1318.5, 1318.5, 0.3, 'triangle', 0.12);
        break;
      }
    }
  }

  private blip(
    ctx: AudioContext,
    t: number,
    fromHz: number,
    toHz: number,
    dur: number,
    type: OscillatorType,
    vol: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, t);
    if (toHz !== fromHz) osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(ctx: AudioContext, t: number, dur: number, vol: number): void {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(gain).connect(ctx.destination);
    src.start(t);
  }
}
