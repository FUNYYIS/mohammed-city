import {
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { InputSnapshot } from '../../controls/InputManager';
import type { CapsuleShape } from '../../physics/CollisionWorld';
import { CollisionWorld } from '../../physics/CollisionWorld';

const VEHICLE_COLLIDER_ID = 'mission-car-collider';
const VEHICLE_SIZE = new Vector3(1.9, 1.35, 3.4);
const VEHICLE_SHAPE: CapsuleShape = { radius: 1.02, height: 1.35 };
const proposedPosition = new Vector3();
const colliderCenter = new Vector3();
const exitCandidate = new Vector3();
const ignoredVehicle = new Set([VEHICLE_COLLIDER_ID]);

export class SimpleVehicleController {
  readonly root = new Group();
  readonly position = new Vector3();
  yaw = 0;
  speed = 0;
  occupied = false;
  private readonly wheels: Mesh[] = [];
  private readonly initialPosition = new Vector3();
  private initialYaw = 0;

  constructor(
    private readonly collisions: CollisionWorld,
    position: Vector3,
    yaw = 0,
  ) {
    this.position.copy(position);
    this.initialPosition.copy(position);
    this.yaw = yaw;
    this.initialYaw = yaw;
    this.root.name = 'mission-car';
    this.buildVisual();
    this.syncTransform();
    this.collisions.addBox(
      VEHICLE_COLLIDER_ID,
      colliderCenter.copy(this.position).add(new Vector3(0, VEHICLE_SIZE.y * 0.5, 0)),
      VEHICLE_SIZE,
    );
  }

  update(delta: number, input: InputSnapshot): void {
    if (!this.occupied) {
      this.speed = MathUtils.damp(this.speed, 0, 5, delta);
      return;
    }

    const throttle = MathUtils.clamp(input.move.y, -1, 1);
    const steering = MathUtils.clamp(input.move.x, -1, 1);
    const targetSpeed = throttle >= 0 ? throttle * 7 : throttle * 3.1;
    const acceleration = Math.abs(targetSpeed) < Math.abs(this.speed) ? 5.8 : 3.4;
    this.speed = MathUtils.damp(this.speed, targetSpeed, acceleration, delta);
    if (Math.abs(this.speed) < 0.025 && Math.abs(throttle) < 0.02) this.speed = 0;

    const speedRatio = Math.min(1, Math.abs(this.speed) / 5.5);
    if (speedRatio > 0.025) {
      this.yaw += steering * Math.sign(this.speed) * speedRatio * 1.65 * delta;
    }

    proposedPosition.copy(this.position);
    proposedPosition.x += Math.sin(this.yaw) * this.speed * delta;
    proposedPosition.z += Math.cos(this.yaw) * this.speed * delta;
    if (this.collisions.overlapsCapsule(proposedPosition, VEHICLE_SHAPE, ignoredVehicle)) {
      this.speed = 0;
    } else {
      this.position.copy(proposedPosition);
    }

    this.syncTransform();
    const wheelRotation = this.speed * delta / 0.34;
    this.wheels.forEach((wheel) => { wheel.rotation.x += wheelRotation; });
  }

  canEnter(playerPosition: Vector3): boolean {
    return !this.occupied && playerPosition.distanceTo(this.position) <= 2.65;
  }

  enter(): void {
    this.occupied = true;
  }

  findSafeExit(shape: CapsuleShape): Vector3 | null {
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const candidates = [
      [rightX * 1.65, rightZ * 1.65],
      [-rightX * 1.65, -rightZ * 1.65],
      [-Math.sin(this.yaw) * 2.0, -Math.cos(this.yaw) * 2.0],
    ];
    for (const [x, z] of candidates) {
      exitCandidate.set(this.position.x + x, 0, this.position.z + z);
      if (!this.collisions.overlapsCapsule(exitCandidate, shape, ignoredVehicle)) {
        return exitCandidate.clone();
      }
    }
    return null;
  }

  exit(): void {
    this.occupied = false;
    this.speed = 0;
  }

  reset(): void {
    this.position.copy(this.initialPosition);
    this.yaw = this.initialYaw;
    this.speed = 0;
    this.occupied = false;
    this.syncTransform();
  }

  getCameraTarget(out: Vector3): Vector3 {
    return out.copy(this.position).setY(0.42);
  }

  private syncTransform(): void {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
    colliderCenter.copy(this.position);
    colliderCenter.y += VEHICLE_SIZE.y * 0.5;
    if (this.collisions.getAll().some((collider) => collider.id === VEHICLE_COLLIDER_ID)) {
      this.collisions.updateBox(VEHICLE_COLLIDER_ID, colliderCenter, VEHICLE_SIZE);
    }
  }

  private buildVisual(): void {
    const paint = new MeshStandardMaterial({ color: 0xd46b45, roughness: 0.55, metalness: 0.16 });
    const trim = new MeshStandardMaterial({ color: 0x142c38, roughness: 0.52, metalness: 0.24 });
    const glass = new MeshStandardMaterial({ color: 0x7eb6c0, roughness: 0.24, metalness: 0.05 });
    const tire = new MeshStandardMaterial({ color: 0x12191d, roughness: 0.92 });
    const light = new MeshStandardMaterial({ color: 0xffd890, emissive: 0xe39a36, emissiveIntensity: 0.35 });

    const chassis = new Mesh(new RoundedBoxGeometry(1.85, 0.55, 3.35, 3, 0.18), paint);
    chassis.position.y = 0.62;
    const cabin = new Mesh(new RoundedBoxGeometry(1.58, 0.72, 1.72, 3, 0.2), glass);
    cabin.position.set(0, 1.09, -0.12);
    const roof = new Mesh(new RoundedBoxGeometry(1.62, 0.12, 1.42, 2, 0.08), trim);
    roof.position.set(0, 1.48, -0.16);
    const bumper = new Mesh(new RoundedBoxGeometry(1.7, 0.18, 0.18, 2, 0.05), trim);
    bumper.position.set(0, 0.48, 1.72);
    const headlights = new Mesh(new RoundedBoxGeometry(1.25, 0.14, 0.08, 2, 0.03), light);
    headlights.position.set(0, 0.73, 1.72);
    this.root.add(chassis, cabin, roof, bumper, headlights);

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
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }
}
