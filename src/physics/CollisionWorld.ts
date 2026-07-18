import { Box3, Ray, Vector3 } from 'three';

export interface StaticCollider {
  id: string;
  bounds: Box3;
  cameraBlocking: boolean;
  enabled: boolean;
}

export interface CapsuleShape {
  radius: number;
  height: number;
}

export interface CapsuleMoveResult {
  position: Vector3;
  collidedX: boolean;
  collidedZ: boolean;
  hitGround: boolean;
  hitCeiling: boolean;
}

const candidate = new Vector3();
const rayDirection = new Vector3();
const rayHit = new Vector3();
const sightRay = new Ray();

export class CollisionWorld {
  private readonly colliders: StaticCollider[] = [];

  addBox(id: string, center: Vector3, size: Vector3, cameraBlocking = true): StaticCollider {
    const half = size.clone().multiplyScalar(0.5);
    const collider = {
      id,
      bounds: new Box3(center.clone().sub(half), center.clone().add(half)),
      cameraBlocking,
      enabled: true,
    };
    this.colliders.push(collider);
    return collider;
  }

  getAll(): readonly StaticCollider[] {
    return this.colliders;
  }

  setEnabled(id: string, enabled: boolean): void {
    const collider = this.colliders.find((item) => item.id === id);
    if (!collider) throw new Error(`Unknown collider: ${id}`);
    collider.enabled = enabled;
  }

  updateBox(id: string, center: Vector3, size: Vector3): void {
    const collider = this.colliders.find((item) => item.id === id);
    if (!collider) throw new Error(`Unknown collider: ${id}`);
    const half = size.clone().multiplyScalar(0.5);
    collider.bounds.set(center.clone().sub(half), center.clone().add(half));
  }

  overlapsCapsule(position: Vector3, shape: CapsuleShape, ignoredIds?: ReadonlySet<string>): boolean {
    const capsuleMinY = position.y + 0.03;
    const capsuleMaxY = position.y + shape.height;

    return this.colliders.some(({ id, bounds, enabled }) => {
      if (!enabled || ignoredIds?.has(id)) return false;
      if (capsuleMaxY <= bounds.min.y || capsuleMinY >= bounds.max.y) return false;
      return this.overlapsBoundsXZ(position, bounds, shape.radius);
    });
  }

  hasLineOfSight(start: Vector3, end: Vector3, ignoredIds?: ReadonlySet<string>): boolean {
    rayDirection.copy(end).sub(start);
    const distance = rayDirection.length();
    if (distance <= 0.001) return true;
    rayDirection.multiplyScalar(1 / distance);
    sightRay.set(start, rayDirection);

    return !this.colliders.some(({ id, bounds, enabled }) => {
      if (!enabled || ignoredIds?.has(id) || bounds.containsPoint(start)) return false;
      const hit = sightRay.intersectBox(bounds, rayHit);
      return Boolean(hit && hit.distanceTo(start) < distance - 0.06);
    });
  }

  moveCapsule(position: Vector3, displacement: Vector3, shape: CapsuleShape): Vector3 {
    return this.moveCapsuleWithResult(position, displacement, shape).position;
  }

  moveCapsuleWithResult(position: Vector3, displacement: Vector3, shape: CapsuleShape): CapsuleMoveResult {
    const horizontalDistance = Math.hypot(displacement.x, displacement.z);
    const steps = Math.max(1, Math.ceil(horizontalDistance / Math.max(0.12, shape.radius * 0.45)));
    const stepX = displacement.x / steps;
    const stepZ = displacement.z / steps;
    let collidedX = false;
    let collidedZ = false;
    let hitGround = false;
    let hitCeiling = false;

    candidate.copy(position);
    for (let index = 0; index < steps; index += 1) {
      candidate.x += stepX;
      if (this.overlapsCapsule(candidate, shape)) {
        candidate.x -= stepX;
        collidedX = true;
      }

      candidate.z += stepZ;
      if (this.overlapsCapsule(candidate, shape)) {
        candidate.z -= stepZ;
        collidedZ = true;
      }
    }

    const currentBottom = position.y;
    const currentTop = position.y + shape.height;
    let nextY = position.y + displacement.y;

    if (displacement.y > 0) {
      const proposedTop = nextY + shape.height;
      for (const { bounds, enabled } of this.colliders) {
        if (!enabled) continue;
        if (!this.overlapsBoundsXZ(candidate, bounds, shape.radius)) continue;
        const crossesCeiling = currentTop <= bounds.min.y + 0.0001
          && proposedTop >= bounds.min.y
          && nextY < bounds.max.y;
        if (!crossesCeiling) continue;
        nextY = Math.min(nextY, bounds.min.y - shape.height);
        hitCeiling = true;
      }
    } else if (displacement.y < 0) {
      for (const { bounds, enabled } of this.colliders) {
        if (!enabled) continue;
        if (!this.overlapsBoundsXZ(candidate, bounds, shape.radius)) continue;
        const crossesPlatform = currentBottom >= bounds.max.y - 0.0001
          && nextY <= bounds.max.y
          && currentTop > bounds.min.y;
        if (!crossesPlatform) continue;
        nextY = Math.max(nextY, bounds.max.y);
        hitGround = true;
      }
    }

    if (nextY <= 0) {
      nextY = 0;
      hitGround = displacement.y < 0;
    }
    candidate.y = nextY;
    position.copy(candidate);
    return { position, collidedX, collidedZ, hitGround, hitCeiling };
  }

  private overlapsBoundsXZ(position: Vector3, bounds: Box3, radius: number): boolean {
    const closestX = Math.max(bounds.min.x, Math.min(position.x, bounds.max.x));
    const closestZ = Math.max(bounds.min.z, Math.min(position.z, bounds.max.z));
    const dx = position.x - closestX;
    const dz = position.z - closestZ;
    return dx * dx + dz * dz < radius * radius;
  }
}
