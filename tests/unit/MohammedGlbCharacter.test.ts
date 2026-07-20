import {
  AnimationClip,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOHAMMED_ANIMATION_MAPPINGS,
} from '../../src/entities/player/CharacterAssetAdapter';
import {
  MohammedGlbCharacter,
  prepareRuntimeClip,
  trimClip,
} from '../../src/entities/player/MohammedGlbCharacter';
import type { CharacterPoseInput } from '../../src/entities/player/CharacterVisual';

const CLIP_NAMES = [
  'Idle_02', 'Walking', 'Running', 'Jump_Run', 'open_door_3',
  'Male_Bend_Over_Pick_Up', 'Big_Wave_Hello', 'Agree_Gesture',
  'Sit_Finger_Wag_No', 'Sit_to_Stand_Transition_M', 'Sitting_Clap',
  'Counterstrike',
];

function syntheticClip(name: string, duration: number, hipsPath: number[][] = [[0, 74, 7], [0, 74, 7]]): AnimationClip {
  const times = hipsPath.map((_, index) => (index / Math.max(1, hipsPath.length - 1)) * duration);
  return new AnimationClip(name, duration, [
    new VectorKeyframeTrack('Hips.position', times, hipsPath.flat()),
    new QuaternionKeyframeTrack('Hips.quaternion', [0, duration], [0, 0, 0, 1, 0, 0, 0, 1]),
  ]);
}

function syntheticRig(): Object3D {
  const scene = new Group();
  const armature = new Group();
  armature.name = 'Armature';
  armature.scale.setScalar(0.01);
  const hips = new Object3D();
  hips.name = 'Hips';
  armature.add(hips);
  scene.add(armature);
  const body = new Mesh(new BoxGeometry(0.6, 1.7, 0.35), new MeshStandardMaterial());
  body.position.y = 0.85;
  scene.add(body);
  return scene;
}

const REAL_DURATIONS: Record<string, number> = {
  Idle_02: 2.33, Walking: 1.03, Running: 0.63, Jump_Run: 2.1,
  open_door_3: 10.83, Male_Bend_Over_Pick_Up: 7.2, Big_Wave_Hello: 5.33,
  Agree_Gesture: 13, Sit_Finger_Wag_No: 3.97, Sit_to_Stand_Transition_M: 6.2,
  Sitting_Clap: 3.33, Counterstrike: 6.5,
};

function syntheticClips(durations: Partial<Record<string, number>> = {}): AnimationClip[] {
  return CLIP_NAMES.map((name) => syntheticClip(name, durations[name] ?? REAL_DURATIONS[name] ?? 0.4));
}

function frame(character: MohammedGlbCharacter, frames: number, input: Partial<CharacterPoseInput> = {}): void {
  for (let index = 0; index < frames; index += 1) {
    character.update({
      delta: 1 / 60,
      speedRatio: input.speedRatio ?? 0,
      crouching: input.crouching ?? false,
      grounded: input.grounded ?? true,
      justLanded: index === 0 && (input.justLanded ?? false),
      verticalVelocity: input.verticalVelocity ?? 0,
    });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Mohammed GLB character', () => {
  it('maps every semantic action to a real clip and leaves Counterstrike unused', () => {
    const character = new MohammedGlbCharacter(syntheticRig(), syntheticClips());
    expect(character.getMissingClips()).toEqual([]);
    expect(MOHAMMED_ANIMATION_MAPPINGS.map((entry) => entry.action)).toEqual([
      'idle', 'walk', 'run', 'jump', 'openDoor', 'pickUp', 'wave',
      'positiveResponse', 'sit', 'standUp', 'seatedClap',
    ]);
    expect(MOHAMMED_ANIMATION_MAPPINGS.some((entry) => entry.sourceClip === 'Counterstrike')).toBe(false);
  });

  it('warns and refuses the gesture when an optional clip is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clips = syntheticClips().filter((clip) => clip.name !== 'Big_Wave_Hello');
    const character = new MohammedGlbCharacter(syntheticRig(), clips);
    expect(character.getMissingClips()).toEqual(['wave -> Big_Wave_Hello']);
    expect(warn).toHaveBeenCalledOnce();
    expect(character.playGesture('wave')).toBe(false);
    frame(character, 5);
    expect(character.getPoseName()).toBe('idle');
  });

  it('normalizes scale to the intended player height and corrects facing', () => {
    const character = new MohammedGlbCharacter(syntheticRig(), syntheticClips());
    expect(character.root.scale.x).toBeCloseTo(1.74 / 1.7 / 0.96, 3);
    const orientation = character.root.getObjectByName('mohammed-glb-orientation')!;
    expect(orientation.rotation.y).toBeCloseTo(Math.PI, 5);
    expect(orientation.position.y).toBeCloseTo(0, 5);
    expect(character.getRenderMetrics().drawCalls).toBe(1);
  });

  it('runs locomotion transitions without restarting the active looping action', () => {
    const character = new MohammedGlbCharacter(syntheticRig(), syntheticClips());
    frame(character, 10);
    expect(character.getPoseName()).toBe('idle');
    frame(character, 40, { speedRatio: 0.5 });
    expect(character.getPoseName()).toBe('walk');
    expect(character.getActiveClipName()).toBe('Walking@runtime');
    frame(character, 40, { speedRatio: 1 });
    expect(character.getPoseName()).toBe('run');
    frame(character, 40, { speedRatio: 1, crouching: true });
    expect(character.getPoseName()).toBe('crouch');
    frame(character, 1, { grounded: false, verticalVelocity: 5 });
    expect(character.getPoseName()).toBe('jump');
    expect(character.getActiveClipName()).toBe('Jump_Run@runtime');
    frame(character, 1, { grounded: false, verticalVelocity: -5 });
    expect(character.getPoseName()).toBe('fall');
    frame(character, 40, { justLanded: true });
    expect(character.getPoseName()).toBe('idle');
  });

  it('plays one-shot gestures once, blocks duplicates, preempts with new ones, and returns to idle', () => {
    const character = new MohammedGlbCharacter(syntheticRig(), syntheticClips());
    frame(character, 5);
    expect(character.playGesture('wave')).toBe(true);
    expect(character.playGesture('wave')).toBe(false);
    expect(character.getPoseName()).toBe('wave');
    expect(character.playGesture('pickUp')).toBe(true);
    expect(character.getPoseName()).toBe('pickUp');
    frame(character, 280);
    expect(character.getPoseName()).toBe('idle');
    expect(character.playGesture('wave')).toBe(true);
  });

  it('cancels a gesture when the controller starts moving or leaves the ground', () => {
    const character = new MohammedGlbCharacter(syntheticRig(), syntheticClips({ open_door_3: 8 }));
    frame(character, 5);
    expect(character.playGesture('openDoor')).toBe(true);
    frame(character, 30, { speedRatio: 1 });
    expect(['walk', 'run']).toContain(character.getPoseName());

    expect(character.playGesture('positiveResponse')).toBe(false);
    frame(character, 30);
    expect(character.playGesture('positiveResponse')).toBe(true);
    frame(character, 2, { grounded: false, verticalVelocity: 5 });
    expect(character.getPoseName()).toBe('jump');
  });

  it('supports the dormant seated API: sit loops, clap returns to sit, stand-up exits', () => {
    const character = new MohammedGlbCharacter(syntheticRig(), syntheticClips());
    expect(character.playGesture('seatedClap')).toBe(false);
    expect(character.playGesture('standUp')).toBe(false);
    expect(character.playGesture('sit')).toBe(true);
    frame(character, 90);
    expect(character.getPoseName()).toBe('sit');
    expect(character.playGesture('seatedClap')).toBe(true);
    frame(character, 230);
    expect(character.getPoseName()).toBe('sit');
    expect(character.playGesture('standUp')).toBe(true);
    frame(character, 400);
    expect(character.getPoseName()).toBe('idle');
  });
});

describe('runtime clip preparation', () => {
  const idleRef: [number, number, number] = [1, 74, 6];

  it('locks horizontal root motion on cloned gesture clips without touching the source', () => {
    const source = syntheticClip('open_door_3', 10, [[0, 74, 4], [-80, 74, 190]]);
    const runtime = prepareRuntimeClip(source, idleRef);
    const track = runtime.tracks.find((candidate) => candidate.name === 'Hips.position')!;
    for (let key = 0; key < track.times.length; key += 1) {
      expect(track.values[key * 3]).toBe(1);
      expect(track.values[key * 3 + 2]).toBe(6);
    }
    expect(Array.from(source.tracks[0].values)).toEqual([0, 74, 4, -80, 74, 190]);
    expect(source.name).toBe('open_door_3');
  });

  it('locks the jump clip vertically so it cannot double the physics jump', () => {
    const source = syntheticClip('Jump_Run', 2, [[0, 81, 15], [2, 110, 3]]);
    const runtime = prepareRuntimeClip(source, idleRef);
    const track = runtime.tracks.find((candidate) => candidate.name === 'Hips.position')!;
    for (let key = 0; key < track.times.length; key += 1) {
      expect(track.values[key * 3 + 1]).toBe(74);
    }
  });

  it('keeps the intentional seated hips drop while pinning seated clips in place', () => {
    const source = syntheticClip('Sitting_Clap', 3, [[0.6, 48, 9], [1.2, 49, 11]]);
    const runtime = prepareRuntimeClip(source, idleRef);
    const track = runtime.tracks.find((candidate) => candidate.name === 'Hips.position')!;
    expect(track.values[1]).toBeCloseTo(48, 4);
    expect(track.values[4]).toBeCloseTo(49, 4);
    expect(track.values[3]).toBeCloseTo(0.6, 4);
    expect(track.values[5]).toBeCloseTo(9, 4);
  });

  it('trims sub-clips by time with exact boundary samples', () => {
    const source = syntheticClip('Agree_Gesture', 13, [[0, 74, 0], [0, 74, 13]]);
    const runtime = prepareRuntimeClip(source, idleRef);
    expect(runtime.duration).toBeCloseTo(2.4, 5);
    expect(source.duration).toBe(13);

    const generic = trimClip(syntheticClip('linear', 10, [[0, 0, 0], [10, 10, 10]]), 'linear@cut', 2, 6);
    const track = generic.tracks[0];
    expect(track.times[0]).toBe(0);
    expect(track.times[track.times.length - 1]).toBeCloseTo(4, 5);
    expect(track.values[0]).toBeCloseTo(2, 4);
    expect(track.values[track.values.length - 3]).toBeCloseTo(6, 4);
  });
});
