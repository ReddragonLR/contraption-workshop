/** Minimal typed event emitter (PRD §4: no Redux, hand-rolled store). */
export class Emitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, ((payload: never) => void)[]>();

  on<K extends keyof Events>(event: K, cb: (payload: Events[K]) => void): () => void {
    const list = this.listeners.get(event) ?? [];
    list.push(cb as (payload: never) => void);
    this.listeners.set(event, list);
    return () => {
      const cur = this.listeners.get(event) ?? [];
      const i = cur.indexOf(cb as (payload: never) => void);
      if (i >= 0) cur.splice(i, 1);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const cb of [...(this.listeners.get(event) ?? [])]) {
      (cb as (payload: Events[K]) => void)(payload);
    }
  }
}
