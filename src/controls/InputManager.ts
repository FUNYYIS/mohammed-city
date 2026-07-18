import { Vector2 } from 'three';
import { PointerInputState, TOUCH_ACTIONS, type TouchAction } from './PointerInputState';

export interface InputSnapshot {
  move: Vector2;
  cameraDelta: Vector2;
  run: boolean;
  crouch: boolean;
  jumpPressed: boolean;
  interactPressed: boolean;
  vehiclePressed: boolean;
}

export interface JoystickSample {
  raw: Vector2;
  movement: Vector2;
  knobOffset: Vector2;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const JOYSTICK_RADIUS_RATIO = 0.32;
const JOYSTICK_DEAD_ZONE = 0.12;
const CAMERA_EXCLUSION_SELECTOR = '[data-control="joystick"], [data-control="joystick-knob"], [data-action], [data-interaction], button';

/**
 * clientX/clientY and getBoundingClientRect() are both CSS-viewport pixels.
 * X stays screen-right positive. Screen Y is inverted exactly once when it is
 * converted to gameplay movement, so an upward finger movement becomes +Y.
 */
export function calculateJoystickSample(
  clientX: number,
  clientY: number,
  bounds: RectLike,
  deadZone = JOYSTICK_DEAD_ZONE,
): JoystickSample {
  const radius = Math.max(1, Math.min(bounds.width, bounds.height) * JOYSTICK_RADIUS_RATIO);
  const rawX = (clientX - (bounds.left + bounds.width * 0.5)) / radius;
  const rawScreenY = (clientY - (bounds.top + bounds.height * 0.5)) / radius;
  const raw = new Vector2(rawX, rawScreenY);
  const rawLength = raw.length();
  const clampedLength = Math.min(1, rawLength);
  const direction = rawLength > 0 ? raw.clone().multiplyScalar(1 / rawLength) : new Vector2();
  const knobOffset = direction.clone().multiplyScalar(clampedLength * radius);

  if (clampedLength <= deadZone) {
    return { raw, movement: new Vector2(), knobOffset };
  }

  const movementMagnitude = (clampedLength - deadZone) / Math.max(0.001, 1 - deadZone);
  const movement = new Vector2(
    direction.x * movementMagnitude,
    -direction.y * movementMagnitude,
  );
  return { raw, movement, knobOffset };
}

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly move = new Vector2();
  private readonly joystickRaw = new Vector2();
  private readonly joystickMove = new Vector2();
  private readonly cameraDelta = new Vector2();
  private readonly pointerState = new PointerInputState();
  private readonly gameSurface: ParentNode;
  private readonly joystickZone: HTMLElement | null;
  private readonly joystickKnob: HTMLElement | null;
  private readonly debugOverlay: HTMLElement | null;
  private readonly actionButtons = new Map<TouchAction, HTMLButtonElement>();
  private jumpQueued = false;
  private interactQueued = false;
  private vehicleQueued = false;
  private lastCameraX = 0;
  private lastCameraY = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.gameSurface = canvas.closest('.game-shell') ?? document;
    this.joystickZone = this.gameSurface.querySelector<HTMLElement>('[data-control="joystick"]');
    this.joystickKnob = this.gameSurface.querySelector<HTMLElement>('[data-control="joystick-knob"]');
    this.debugOverlay = this.gameSurface.querySelector<HTMLElement>('[data-input-debug]');
    this.gameSurface.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      this.actionButtons.set(button.dataset.action as TouchAction, button);
    });

    this.bindPointerTracking();
    this.bindKeyboard();
    this.bindJoystick();
    this.bindActionButtons();
    this.bindCameraDrag();
    this.bindLifecycleReset();
    this.configureDebugOverlay();
  }

  sample(): InputSnapshot {
    const keyboardX = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const keyboardY = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    this.move.set(keyboardX, keyboardY).add(this.joystickMove).clampLength(0, 1);

    const snapshot = {
      move: this.move.clone(),
      cameraDelta: this.cameraDelta.clone(),
      run: this.pointerState.isActionPressed('run') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      crouch: this.pointerState.isActionPressed('crouch') || this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.keys.has('ControlRight'),
      jumpPressed: this.jumpQueued,
      interactPressed: this.interactQueued,
      vehiclePressed: this.vehicleQueued,
    };

    this.jumpQueued = false;
    this.interactQueued = false;
    this.vehicleQueued = false;
    this.cameraDelta.set(0, 0);
    this.renderDebugOverlay();
    return snapshot;
  }

  reset(): void {
    this.releaseCapturedPointers();
    this.pointerState.reset();
    this.keys.clear();
    this.jumpQueued = false;
    this.interactQueued = false;
    this.vehicleQueued = false;
    this.joystickRaw.set(0, 0);
    this.joystickMove.set(0, 0);
    this.cameraDelta.set(0, 0);
    this.lastCameraX = 0;
    this.lastCameraY = 0;
    this.joystickZone?.classList.remove('is-pressed');
    if (this.joystickKnob) this.joystickKnob.style.transform = 'translate3d(0, 0, 0)';
    this.actionButtons.forEach((button) => button.classList.remove('is-pressed'));
    this.renderDebugOverlay();
  }

  private bindPointerTracking(): void {
    window.addEventListener('pointerdown', (event) => {
      this.pointerState.trackPointerDown(event.pointerId, event.pointerType);
      this.renderDebugOverlay();
    }, { capture: true });

    const end = (event: PointerEvent): void => {
      this.pointerState.trackPointerEnd(event.pointerId);
      this.releasePointer(event.pointerId, false);
    };
    window.addEventListener('pointerup', end, { capture: true });
    window.addEventListener('pointercancel', end, { capture: true });
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && !event.repeat) this.jumpQueued = true;
      if (event.code === 'KeyE' && !event.repeat) this.interactQueued = true;
      if (event.code === 'KeyF' && !event.repeat) this.vehicleQueued = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
  }

  private bindJoystick(): void {
    const zone = this.joystickZone;
    if (!zone || !this.joystickKnob) return;

    zone.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.pointerState.claimJoystick(event.pointerId)) return;
      this.capturePointer(zone, event.pointerId);
      zone.classList.add('is-pressed');
      this.updateJoystick(event);
    });
    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.pointerState.joystickPointer) return;
      event.preventDefault();
      this.updateJoystick(event);
    });
    zone.addEventListener('pointerup', (event) => this.releasePointer(event.pointerId, true));
    zone.addEventListener('pointercancel', (event) => this.releasePointer(event.pointerId, true));
    zone.addEventListener('lostpointercapture', (event) => this.releasePointer(event.pointerId, false));
  }

  private bindActionButtons(): void {
    this.actionButtons.forEach((button, action) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.pointerState.claimAction(action, event.pointerId)) return;
        this.capturePointer(button, event.pointerId);
        button.classList.add('is-pressed');
        if (action === 'jump') this.jumpQueued = true;
        if (action === 'interact') this.interactQueued = true;
        if (action === 'vehicle') this.vehicleQueued = true;
        this.tryHapticFeedback();
        this.renderDebugOverlay();
      });
      button.addEventListener('pointerup', (event) => this.releasePointer(event.pointerId, true));
      button.addEventListener('pointercancel', (event) => this.releasePointer(event.pointerId, true));
      button.addEventListener('lostpointercapture', (event) => this.releasePointer(event.pointerId, false));
    });
  }

  private bindCameraDrag(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (this.isCameraExcluded(event.target)) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (!this.pointerState.claimCamera(event.pointerId)) return;
      event.preventDefault();
      this.lastCameraX = event.clientX;
      this.lastCameraY = event.clientY;
      this.capturePointer(this.canvas, event.pointerId);
      this.renderDebugOverlay();
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.pointerState.cameraPointer) return;
      event.preventDefault();
      this.cameraDelta.x += event.clientX - this.lastCameraX;
      this.cameraDelta.y += event.clientY - this.lastCameraY;
      this.lastCameraX = event.clientX;
      this.lastCameraY = event.clientY;
      this.renderDebugOverlay();
    });
    this.canvas.addEventListener('pointerup', (event) => this.releasePointer(event.pointerId, true));
    this.canvas.addEventListener('pointercancel', (event) => this.releasePointer(event.pointerId, true));
    this.canvas.addEventListener('lostpointercapture', (event) => this.releasePointer(event.pointerId, false));
  }

  private bindLifecycleReset(): void {
    window.addEventListener('blur', () => this.reset());
    window.addEventListener('orientationchange', () => this.reset());
    window.addEventListener('pagehide', () => this.reset());
    document.addEventListener('visibilitychange', () => this.reset());
  }

  private updateJoystick(event: PointerEvent): void {
    if (!this.joystickZone || !this.joystickKnob) return;
    const sample = calculateJoystickSample(event.clientX, event.clientY, this.joystickZone.getBoundingClientRect());
    this.joystickRaw.copy(sample.raw);
    this.joystickMove.copy(sample.movement);
    this.joystickKnob.style.transform = `translate3d(${sample.knobOffset.x.toFixed(2)}px, ${sample.knobOffset.y.toFixed(2)}px, 0)`;
    this.renderDebugOverlay();
  }

  private releasePointer(pointerId: number, releaseCapture: boolean): void {
    const joystickElement = this.pointerState.joystickPointer === pointerId ? this.joystickZone : null;
    const cameraElement = this.pointerState.cameraPointer === pointerId ? this.canvas : null;
    const actionElements = TOUCH_ACTIONS
      .filter((action) => this.pointerState.getActionPointer(action) === pointerId)
      .map((action) => this.actionButtons.get(action))
      .filter((element): element is HTMLButtonElement => Boolean(element));
    const released = this.pointerState.releasePointer(pointerId);

    if (released.joystick) {
      this.joystickRaw.set(0, 0);
      this.joystickMove.set(0, 0);
      this.joystickZone?.classList.remove('is-pressed');
      if (this.joystickKnob) this.joystickKnob.style.transform = 'translate3d(0, 0, 0)';
    }
    released.actions.forEach((action) => this.actionButtons.get(action)?.classList.remove('is-pressed'));

    if (releaseCapture) {
      if (joystickElement) this.releaseCapture(joystickElement, pointerId);
      if (cameraElement) this.releaseCapture(cameraElement, pointerId);
      actionElements.forEach((element) => this.releaseCapture(element, pointerId));
    }
    this.renderDebugOverlay();
  }

  private releaseCapturedPointers(): void {
    if (this.pointerState.joystickPointer !== null && this.joystickZone) {
      this.releaseCapture(this.joystickZone, this.pointerState.joystickPointer);
    }
    if (this.pointerState.cameraPointer !== null) {
      this.releaseCapture(this.canvas, this.pointerState.cameraPointer);
    }
    TOUCH_ACTIONS.forEach((action) => {
      const pointerId = this.pointerState.getActionPointer(action);
      const button = this.actionButtons.get(action);
      if (pointerId !== null && button) this.releaseCapture(button, pointerId);
    });
  }

  private capturePointer(element: Element, pointerId: number): void {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      this.releasePointer(pointerId, false);
    }
  }

  private releaseCapture(element: Element, pointerId: number): void {
    try {
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    } catch {
      // Safari may already have released capture during orientation/page changes.
    }
  }

  private isCameraExcluded(target: EventTarget | null): boolean {
    const element = target instanceof Element ? target : null;
    return Boolean(element?.closest(CAMERA_EXCLUSION_SELECTOR));
  }

  private configureDebugOverlay(): void {
    if (!this.debugOverlay) return;
    const enabled = new URLSearchParams(window.location.search).has('debugInput');
    this.debugOverlay.hidden = !enabled;
    this.renderDebugOverlay();
  }

  private renderDebugOverlay(): void {
    if (!this.debugOverlay || this.debugOverlay.hidden) return;
    const id = (value: number | null): string => value === null ? '—' : String(value);
    const number = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
    this.debugOverlay.textContent = [
      'INPUT DEBUG',
      `joystick pointer: ${id(this.pointerState.joystickPointer)}`,
      `camera pointer: ${id(this.pointerState.cameraPointer)}`,
      `raw x/y: ${number(this.joystickRaw.x)}  ${number(this.joystickRaw.y)}`,
      `move x/y: ${number(this.joystickMove.x)}  ${number(this.joystickMove.y)}`,
      `jump: ${Number(this.pointerState.isActionPressed('jump'))}  run: ${Number(this.pointerState.isActionPressed('run'))}  crouch: ${Number(this.pointerState.isActionPressed('crouch'))}`,
      `interact: ${Number(this.pointerState.isActionPressed('interact'))}  vehicle: ${Number(this.pointerState.isActionPressed('vehicle'))}`,
      `active touches: ${this.pointerState.activeTouchPointers.size}`,
    ].join('\n');
  }

  private tryHapticFeedback(): void {
    try {
      navigator.vibrate?.(8);
    } catch {
      // Haptics are optional and unsupported by iOS Safari.
    }
  }
}
