import { Vector2 } from 'three';

export interface InputSnapshot {
  move: Vector2;
  cameraDelta: Vector2;
  run: boolean;
  crouch: boolean;
  jumpPressed: boolean;
}

type Action = 'jump' | 'run' | 'crouch';

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly move = new Vector2();
  private readonly joystickMove = new Vector2();
  private readonly cameraDelta = new Vector2();
  private jumpQueued = false;
  private crouchTouch = false;
  private runTouch = false;
  private joystickPointer: number | null = null;
  private cameraPointer: number | null = null;
  private lastCameraX = 0;
  private lastCameraY = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.bindKeyboard();
    this.bindJoystick();
    this.bindActionButtons();
    this.bindCameraDrag();
  }

  sample(): InputSnapshot {
    const keyboardX = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const keyboardY = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    this.move.set(keyboardX, keyboardY).add(this.joystickMove).clampLength(0, 1);

    const snapshot = {
      move: this.move.clone(),
      cameraDelta: this.cameraDelta.clone(),
      run: this.runTouch || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      crouch: this.crouchTouch || this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.keys.has('ControlRight'),
      jumpPressed: this.jumpQueued,
    };

    this.jumpQueued = false;
    this.cameraDelta.set(0, 0);
    return snapshot;
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && !event.repeat) this.jumpQueued = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private bindJoystick(): void {
    const zone = document.querySelector<HTMLElement>('[data-control="joystick"]');
    const knob = document.querySelector<HTMLElement>('[data-control="joystick-knob"]');
    if (!zone || !knob) return;

    const update = (event: PointerEvent): void => {
      const bounds = zone.getBoundingClientRect();
      const radius = bounds.width * 0.32;
      const x = event.clientX - (bounds.left + bounds.width / 2);
      const y = event.clientY - (bounds.top + bounds.height / 2);
      const length = Math.hypot(x, y);
      const scale = length > radius ? radius / length : 1;
      const clampedX = x * scale;
      const clampedY = y * scale;
      knob.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
      this.joystickMove.set(clampedX / radius, -clampedY / radius);
    };

    zone.addEventListener('pointerdown', (event) => {
      this.joystickPointer = event.pointerId;
      zone.setPointerCapture(event.pointerId);
      zone.classList.add('is-pressed');
      update(event);
    });
    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.joystickPointer) update(event);
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null;
      this.joystickMove.set(0, 0);
      knob.style.transform = 'translate3d(0, 0, 0)';
      zone.classList.remove('is-pressed');
    };
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
  }

  private bindActionButtons(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      const action = button.dataset.action as Action;
      const press = (event: PointerEvent): void => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        button.classList.add('is-pressed');
        if (action === 'jump') this.jumpQueued = true;
        if (action === 'run') this.runTouch = true;
        if (action === 'crouch') this.crouchTouch = true;
        if ('vibrate' in navigator) navigator.vibrate(8);
      };
      const release = (event: PointerEvent): void => {
        if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
        button.classList.remove('is-pressed');
        if (action === 'run') this.runTouch = false;
        if (action === 'crouch') this.crouchTouch = false;
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
    });
  }

  private bindCameraDrag(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (this.cameraPointer !== null) return;
      this.cameraPointer = event.pointerId;
      this.lastCameraX = event.clientX;
      this.lastCameraY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.cameraPointer) return;
      this.cameraDelta.x += event.clientX - this.lastCameraX;
      this.cameraDelta.y += event.clientY - this.lastCameraY;
      this.lastCameraX = event.clientX;
      this.lastCameraY = event.clientY;
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId === this.cameraPointer) this.cameraPointer = null;
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
  }
}
