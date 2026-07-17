import type { AnimationClip, Object3D } from 'three';

export type CharacterAction =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'
  | 'crouch' | 'crouchWalk' | 'interact' | 'openDoor' | 'pickUp'
  | 'push' | 'pull' | 'climb' | 'vault' | 'drive' | 'exitVehicle' | 'celebrate';

export interface CharacterAnimationMap {
  action: CharacterAction;
  sourceClip: string;
  loop: boolean;
}

export interface HumanoidBoneMap {
  hips: string;
  spine: string;
  head: string;
  leftUpperArm: string;
  rightUpperArm: string;
  leftUpperLeg: string;
  rightUpperLeg: string;
}

/**
 * Contract between the gameplay controller and a future rigged GLB.
 * PlayerView currently uses a lightweight procedural child through the same
 * visual boundary, so no fake animation clips are declared.
 */
export class CharacterAssetAdapter {
  constructor(
    readonly root: Object3D,
    readonly clips: AnimationClip[],
    readonly bones: HumanoidBoneMap,
    readonly animations: CharacterAnimationMap[],
  ) {}

  findClip(action: CharacterAction): AnimationClip | null {
    const mapping = this.animations.find((entry) => entry.action === action);
    if (!mapping) return null;
    return this.clips.find((clip) => clip.name === mapping.sourceClip) ?? null;
  }
}
