import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Group,
  InterpolateDiscrete,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  Matrix4,
  Mesh,
  SkinnedMesh,
  VectorKeyframeTrack,
} from 'three';
import type { AnimationAction, KeyframeTrack, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  CharacterAssetAdapter,
  MOHAMMED_ANIMATION_MAPPINGS,
  MOHAMMED_BONE_MAP,
} from './CharacterAssetAdapter';
import type { CharacterAction } from './CharacterAssetAdapter';
import type {
  CharacterGestureName,
  CharacterPoseInput,
  CharacterPoseName,
  CharacterRenderMetrics,
  CharacterVisual,
} from './CharacterVisual';
import { PLAYER_VISUAL_WRAPPER_SCALE } from './PlayerView';

/** Net world height of the rendered character including the PlayerView wrapper scale. */
const TARGET_NET_HEIGHT = 1.74;

/**
 * Hips-translation policy applied to runtime clip clones only; the imported
 * clips stay untouched. The controller owns all world movement, so clips that
 * travel (door walk, counterstrike-style lunges, stand-up slide) get their
 * horizontal hips path locked. Seated clips keep their authored hips drop.
 * Jump_Run also locks Y because its jump arc conflicts with the physics jump.
 */
const ROOT_MOTION_POLICIES: Readonly<Record<string, 'keep' | 'lockXZToClipStart' | 'lockXZToIdle' | 'lockAllToIdle'>> = {
  Idle_02: 'keep',
  Walking: 'keep',
  Running: 'keep',
  Jump_Run: 'lockAllToIdle',
  open_door_3: 'lockXZToIdle',
  Male_Bend_Over_Pick_Up: 'lockXZToIdle',
  Big_Wave_Hello: 'lockXZToIdle',
  Agree_Gesture: 'lockXZToIdle',
  Sit_to_Stand_Transition_M: 'lockXZToIdle',
  Sit_Finger_Wag_No: 'lockXZToClipStart',
  Sitting_Clap: 'lockXZToClipStart',
};

/**
 * Runtime-only trims of over-long source gestures, in seconds of the source
 * clip. The full open_door_3 walks ~1.9 m to a door across 10.83 s and
 * Agree_Gesture repeats its nod for 13 s, so gameplay uses these named cloned
 * sub-clips while the originals remain imported and unmodified.
 */
const GESTURE_TRIMS: Readonly<Record<string, { start: number; end: number }>> = {
  open_door_3: { start: 3.2, end: 6.4 },
  Male_Bend_Over_Pick_Up: { start: 0.5, end: 4.6 },
  Agree_Gesture: { start: 0.3, end: 2.7 },
  Big_Wave_Hello: { start: 0.4, end: 3.2 },
};

const HIPS_POSITION_TRACK = `${MOHAMMED_BONE_MAP.hips}.position`;

const WALK_TIME_SCALE = 1.35;
const RUN_TIME_SCALE = 1.3;
const LOCOMOTION_FADE = 0.22;
const AIRBORNE_FADE = 0.14;
const GESTURE_FADE = 0.22;

function sampleTrack(track: KeyframeTrack, time: number): number[] {
  const factory = track as unknown as { createInterpolant(): { evaluate(time: number): Float32Array } };
  const interpolant = factory.createInterpolant();
  const sampled = interpolant.evaluate(MathUtils.clamp(time, track.times[0], track.times[track.times.length - 1]));
  return Array.from(sampled);
}

/**
 * Time-based trim that always keeps exact boundary samples, unlike
 * frame-based AnimationUtils.subclip which can empty sparse STEP tracks.
 */
export function trimClip(source: AnimationClip, name: string, start: number, end: number): AnimationClip {
  const tracks = source.tracks.map((track) => {
    const valueSize = track.getValueSize();
    const times: number[] = [start];
    const values: number[] = sampleTrack(track, start);
    for (let index = 0; index < track.times.length; index += 1) {
      const time = track.times[index];
      if (time <= start || time >= end) continue;
      times.push(time);
      for (let component = 0; component < valueSize; component += 1) {
        values.push(track.values[index * valueSize + component]);
      }
    }
    times.push(end);
    values.push(...sampleTrack(track, end));
    const trimmed = track.clone();
    trimmed.times = Float32Array.from(times.map((time) => time - start));
    trimmed.values = Float32Array.from(values);
    if (track.getInterpolation() === InterpolateDiscrete) trimmed.setInterpolation(InterpolateDiscrete);
    return trimmed;
  });
  return new AnimationClip(name, end - start, tracks);
}

function lockHipsTranslation(clip: AnimationClip, referenceXZ: readonly [number, number], lockY: number | null): void {
  const track = clip.tracks.find((candidate) => candidate.name === HIPS_POSITION_TRACK);
  if (!(track instanceof VectorKeyframeTrack)) return;
  for (let index = 0; index < track.times.length; index += 1) {
    track.values[index * 3] = referenceXZ[0];
    if (lockY !== null) track.values[index * 3 + 1] = lockY;
    track.values[index * 3 + 2] = referenceXZ[1];
  }
}

function hipsReference(clip: AnimationClip | undefined): [number, number, number] {
  const track = clip?.tracks.find((candidate) => candidate.name === HIPS_POSITION_TRACK);
  if (!track || track.values.length < 3) return [0, 0, 0];
  return [track.values[0], track.values[1], track.values[2]];
}

export function prepareRuntimeClip(source: AnimationClip, idleRef: [number, number, number]): AnimationClip {
  const trim = GESTURE_TRIMS[source.name];
  const clip = trim
    ? trimClip(source, `${source.name}@runtime`, trim.start, trim.end)
    : source.clone();
  if (!trim) clip.name = `${source.name}@runtime`;
  const policy = ROOT_MOTION_POLICIES[source.name] ?? 'lockXZToIdle';
  if (policy === 'lockXZToIdle') lockHipsTranslation(clip, [idleRef[0], idleRef[2]], null);
  else if (policy === 'lockAllToIdle') lockHipsTranslation(clip, [idleRef[0], idleRef[2]], idleRef[1]);
  else if (policy === 'lockXZToClipStart') {
    const start = hipsReference(clip);
    lockHipsTranslation(clip, [start[0], start[2]], null);
  }
  return clip;
}

function measureRestBounds(root: Object3D): Box3 {
  root.updateMatrixWorld(true);
  const bounds = new Box3();
  const meshBounds = new Box3();
  const world = new Matrix4();
  root.traverse((object) => {
    if (object instanceof SkinnedMesh) {
      object.computeBoundingBox();
      if (object.boundingBox) {
        meshBounds.copy(object.boundingBox);
        bounds.union(meshBounds.applyMatrix4(object.matrixWorld));
      }
      return;
    }
    if (object instanceof Mesh) {
      object.geometry.computeBoundingBox();
      if (object.geometry.boundingBox) {
        meshBounds.copy(object.geometry.boundingBox);
        world.copy(object.matrixWorld);
        bounds.union(meshBounds.applyMatrix4(world));
      }
    }
  });
  return bounds;
}

/**
 * GLB-backed CharacterVisual for Mohammed. One mixer, all actions created and
 * cached once, crossfaded locomotion plus a single-slot gesture layer. World
 * movement stays fully owned by PlayerController; this class only poses the
 * mesh under the PlayerView anchor.
 */
export class MohammedGlbCharacter implements CharacterVisual {
  readonly root = new Group();
  readonly adapter: CharacterAssetAdapter;
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<CharacterAction, AnimationAction>();
  private readonly metrics: CharacterRenderMetrics = { drawCalls: 0, triangles: 0 };
  private readonly missingClips: string[] = [];
  private current: AnimationAction | null = null;
  private activeGesture: CharacterGestureName | null = null;
  private wasGrounded = true;
  private speedBlend = 0;
  private poseName: CharacterPoseName | CharacterGestureName = 'idle';

  constructor(sceneRoot: Object3D, clips: AnimationClip[]) {
    this.root.name = 'mohammed-glb-character';
    this.adapter = new CharacterAssetAdapter(sceneRoot, clips, MOHAMMED_BONE_MAP, MOHAMMED_ANIMATION_MAPPINGS);

    // The GLB faces +Z while the game's characters face -Z, so orientation is
    // corrected here inside the visual wrapper, never on the controller.
    const orientation = new Group();
    orientation.name = 'mohammed-glb-orientation';
    orientation.rotation.y = Math.PI;
    orientation.add(sceneRoot);
    this.root.add(orientation);

    const bounds = measureRestBounds(sceneRoot);
    const measuredHeight = bounds.max.y - bounds.min.y;
    if (Number.isFinite(measuredHeight) && measuredHeight > 0.5) {
      this.root.scale.setScalar(TARGET_NET_HEIGHT / measuredHeight / PLAYER_VISUAL_WRAPPER_SCALE);
      orientation.position.y = -bounds.min.y;
    } else {
      console.warn(`[MohammedGlbCharacter] implausible rest height ${measuredHeight}; keeping native scale`);
    }

    sceneRoot.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      // The player is always near the camera; skinned-pose bounds otherwise
      // lag the animation and can cull the character at screen edges.
      object.frustumCulled = false;
      this.metrics.drawCalls += 1;
      const geometry = object.geometry;
      this.metrics.triangles += (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;
    });

    this.mixer = new AnimationMixer(sceneRoot);
    const idleRef = hipsReference(clips.find((clip) => clip.name === 'Idle_02'));
    for (const mapping of MOHAMMED_ANIMATION_MAPPINGS) {
      const source = this.adapter.findClip(mapping.action);
      if (!source) {
        this.missingClips.push(`${mapping.action} -> ${mapping.sourceClip}`);
        continue;
      }
      const action = this.mixer.clipAction(prepareRuntimeClip(source, idleRef));
      if (mapping.loop) {
        action.setLoop(LoopRepeat, Infinity);
      } else {
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(mapping.action, action);
    }
    if (this.missingClips.length > 0) {
      console.warn(`[MohammedGlbCharacter] missing clips, affected states fall back to idle: ${this.missingClips.join(', ')}`);
    }
    this.actions.get('walk')?.setEffectiveTimeScale(WALK_TIME_SCALE);
    this.actions.get('run')?.setEffectiveTimeScale(RUN_TIME_SCALE);

    this.mixer.addEventListener('finished', (event) => this.onActionFinished(event.action));
  }

  static async load(url: string, loader = new GLTFLoader()): Promise<MohammedGlbCharacter> {
    const gltf = await loader.loadAsync(url);
    return new MohammedGlbCharacter(gltf.scene, gltf.animations);
  }

  update(input: CharacterPoseInput): void {
    const delta = Math.min(input.delta, 1 / 20);
    this.speedBlend = MathUtils.damp(this.speedBlend, MathUtils.clamp(input.speedRatio, 0, 1), 10, delta);
    const moving = this.speedBlend > 0.06;

    if (this.activeGesture && (moving || !input.grounded)) this.cancelGesture();

    if (!this.activeGesture) {
      if (!input.grounded) {
        this.poseName = input.verticalVelocity >= -0.2 ? 'jump' : 'fall';
        if (this.wasGrounded) this.startJump();
      } else {
        if (input.crouching) this.poseName = 'crouch';
        // Plain walking reaches speedRatio ~0.76 (3.2/4.2), so the discrete
        // run clip only starts above it, unlike the old blended rig's 0.72.
        else if (this.speedBlend > 0.85) this.poseName = 'run';
        else if (moving) this.poseName = 'walk';
        else this.poseName = 'idle';
        // No crouch clip exists in the export; crouch reuses idle/walk while
        // the controller already limits crouch speed.
        const base = this.poseName === 'run' ? 'run' : moving ? 'walk' : 'idle';
        this.crossfadeTo(base, input.justLanded ? AIRBORNE_FADE : LOCOMOTION_FADE);
      }
    } else {
      this.poseName = this.activeGesture;
    }

    this.wasGrounded = input.grounded;
    this.mixer.update(delta);
  }

  playGesture(name: CharacterGestureName): boolean {
    const action = this.actions.get(name);
    if (!action) return false;
    if (!this.wasGrounded || this.speedBlend > 0.12) return false;
    if (this.activeGesture) {
      const seatedState = this.activeGesture === 'sit'
        || this.activeGesture === 'seatedClap'
        || this.activeGesture === 'standUp';
      if (seatedState) {
        const seatedFollowUp = this.activeGesture === 'sit' && (name === 'seatedClap' || name === 'standUp');
        if (!seatedFollowUp) return false;
      } else if (this.activeGesture === name) {
        // Never restart the running action; a *different* interaction gesture
        // preempts the current one with a crossfade instead of stacking.
        return false;
      }
    } else if (name === 'seatedClap' || name === 'standUp') {
      return false;
    }

    this.activeGesture = name;
    this.poseName = name;
    this.fadeInto(action, GESTURE_FADE);
    return true;
  }

  getPoseName(): CharacterPoseName | CharacterGestureName {
    return this.poseName;
  }

  getRenderMetrics(): CharacterRenderMetrics {
    return { ...this.metrics };
  }

  getMissingClips(): readonly string[] {
    return this.missingClips;
  }

  getActiveClipName(): string | null {
    return this.current?.getClip().name ?? null;
  }

  private onActionFinished(action: AnimationAction): void {
    if (!this.activeGesture || action !== this.actions.get(this.activeGesture)) return;
    if (this.activeGesture === 'seatedClap') {
      this.activeGesture = 'sit';
      const sit = this.actions.get('sit');
      if (sit) {
        this.fadeInto(sit, GESTURE_FADE);
        return;
      }
    }
    this.activeGesture = null;
    this.crossfadeTo('idle', GESTURE_FADE);
  }

  private cancelGesture(): void {
    this.activeGesture = null;
    this.current?.fadeOut(AIRBORNE_FADE);
    this.current = null;
  }

  private startJump(): void {
    const jump = this.actions.get('jump') ?? this.actions.get('idle');
    if (jump) this.fadeInto(jump, AIRBORNE_FADE);
  }

  private crossfadeTo(action: CharacterAction, duration: number): void {
    const next = this.actions.get(action) ?? this.actions.get('idle');
    if (next) this.fadeInto(next, duration);
  }

  private fadeInto(next: AnimationAction, duration: number): void {
    if (this.current === next && next.isRunning()) return;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.reset();
    next.play();
    if (this.current && this.current !== next) this.current.crossFadeTo(next, duration, false);
    else next.fadeIn(duration);
    this.current = next;
  }
}
