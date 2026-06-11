import { describe, expect, it } from 'vitest';
import { registerAllParts } from '../../../src/parts';
import { hasPart, registerPart } from '../../../src/parts/registry';
import { button } from '../../../src/parts/defs/button';
import { PlacementFactory } from '../../../src/parts/placements';
import { Simulation } from '../../../src/engine/simulation';

registerAllParts();
if (!hasPart('button')) registerPart(button);

function buildSim(ballX: number, powers: string): Simulation {
  const f = new PlacementFactory();
  const placements = [
    f.make('button', 480, 560, { options: { powers }, tag: 'btn' }),
    f.make('basketball', ballX, 480, { tag: 'ball' }),
  ];
  return new Simulation({ width: 960, height: 600, gravity: { x: 0, y: 1 } }, placements);
}

describe('button (pressure plate)', () => {
  it('latches power on and emits device-on when a ball lands on it', () => {
    const sim = buildSim(480, 'fan-1');
    const deviceOn: unknown[] = [];
    sim.on('device-on', (payload) => deviceOn.push(payload));
    for (let i = 0; i < 180; i++) sim.step();
    expect(sim.runtimeById('btn')!.state.pressed).toBe(true);
    expect(sim.power.isOn('fan-1')).toBe(true);
    expect(deviceOn).toContain('fan-1');
    sim.destroy();
  });

  it('emits button-press exactly once but no device-on when powers is empty', () => {
    const sim = buildSim(480, '');
    const presses: unknown[] = [];
    const deviceOn: unknown[] = [];
    sim.on('button-press', (payload) => presses.push(payload));
    sim.on('device-on', (payload) => deviceOn.push(payload));
    for (let i = 0; i < 180; i++) sim.step();
    expect(sim.runtimeById('btn')!.state.pressed).toBe(true);
    expect(presses).toEqual(['btn']);
    expect(deviceOn).toEqual([]);
    sim.destroy();
  });

  it('stays unpressed when the ball drops elsewhere (control)', () => {
    const sim = buildSim(200, 'fan-1');
    const presses: unknown[] = [];
    sim.on('button-press', (payload) => presses.push(payload));
    for (let i = 0; i < 180; i++) sim.step();
    expect(sim.runtimeById('btn')!.state.pressed).toBe(false);
    expect(sim.power.isOn('fan-1')).toBe(false);
    expect(presses).toEqual([]);
    sim.destroy();
  });
});
