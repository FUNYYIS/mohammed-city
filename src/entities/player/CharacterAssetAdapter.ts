import type { AnimationClip, Object3D } from 'three';

export type CharacterAction =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'
  | 'crouch' | 'crouchWalk' | 'interact' | 'openDoor' | 'pickUp'
  | 'push' | 'pull' | 'climb' | 'vault' | 'drive' | 'exitVehicle' | 'celebrate'
  | 'wave' | 'positiveResponse' | 'sit' | 'standUp' | 'seatedClap';

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
 * Semantic mapping for the Meshy merged-animations Mohammed GLB. Clip names
 * were read from the file itself; the extra "Counterstrike" clip is left
 * unmapped on purpose. There is no neutral seated-idle clip in the export, so
 * the seated state maps to the closest seated loop (Sit_Finger_Wag_No).
 */
export const MOHAMMED_ANIMATION_MAPPINGS: readonly CharacterAnimationMap[] = [
  { action: 'idle', sourceClip: 'Idle_02', loop: true },
  { action: 'walk', sourceClip: 'Walking', loop: true },
  { action: 'run', sourceClip: 'Running', loop: true },
  { action: 'jump', sourceClip: 'Jump_Run', loop: false },
  { action: 'openDoor', sourceClip: 'open_door_3', loop: false },
  { action: 'pickUp', sourceClip: 'Male_Bend_Over_Pick_Up', loop: false },
  { action: 'wave', sourceClip: 'Big_Wave_Hello', loop: false },
  { action: 'positiveResponse', sourceClip: 'Agree_Gesture', loop: false },
  { action: 'sit', sourceClip: 'Sit_Finger_Wag_No', loop: true },
  { action: 'standUp', sourceClip: 'Sit_to_Stand_Transition_M', loop: false },
  { action: 'seatedClap', sourceClip: 'Sitting_Clap', loop: false },
];

export const MOHAMMED_BONE_MAP: HumanoidBoneMap = {
  hips: 'Hips',
  spine: 'Spine',
  head: 'Head',
  leftUpperArm: 'LeftArm',
  rightUpperArm: 'RightArm',
  leftUpperLeg: 'LeftUpLeg',
  rightUpperLeg: 'RightUpLeg',
};

/**
 * Contract between the gameplay controller and a rigged GLB. The clips array
 * always keeps the original imported AnimationClips untouched; any runtime
 * root-motion filtering or trimming happens on clones owned by the visual.
 */
export class CharacterAssetAdapter {
  constructor(
    readonly root: Object3D,
    readonly clips: AnimationClip[],
    readonly bones: HumanoidBoneMap,
    readonly animations: readonly CharacterAnimationMap[],
  ) {}

  findClip(action: CharacterAction): AnimationClip | null {
    const mapping = this.animations.find((entry) => entry.action === action);
    if (!mapping) return null;
    return this.clips.find((clip) => clip.name === mapping.sourceClip) ?? null;
  }
}
