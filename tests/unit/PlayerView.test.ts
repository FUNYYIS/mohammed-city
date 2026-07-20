import { Box3, Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterPoseInput, CharacterVisual } from '../../src/entities/player/CharacterVisual';
import { PlayerView } from '../../src/entities/player/PlayerView';

function updateFrames(
  view: PlayerView,
  frames: number,
  options: Partial<{
    speedRatio: number;
    crouching: boolean;
    grounded: boolean;
    justLanded: boolean;
    verticalVelocity: number;
  }> = {},
): void {
  for (let frame = 0; frame < frames; frame += 1) {
    view.update(
      1 / 60,
      options.speedRatio ?? 0,
      options.crouching ?? false,
      options.grounded ?? true,
      frame === 0 && (options.justLanded ?? false),
      options.verticalVelocity ?? 0,
    );
  }
}

describe('procedural child character', () => {
  it('keeps the controller-facing wrapper replaceable by a future GLB visual', () => {
    let receivedPose: CharacterPoseInput | null = null;
    const replacement: CharacterVisual = {
      root: new Group(),
      update: (pose) => { receivedPose = pose; },
      getPoseName: () => 'idle',
      getRenderMetrics: () => ({ drawCalls: 1, triangles: 12 }),
    };
    const view = new PlayerView(replacement);

    view.update(1 / 60, 0.5, false, true, false, 0);

    expect(view.visualRoot.children).toContain(replacement.root);
    expect(receivedPose).toMatchObject({ speedRatio: 0.5, grounded: true });
  });

  it('hot-swaps the visual, disposes the placeholder, and delegates gestures', () => {
    const view = new PlayerView();
    expect(view.playGesture('wave')).toBe(false);

    const placeholderGeometries: unknown[] = [];
    view.root.traverse((object) => {
      if ('geometry' in object) placeholderGeometries.push(object.geometry);
    });
    const disposeSpies = placeholderGeometries.map((geometry) =>
      vi.spyOn(geometry as { dispose(): void }, 'dispose'),
    );

    const gestures: string[] = [];
    const replacement: CharacterVisual = {
      root: new Group(),
      update: () => {},
      getPoseName: () => 'idle',
      getRenderMetrics: () => ({ drawCalls: 1, triangles: 55_665 }),
      playGesture: (name) => { gestures.push(name); return true; },
    };
    view.setCharacter(replacement);

    expect(view.visualRoot.children).toEqual([replacement.root]);
    expect(view.root.getObjectByName('tailored-white-thobe-body')).toBeUndefined();
    expect(disposeSpies.length).toBeGreaterThan(0);
    disposeSpies.forEach((spy) => expect(spy).toHaveBeenCalled());
    expect(view.playGesture('openDoor')).toBe(true);
    expect(gestures).toEqual(['openDoor']);
  });

  it('contains the authored child details without the old capsule visual', () => {
    const view = new PlayerView();

    expect(view.root.name).toBe('mohammed-character-anchor');
    expect(view.root.getObjectByName('tailored-white-thobe-body')).toBeTruthy();
    expect(view.root.getObjectByName('layered-black-hair')).toBeTruthy();
    expect(view.root.getObjectByName('clear-grey-glasses-frame')).toBeTruthy();
    expect(view.root.getObjectByName('smile')).toBeTruthy();
    expect(view.root.getObjectByName('rounded-black-shoe')).toBeTruthy();
    expect(view.root.getObjectByName('temporary-mohammed-character')).toBeUndefined();
  });

  it('stays inside the standing and crouching capsule proportions', () => {
    const view = new PlayerView();
    updateFrames(view, 60);
    view.root.updateMatrixWorld(true);
    const standingBounds = new Box3().setFromObject(view.root);

    expect(standingBounds.min.y).toBeGreaterThanOrEqual(-0.02);
    expect(standingBounds.max.y).toBeLessThanOrEqual(1.82);
    expect(standingBounds.max.y - standingBounds.min.y).toBeGreaterThan(1.65);

    updateFrames(view, 60, { crouching: true });
    view.root.updateMatrixWorld(true);
    const crouchingBounds = new Box3().setFromObject(view.root);

    expect(crouchingBounds.min.y).toBeGreaterThanOrEqual(-0.03);
    expect(crouchingBounds.max.y).toBeLessThanOrEqual(1.4);
    expect(crouchingBounds.max.y).toBeLessThan(standingBounds.max.y - 0.3);
  });

  it('selects idle, walk, run, jump, fall, and crouch poses', () => {
    const view = new PlayerView();
    updateFrames(view, 10);
    expect(view.getPoseName()).toBe('idle');

    updateFrames(view, 30, { speedRatio: 0.5 });
    expect(view.getPoseName()).toBe('walk');

    updateFrames(view, 30, { speedRatio: 1 });
    expect(view.getPoseName()).toBe('run');

    updateFrames(view, 1, { grounded: false, verticalVelocity: 4 });
    expect(view.getPoseName()).toBe('jump');

    updateFrames(view, 1, { grounded: false, verticalVelocity: -4 });
    expect(view.getPoseName()).toBe('fall');

    updateFrames(view, 1, { crouching: true });
    expect(view.getPoseName()).toBe('crouch');
  });

  it('articulates limbs for locomotion, airborne, and crouch poses', () => {
    const view = new PlayerView();
    const leftLeg = view.root.getObjectByName('left-upper-leg')!;
    const leftArm = view.root.getObjectByName('left-upper-arm')!;
    const leftKnee = view.root.getObjectByName('left-knee')!;
    const rig = view.root.getObjectByName('child-humanoid-rig')!;
    let walkMinimum = Number.POSITIVE_INFINITY;
    let walkMaximum = Number.NEGATIVE_INFINITY;

    for (let frame = 0; frame < 90; frame += 1) {
      updateFrames(view, 1, { speedRatio: 0.5 });
      walkMinimum = Math.min(walkMinimum, leftLeg.rotation.x);
      walkMaximum = Math.max(walkMaximum, leftLeg.rotation.x);
    }
    expect(walkMaximum - walkMinimum).toBeGreaterThan(0.3);

    updateFrames(view, 15, { grounded: false, verticalVelocity: 4 });
    expect(leftArm.rotation.x).toBeGreaterThan(0.35);
    expect(leftKnee.rotation.x).toBeLessThan(-0.25);

    updateFrames(view, 60, { crouching: true });
    expect(rig.position.y).toBeLessThan(-0.35);
    expect(leftLeg.rotation.x).toBeGreaterThan(0.85);
    expect(leftKnee.rotation.x).toBeLessThan(-1.7);
  });

  it('remains within the lightweight mobile character budget', () => {
    const metrics = new PlayerView().getRenderMetrics();

    expect(metrics.drawCalls).toBeLessThanOrEqual(30);
    expect(metrics.triangles).toBeLessThanOrEqual(8_000);
  });
});
