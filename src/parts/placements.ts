import type { OptionValue, Placement } from './types';
import { defaultOptions, getPart } from './registry';

export interface PlacementProps {
  rotation?: number;
  options?: Record<string, OptionValue>;
  tag?: string;
  locked?: boolean;
  fromBin?: boolean;
  link?: Placement['link'];
}

/**
 * Issues placements with sequential, deterministic instanceIds. Each scene
 * (level load, sandbox session, test) owns one factory so ids are stable.
 */
export class PlacementFactory {
  private n = 0;

  make(partId: string, x: number, y: number, props: PlacementProps = {}): Placement {
    const def = getPart(partId); // throws on unknown part id
    this.n++;
    return {
      instanceId: `p${this.n}`,
      partId: def.id,
      x,
      y,
      rotation: props.rotation ?? 0,
      options: { ...defaultOptions(def), ...props.options },
      tag: props.tag,
      locked: props.locked ?? false,
      fromBin: props.fromBin ?? false,
      link: props.link,
    };
  }
}
