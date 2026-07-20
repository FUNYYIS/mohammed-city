import type { Object3D } from 'three';

export type CharacterPoseName = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'crouch';

/**
 * One-shot or stateful gesture animations a rigged character may support.
 * Sitting-related gestures are part of the animation API but are not yet
 * triggered by any world interaction (the game has no sitting mechanic).
 */
export type CharacterGestureName =
  | 'openDoor' | 'pickUp' | 'wave' | 'positiveResponse'
  | 'sit' | 'standUp' | 'seatedClap';

export interface CharacterPoseInput {
  delta: number;
  speedRatio: number;
  crouching: boolean;
  grounded: boolean;
  justLanded: boolean;
  verticalVelocity: number;
}

export interface CharacterRenderMetrics {
  drawCalls: number;
  triangles: number;
}

/**
 * Visual-only contract used by PlayerView. A GLB-backed implementation
 * can replace the procedural child without changing PlayerController.
 */
export interface CharacterVisual {
  readonly root: Object3D;
  update(input: CharacterPoseInput): void;
  getPoseName(): CharacterPoseName | CharacterGestureName;
  getRenderMetrics(): CharacterRenderMetrics;
  /** Optional gesture channel; returns false when unsupported or rejected. */
  playGesture?(name: CharacterGestureName): boolean;
}
