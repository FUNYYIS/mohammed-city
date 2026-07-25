import {
  AnimationAction,
  AnimationMixer,
  Box3,
  CylinderGeometry,
  Group,
  LoopRepeat,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CITY_MODEL_URLS } from '../../assets/AssetRegistry';
import { cityAssetCache } from '../../assets/GlbModelCache';
import type { CollisionWorld } from '../../physics/CollisionWorld';

const nextPosition = new Vector3();
const NPC_MODEL_URLS = Object.values(CITY_MODEL_URLS.npcs);
const TARGET_NPC_HEIGHT = 1.68;
const ANIMATION_FADE = 0.3;
const WALK_SPEED = 0.72;
// The Kenney "walk" clip has no baked root motion (a pure in-place cycle,
// confirmed by inspecting its translation track), so at the default 1x
// speed its brisk ~0.667s stride cadence visibly outpaces this NPC's slow
// 0.72 u/s ground speed -- the legs look like they are on a treadmill while
// the body barely advances. Slowing the clip keeps a plausible stride
// length for the actual translation speed and removes that foot-sliding look.
const WALK_ANIMATION_TIME_SCALE = 0.5;
// Mobile-safe active bubble: the nearby block remains busy while characters
// beyond normal street-view range stop rendering, animating, and colliding.
const ACTIVE_DISTANCE_SQUARED = 16 * 16;

export interface CityNPCStyle {
  clothing: number;
  accent: number;
  skin?: number;
}

function pickModelUrl(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return NPC_MODEL_URLS[hash % NPC_MODEL_URLS.length];
}

export class CityNPC {
  readonly root = new Group();
  private readonly leftArm = new Group();
  private readonly rightArm = new Group();
  private readonly leftLeg = new Group();
  private readonly rightLeg = new Group();
  private elapsed = 0;
  private waypointIndex = 0;
  private usingRealModel = false;
  private mixer: AnimationMixer | null = null;
  private idleAction: AnimationAction | null = null;
  private walkAction: AnimationAction | null = null;
  private currentAction: AnimationAction | null = null;
  // Collider footprint, matched to this NPC's own loaded model rather than a
  // guessed constant -- set from the real (scaled) GLB bounds in
  // buildRealVisual() below; the procedural fallback's own proportions (a
  // torso roughly 0.62 wide) keep this default when no GLB is available.
  private colliderWidth = 0.72;
  private colliderDepth = 0.72;

  constructor(
    readonly id: string,
    readonly displayName: string,
    private readonly waypoints: readonly Vector3[],
    style: CityNPCStyle,
    private readonly collisions?: CollisionWorld,
  ) {
    this.root.name = `npc-${id}`;
    this.root.position.copy(waypoints[0]);
    this.buildVisual(style);
    this.collisions?.addBox(
      this.getColliderId(),
      new Vector3(this.root.position.x, TARGET_NPC_HEIGHT * 0.5, this.root.position.z),
      new Vector3(this.colliderWidth, TARGET_NPC_HEIGHT, this.colliderDepth),
    );
  }

  update(delta: number, playerPosition: Vector3): void {
    this.elapsed += delta;
    const playerDistanceSquared = this.root.position.distanceToSquared(playerPosition);
    const renderActive = playerDistanceSquared <= ACTIVE_DISTANCE_SQUARED;
    this.root.visible = renderActive;
    this.collisions?.setEnabled(this.getColliderId(), renderActive);
    if (!renderActive) return;
    const target = this.waypoints[this.waypointIndex];
    nextPosition.copy(target).sub(this.root.position);
    nextPosition.y = 0;
    const distance = nextPosition.length();
    const nearPlayer = playerDistanceSquared < 16;

    if (distance < 0.18) {
      this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
    } else {
      nextPosition.normalize();
      const speed = nearPlayer ? 0 : WALK_SPEED;
      this.root.position.addScaledVector(nextPosition, Math.min(distance, speed * delta));
      if (!nearPlayer) {
        // The character visual faces -Z (same convention as PlayerController),
        // so the yaw needs the same negated atan2 the player uses; without
        // it the model walked with its back to the direction of travel.
        const yaw = Math.atan2(-nextPosition.x, -nextPosition.z);
        this.root.rotation.y = MathUtils.damp(this.root.rotation.y, yaw, 8, delta);
      }
    }

    if (nearPlayer) {
      const lookX = playerPosition.x - this.root.position.x;
      const lookZ = playerPosition.z - this.root.position.z;
      const yaw = Math.atan2(-lookX, -lookZ);
      this.root.rotation.y = MathUtils.damp(this.root.rotation.y, yaw, 7, delta);
    }

    const walking = !nearPlayer && distance >= 0.18;
    this.collisions?.updateBox(
      this.getColliderId(),
      new Vector3(this.root.position.x, TARGET_NPC_HEIGHT * 0.5, this.root.position.z),
      new Vector3(this.colliderWidth, TARGET_NPC_HEIGHT, this.colliderDepth),
    );
    if (this.usingRealModel) {
      this.updateRealAnimation(walking, delta);
      return;
    }
    const swing = walking ? Math.sin(this.elapsed * 7.5) * 0.42 : Math.sin(this.elapsed * 1.8) * 0.035;
    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing * 0.8;
    this.rightLeg.rotation.x = swing * 0.8;
  }

  getColliderId(): string { return `npc-${this.id}-collider`; }

  private updateRealAnimation(walking: boolean, delta: number): void {
    const next = (walking ? this.walkAction : this.idleAction) ?? this.currentAction;
    if (next && next !== this.currentAction) {
      next.reset().play();
      if (this.currentAction) this.currentAction.crossFadeTo(next, ANIMATION_FADE, false);
      else next.fadeIn(ANIMATION_FADE);
      this.currentAction = next;
    }
    this.mixer?.update(delta);
  }

  private buildVisual(style: CityNPCStyle): void {
    const url = pickModelUrl(this.id);
    const model = cityAssetCache.clone(url);
    if (model) {
      this.buildRealVisual(model, url);
      return;
    }
    console.warn(`[CityNPC] "${url}" not cached; falling back to the procedural pedestrian for ${this.id}`);
    this.buildProceduralVisual(style);
  }

  private buildRealVisual(model: Object3D, url: string): void {
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model);
    const nativeHeight = bounds.max.y - bounds.min.y;
    const scale = nativeHeight > 0.001 ? TARGET_NPC_HEIGHT / nativeHeight : 1;
    // Real footprint from this exact model's own bounds (bind pose), scaled
    // the same way its height was -- not a guessed constant, and specific to
    // whichever of the three "men" GLBs pickModelUrl() chose for this NPC.
    this.colliderWidth = (bounds.max.x - bounds.min.x) * scale;
    this.colliderDepth = (bounds.max.z - bounds.min.z) * scale;

    const orientation = new Group();
    orientation.name = 'npc-orientation';
    orientation.rotation.y = Math.PI;
    model.position.y -= bounds.min.y;
    orientation.add(model);

    const wrapper = new Group();
    wrapper.name = 'npc-real-model';
    wrapper.scale.setScalar(scale);
    wrapper.add(orientation);
    this.root.add(wrapper);

    model.traverse((object) => {
      if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; }
    });

    const clips = cityAssetCache.getClips(url);
    const idleClip = clips.find((clip) => clip.name.trim().toLowerCase() === 'idle');
    const walkClip = clips.find((clip) => clip.name.trim().toLowerCase() === 'walk');
    if (idleClip || walkClip) {
      this.mixer = new AnimationMixer(model);
      if (idleClip) {
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setLoop(LoopRepeat, Infinity);
        this.idleAction.play();
        this.currentAction = this.idleAction;
      }
      if (walkClip) {
        this.walkAction = this.mixer.clipAction(walkClip);
        this.walkAction.setLoop(LoopRepeat, Infinity);
        this.walkAction.setEffectiveTimeScale(WALK_ANIMATION_TIME_SCALE);
      }
    }
    this.usingRealModel = true;
  }

  private buildProceduralVisual(style: CityNPCStyle): void {
    const skin = new MeshStandardMaterial({ color: style.skin ?? 0xb97855, roughness: 0.82 });
    const clothes = new MeshStandardMaterial({ color: style.clothing, roughness: 0.86 });
    const accent = new MeshStandardMaterial({ color: style.accent, roughness: 0.72 });
    const dark = new MeshStandardMaterial({ color: 0x17232b, roughness: 0.88 });

    const torso = new Mesh(new RoundedBoxGeometry(0.62, 0.78, 0.38, 3, 0.12), clothes);
    torso.position.y = 1.12;
    const head = new Mesh(new SphereGeometry(0.28, 12, 8), skin);
    head.scale.set(0.9, 1.05, 0.9);
    head.position.y = 1.72;
    const hair = new Mesh(new SphereGeometry(0.285, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), dark);
    hair.position.y = 1.79;
    const collar = new Mesh(new CylinderGeometry(0.13, 0.2, 0.18, 8), accent);
    collar.position.y = 1.47;
    this.root.add(torso, head, hair, collar);

    this.leftArm.position.set(-0.38, 1.38, 0);
    this.rightArm.position.set(0.38, 1.38, 0);
    const armGeometry = new RoundedBoxGeometry(0.18, 0.7, 0.2, 2, 0.07);
    const leftArmMesh = new Mesh(armGeometry, clothes);
    const rightArmMesh = new Mesh(armGeometry, clothes);
    leftArmMesh.position.y = -0.3;
    rightArmMesh.position.y = -0.3;
    this.leftArm.add(leftArmMesh);
    this.rightArm.add(rightArmMesh);

    this.leftLeg.position.set(-0.17, 0.76, 0);
    this.rightLeg.position.set(0.17, 0.76, 0);
    const legGeometry = new RoundedBoxGeometry(0.22, 0.7, 0.26, 2, 0.07);
    const leftLegMesh = new Mesh(legGeometry, accent);
    const rightLegMesh = new Mesh(legGeometry, accent);
    leftLegMesh.position.y = -0.32;
    rightLegMesh.position.y = -0.32;
    this.leftLeg.add(leftLegMesh);
    this.rightLeg.add(rightLegMesh);
    this.root.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);

    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }
}
