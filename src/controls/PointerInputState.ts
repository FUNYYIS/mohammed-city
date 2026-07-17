export type TouchAction = 'jump' | 'run' | 'crouch';

export interface ReleasedPointerRoles {
  joystick: boolean;
  camera: boolean;
  actions: TouchAction[];
}

export class PointerInputState {
  joystickPointer: number | null = null;
  cameraPointer: number | null = null;
  readonly activeTouchPointers = new Set<number>();
  private readonly actionPointers: Record<TouchAction, number | null> = {
    jump: null,
    run: null,
    crouch: null,
  };

  claimJoystick(pointerId: number): boolean {
    if (this.joystickPointer !== null || this.isPointerAssigned(pointerId)) return false;
    this.joystickPointer = pointerId;
    return true;
  }

  claimCamera(pointerId: number): boolean {
    if (this.cameraPointer !== null || this.isPointerAssigned(pointerId)) return false;
    this.cameraPointer = pointerId;
    return true;
  }

  claimAction(action: TouchAction, pointerId: number): boolean {
    if (this.actionPointers[action] !== null || this.isPointerAssigned(pointerId)) return false;
    this.actionPointers[action] = pointerId;
    return true;
  }

  trackPointerDown(pointerId: number, pointerType: string): void {
    if (pointerType === 'touch' || pointerType === 'pen') this.activeTouchPointers.add(pointerId);
  }

  trackPointerEnd(pointerId: number): void {
    this.activeTouchPointers.delete(pointerId);
  }

  isActionPressed(action: TouchAction): boolean {
    return this.actionPointers[action] !== null;
  }

  getActionPointer(action: TouchAction): number | null {
    return this.actionPointers[action];
  }

  releasePointer(pointerId: number): ReleasedPointerRoles {
    const released: ReleasedPointerRoles = {
      joystick: this.joystickPointer === pointerId,
      camera: this.cameraPointer === pointerId,
      actions: [],
    };

    if (released.joystick) this.joystickPointer = null;
    if (released.camera) this.cameraPointer = null;
    (Object.keys(this.actionPointers) as TouchAction[]).forEach((action) => {
      if (this.actionPointers[action] !== pointerId) return;
      this.actionPointers[action] = null;
      released.actions.push(action);
    });
    return released;
  }

  reset(): void {
    this.joystickPointer = null;
    this.cameraPointer = null;
    this.actionPointers.jump = null;
    this.actionPointers.run = null;
    this.actionPointers.crouch = null;
    this.activeTouchPointers.clear();
  }

  private isPointerAssigned(pointerId: number): boolean {
    return this.joystickPointer === pointerId
      || this.cameraPointer === pointerId
      || Object.values(this.actionPointers).includes(pointerId);
  }
}
