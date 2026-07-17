import type { Object3D } from 'three';

export type CharacterPoseName = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'crouch';

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
 * Visual-only contract used by PlayerView. A future GLB-backed implementation
 * can replace the procedural child without changing PlayerController.
 */
export interface CharacterVisual {
  readonly root: Object3D;
  update(input: CharacterPoseInput): void;
  getPoseName(): CharacterPoseName;
  getRenderMetrics(): CharacterRenderMetrics;
}
