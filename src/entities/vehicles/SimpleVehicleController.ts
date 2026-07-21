import {
  Box3,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CITY_MODEL_URLS } from '../../assets/AssetRegistry';
import { cityAssetCache } from '../../assets/GlbModelCache';
import type { InputSnapshot } from '../../controls/InputManager';
import type { CapsuleShape } from '../../physics/CollisionWorld';
import { CollisionWorld } from '../../physics/CollisionWorld';

/**
 * Real Kenney Car Kit model per drivable kind. Bicycles keep the procedural
 * visual (no suitable CC0 bicycle GLB was sourced this phase).
 */
const REAL_VEHICLE_MODEL_URLS: Readonly<Partial<Record<VehicleKind, string>>> = {
  compact: CITY_MODEL_URLS.vehicles.sedan,
  sport: CITY_MODEL_URLS.vehicles.sedanSports,
  classic: CITY_MODEL_URLS.vehicles.taxi,
};
const TARGET_VEHICLE_HEIGHT = 1.45;

export type VehicleKind = 'compact' | 'sport' | 'bicycle' | 'classic';

export interface VehicleConfig {
  id: string;
  displayName: string;
  kind: VehicleKind;
  size: Vector3;
  shape: CapsuleShape;
  paint: number;
  maxForwardSpeed: number;
  maxReverseSpeed: number;
  steeringRate: number;
  cameraHeight: number;
}

const DEFAULT_CONFIG: VehicleConfig = {
  id: 'mission-car',
  displayName: 'السيارة الصغيرة',
  kind: 'compact',
  size: new Vector3(1.9, 1.35, 3.4),
  shape: { radius: 1.02, height: 1.35 },
  paint: 0xd46b45,
  maxForwardSpeed: 7,
  maxReverseSpeed: 3.1,
  steeringRate: 1.65,
  cameraHeight: 0.42,
};

const proposedPosition = new Vector3();
const colliderCenter = new Vector3();
const exitCandidate = new Vector3();

export class SimpleVehicleController {
  readonly root = new Group();
  readonly position = new Vector3();
  readonly id: string;
  readonly displayName: string;
  readonly kind: VehicleKind;
  yaw = 0;
  speed = 0;
  occupied = false;
  available = true;
  private readonly wheels: Object3D[] = [];
  private visualGroup = new Group();
  private usingRealModel = false;
  private readonly initialPosition = new Vector3();
  private readonly colliderId: string;
  private readonly size: Vector3;
  private readonly shape: CapsuleShape;
  private readonly ignoredCollider: Set<string>;
  private readonly maxForwardSpeed: number;
  private readonly maxReverseSpeed: number;
  private readonly steeringRate: number;
  private readonly cameraHeight: number;
  private initialYaw = 0;

  constructor(
    private readonly collisions: CollisionWorld,
    position: Vector3,
    yaw = 0,
    options: Partial<VehicleConfig> = {},
  ) {
    const config = { ...DEFAULT_CONFIG, ...options };
    this.id = config.id;
    this.displayName = config.displayName;
    this.kind = config.kind;
    this.size = config.size.clone();
    this.shape = { ...config.shape };
    this.maxForwardSpeed = config.maxForwardSpeed;
    this.maxReverseSpeed = config.maxReverseSpeed;
    this.steeringRate = config.steeringRate;
    this.cameraHeight = config.cameraHeight;
    this.colliderId = `${this.id}-collider`;
    this.ignoredCollider = new Set([this.colliderId]);
    this.position.copy(position);
    this.initialPosition.copy(position);
    this.yaw = yaw;
    this.initialYaw = yaw;
    this.root.name = this.id;
    this.buildVisual(config.paint);
    // buildVisual() adds procedural parts straight to root; regroup them
    // under visualGroup so a later real-model swap can remove them as one
    // unit without touching buildCar/buildBicycle's individual mesh calls.
    while (this.root.children.length > 0) this.visualGroup.add(this.root.children[0]);
    this.root.add(this.visualGroup);
    this.syncTransform();
    this.collisions.addBox(
      this.colliderId,
      colliderCenter.copy(this.position).add(new Vector3(0, this.size.y * 0.5, 0)),
      this.size,
    );
  }

  update(delta: number, input: InputSnapshot): void {
    if (!this.available) return;
    if (!this.occupied) {
      this.speed = MathUtils.damp(this.speed, 0, 5, delta);
      return;
    }

    const throttle = MathUtils.clamp(input.move.y, -1, 1);
    const steering = MathUtils.clamp(input.move.x, -1, 1);
    const targetSpeed = throttle >= 0
      ? throttle * this.maxForwardSpeed
      : throttle * this.maxReverseSpeed;
    const acceleration = Math.abs(targetSpeed) < Math.abs(this.speed) ? 5.8 : 3.4;
    this.speed = MathUtils.damp(this.speed, targetSpeed, acceleration, delta);
    if (Math.abs(this.speed) < 0.025 && Math.abs(throttle) < 0.02) this.speed = 0;

    const speedRatio = Math.min(1, Math.abs(this.speed) / Math.max(2, this.maxForwardSpeed * 0.78));
    if (speedRatio > 0.025) {
      // The chase camera's screen-right direction is the negative world X
      // axis at the default route heading, so steering is subtracted once.
      this.yaw -= steering * Math.sign(this.speed) * speedRatio * this.steeringRate * delta;
    }

    proposedPosition.copy(this.position);
    proposedPosition.x += Math.sin(this.yaw) * this.speed * delta;
    proposedPosition.z += Math.cos(this.yaw) * this.speed * delta;
    if (this.collisions.overlapsCapsule(proposedPosition, this.shape, this.ignoredCollider)) {
      this.speed = 0;
    } else {
      this.position.copy(proposedPosition);
    }

    this.syncTransform();
    const wheelRotation = this.speed * delta / (this.kind === 'bicycle' ? 0.42 : 0.34);
    this.wheels.forEach((wheel) => { wheel.rotation.x += wheelRotation; });
  }

  canEnter(playerPosition: Vector3): boolean {
    return this.available && !this.occupied && playerPosition.distanceTo(this.position) <= 2.65;
  }

  enter(): void {
    if (!this.available) return;
    this.occupied = true;
  }

  findSafeExit(shape: CapsuleShape): Vector3 | null {
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const sideDistance = this.kind === 'bicycle' ? 1.25 : 1.65;
    const candidates = [
      [rightX * sideDistance, rightZ * sideDistance],
      [-rightX * sideDistance, -rightZ * sideDistance],
      [-Math.sin(this.yaw) * 2.0, -Math.cos(this.yaw) * 2.0],
    ];
    for (const [x, z] of candidates) {
      exitCandidate.set(this.position.x + x, 0, this.position.z + z);
      if (!this.collisions.overlapsCapsule(exitCandidate, shape, this.ignoredCollider)) {
        return exitCandidate.clone();
      }
    }
    return null;
  }

  exit(): void {
    this.occupied = false;
    this.speed = 0;
  }

  setAvailable(available: boolean): void {
    if (this.available === available) return;
    this.available = available;
    this.root.visible = available;
    this.collisions.setEnabled(this.colliderId, available);
    if (!available) this.exit();
  }

  reset(): void {
    this.position.copy(this.initialPosition);
    this.yaw = this.initialYaw;
    this.speed = 0;
    this.occupied = false;
    this.syncTransform();
  }

  teleport(position: Vector3, yaw = this.yaw): void {
    this.position.copy(position);
    this.yaw = yaw;
    this.speed = 0;
    this.syncTransform();
  }

  getCameraTarget(out: Vector3): Vector3 {
    return out.copy(this.position).setY(this.cameraHeight);
  }

  getColliderId(): string {
    return this.colliderId;
  }

  /**
   * Swaps the procedural placeholder for the real Kenney Car Kit model once
   * it is available in the shared cache. Safe to call before the cache is
   * warm (returns false and keeps the procedural visual, matching the
   * player character's load-failure fallback pattern) and a no-op if
   * already swapped or if this kind has no real-model mapping (bicycle).
   */
  trySwapToRealModel(): boolean {
    if (this.usingRealModel) return true;
    const url = REAL_VEHICLE_MODEL_URLS[this.kind];
    if (!url) return false;
    const model = cityAssetCache.clone(url);
    if (!model) return false;

    this.root.remove(this.visualGroup);
    this.wheels.length = 0;
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model);
    const nativeHeight = bounds.max.y - bounds.min.y;
    const scale = nativeHeight > 0.001 ? TARGET_VEHICLE_HEIGHT / nativeHeight : 1;

    const wrapper = new Group();
    wrapper.name = `${this.id}-real-model`;
    wrapper.scale.setScalar(scale);
    wrapper.add(model);
    for (const name of ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right']) {
      const wheel = model.getObjectByName(name);
      if (wheel) this.wheels.push(wheel);
    }
    model.traverse((object) => {
      if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true; }
    });

    this.visualGroup = wrapper;
    this.root.add(wrapper);
    this.usingRealModel = true;
    return true;
  }

  private syncTransform(): void {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
    colliderCenter.copy(this.position);
    colliderCenter.y += this.size.y * 0.5;
    if (this.collisions.getAll().some((collider) => collider.id === this.colliderId)) {
      this.collisions.updateBox(this.colliderId, colliderCenter, this.size);
    }
  }

  private buildVisual(paintColor: number): void {
    if (this.kind === 'bicycle') {
      this.buildBicycle(paintColor);
      return;
    }
    this.buildCar(paintColor);
  }

  private buildCar(paintColor: number): void {
    const paint = new MeshStandardMaterial({ color: paintColor, roughness: this.kind === 'sport' ? 0.42 : 0.55, metalness: 0.16 });
    const trim = new MeshStandardMaterial({ color: 0x142c38, roughness: 0.52, metalness: 0.24 });
    const glass = new MeshStandardMaterial({ color: 0x7eb6c0, roughness: 0.24, metalness: 0.05 });
    const tire = new MeshStandardMaterial({ color: 0x12191d, roughness: 0.92 });
    const light = new MeshStandardMaterial({ color: 0xffd890, emissive: 0xe39a36, emissiveIntensity: 0.35 });
    const sport = this.kind === 'sport';
    const classic = this.kind === 'classic';

    const chassis = new Mesh(new RoundedBoxGeometry(1.85, sport ? 0.42 : 0.55, 3.35, 3, sport ? 0.25 : 0.18), paint);
    chassis.position.y = sport ? 0.55 : 0.62;
    const cabin = new Mesh(new RoundedBoxGeometry(1.58, sport ? 0.58 : 0.72, sport ? 1.5 : 1.72, 3, 0.2), glass);
    cabin.position.set(0, sport ? 0.95 : 1.09, classic ? -0.25 : -0.12);
    const roof = new Mesh(new RoundedBoxGeometry(1.62, 0.12, sport ? 1.16 : 1.42, 2, 0.08), trim);
    roof.position.set(0, sport ? 1.27 : 1.48, -0.16);
    const bumper = new Mesh(new RoundedBoxGeometry(1.7, 0.18, 0.18, 2, 0.05), trim);
    bumper.position.set(0, 0.48, 1.72);
    const headlights = new Mesh(new RoundedBoxGeometry(1.25, 0.14, 0.08, 2, 0.03), light);
    headlights.position.set(0, 0.73, 1.72);
    this.root.add(chassis, cabin, roof, bumper, headlights);

    if (sport) {
      const spoiler = new Mesh(new RoundedBoxGeometry(1.55, 0.1, 0.28, 2, 0.04), trim);
      spoiler.position.set(0, 0.92, -1.55);
      this.root.add(spoiler);
    }
    if (classic) {
      const grille = new Mesh(new RoundedBoxGeometry(1.35, 0.42, 0.1, 2, 0.03), trim);
      grille.position.set(0, 0.66, 1.74);
      this.root.add(grille);
    }

    const wheelGeometry = new CylinderGeometry(0.34, 0.34, 0.22, 12);
    for (const x of [-0.92, 0.92]) {
      for (const z of [-1.12, 1.12]) {
        const wheel = new Mesh(wheelGeometry, tire);
        wheel.position.set(x, 0.38, z);
        wheel.rotation.z = Math.PI / 2;
        this.wheels.push(wheel);
        this.root.add(wheel);
      }
    }
    this.finishVisual();
  }

  private buildBicycle(paintColor: number): void {
    const frame = new MeshStandardMaterial({ color: paintColor, roughness: 0.52, metalness: 0.22 });
    const tire = new MeshStandardMaterial({ color: 0x142027, roughness: 0.92 });
    const trim = new MeshStandardMaterial({ color: 0xd9c8a4, roughness: 0.72 });
    const wheelGeometry = new CylinderGeometry(0.42, 0.42, 0.1, 16);
    for (const z of [-0.82, 0.82]) {
      const wheel = new Mesh(wheelGeometry, tire);
      wheel.position.set(0, 0.45, z);
      wheel.rotation.z = Math.PI / 2;
      this.wheels.push(wheel);
      this.root.add(wheel);
    }
    const lowerFrame = new Mesh(new RoundedBoxGeometry(0.12, 0.12, 1.45, 2, 0.04), frame);
    lowerFrame.position.set(0, 0.62, 0);
    const seatPost = new Mesh(new CylinderGeometry(0.055, 0.055, 0.78, 8), frame);
    seatPost.position.set(0, 0.93, -0.2);
    const seat = new Mesh(new RoundedBoxGeometry(0.42, 0.12, 0.28, 2, 0.05), trim);
    seat.position.set(0, 1.28, -0.2);
    const handle = new Mesh(new RoundedBoxGeometry(0.62, 0.08, 0.1, 2, 0.03), trim);
    handle.position.set(0, 1.28, 0.62);
    this.root.add(lowerFrame, seatPost, seat, handle);
    this.finishVisual();
  }

  private finishVisual(): void {
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }
}
