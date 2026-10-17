import type { Direction } from './world.ts';

const bindings: Record<string, Direction> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

export class Controls {
  private held = new Map<string, Direction>();
  private tapped?: Direction;
  private controller = new AbortController();

  attach(canvas: HTMLCanvasElement): void {
    const { signal } = this.controller;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'ひだまりオフィス。矢印キーまたはWASDで移動。Tabキーでマップから移動できます。');
    canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }), { signal });
    canvas.addEventListener('keydown', (event) => {
      const direction = bindings[event.code];
      if (direction && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        this.held.set(event.code, direction);
        if (!event.repeat) this.tapped = direction;
      }
    }, { signal });
    canvas.addEventListener('keyup', (event) => {
      if (bindings[event.code]) {
        event.preventDefault();
        this.held.delete(event.code);
      }
    }, { signal });
    canvas.addEventListener('blur', () => this.clear(), { signal });
    window.addEventListener('blur', () => this.clear(), { signal });
    document.addEventListener('visibilitychange', () => this.clear(), { signal });

    document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.held.set(`pointer-${event.pointerId}`, button.dataset.direction as Direction);
        this.tapped = button.dataset.direction as Direction;
        button.classList.add('pressed');
      }, { signal });
      const release = (event: PointerEvent) => {
        this.held.delete(`pointer-${event.pointerId}`);
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerup', release, { signal });
      button.addEventListener('pointercancel', release, { signal });
      button.addEventListener('lostpointercapture', release, { signal });
      // A keyboard or assistive-technology click moves one tile.
      button.addEventListener('click', (event) => {
        if (event.detail === 0) button.dispatchEvent(new CustomEvent('walk-step', { bubbles: true, detail: button.dataset.direction }));
      }, { signal });
    });
  }

  direction(): Direction | undefined {
    const next = [...this.held.values()].at(-1) ?? this.tapped;
    this.tapped = undefined;
    return next;
  }
  clear(): void {
    this.held.clear();
    this.tapped = undefined;
    document.querySelectorAll('.pressed').forEach((button) => button.classList.remove('pressed'));
  }
  destroy(): void { this.clear(); this.controller.abort(); }
}
