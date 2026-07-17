import { describe, expect, it } from 'vitest';
import { calculateJoystickSample } from '../../src/controls/InputManager';
import { PointerInputState } from '../../src/controls/PointerInputState';

const bounds = { left: 100, top: 200, width: 100, height: 100 };
const centerX = 150;
const centerY = 250;
const radius = 32;

describe('calculateJoystickSample', () => {
  it('maps all four screen directions to gameplay axes exactly once', () => {
    const up = calculateJoystickSample(centerX, centerY - radius, bounds);
    const down = calculateJoystickSample(centerX, centerY + radius, bounds);
    const left = calculateJoystickSample(centerX - radius, centerY, bounds);
    const right = calculateJoystickSample(centerX + radius, centerY, bounds);

    expect(up.movement.x).toBeCloseTo(0);
    expect(up.movement.y).toBeCloseTo(1);
    expect(down.movement.y).toBeCloseTo(-1);
    expect(left.movement.x).toBeCloseTo(-1);
    expect(right.movement.x).toBeCloseTo(1);
  });

  it('applies a dead zone without changing the intended direction', () => {
    const still = calculateJoystickSample(centerX + radius * 0.08, centerY, bounds);
    const moving = calculateJoystickSample(centerX + radius * 0.5, centerY, bounds);

    expect(still.movement.length()).toBe(0);
    expect(moving.movement.x).toBeGreaterThan(0);
    expect(moving.movement.y).toBeCloseTo(0);
  });

  it('clamps the knob and output to the joystick radius', () => {
    const sample = calculateJoystickSample(centerX + radius * 8, centerY - radius * 6, bounds);

    expect(sample.knobOffset.length()).toBeCloseTo(radius);
    expect(sample.movement.length()).toBeCloseTo(1);
    expect(sample.movement.x).toBeGreaterThan(0);
    expect(sample.movement.y).toBeGreaterThan(0);
  });
});

describe('PointerInputState', () => {
  it('never lets a second pointer steal the joystick', () => {
    const state = new PointerInputState();
    expect(state.claimJoystick(11)).toBe(true);
    expect(state.claimJoystick(12)).toBe(false);
    expect(state.joystickPointer).toBe(11);
  });

  it('keeps joystick, camera, and button pointers independent', () => {
    const state = new PointerInputState();
    expect(state.claimJoystick(1)).toBe(true);
    expect(state.claimCamera(2)).toBe(true);
    expect(state.claimAction('run', 3)).toBe(true);
    expect(state.claimAction('jump', 4)).toBe(true);
    expect(state.claimCamera(3)).toBe(false);

    const released = state.releasePointer(3);
    expect(released.actions).toEqual(['run']);
    expect(state.joystickPointer).toBe(1);
    expect(state.cameraPointer).toBe(2);
    expect(state.isActionPressed('jump')).toBe(true);
    expect(state.isActionPressed('run')).toBe(false);
  });

  it('clears every pressed state on lifecycle reset', () => {
    const state = new PointerInputState();
    state.trackPointerDown(1, 'touch');
    state.trackPointerDown(2, 'touch');
    state.claimJoystick(1);
    state.claimCamera(2);
    state.claimAction('crouch', 3);

    state.reset();

    expect(state.joystickPointer).toBeNull();
    expect(state.cameraPointer).toBeNull();
    expect(state.isActionPressed('crouch')).toBe(false);
    expect(state.activeTouchPointers.size).toBe(0);
  });
});
