import { Box3, Vector3 } from 'three';

export interface StaticCollider {
  id: string;
  bounds: Box3;
  cameraBlocking: boolean;
}

export interface CapsuleShape {
  radius: number;
  height: number;
}

const candidate = new Vector3();

export class CollisionWorld {
  private readonly colliders: StaticCollider[] = [];

  addBox(id: string, center: Vector3, size: Vector3, cameraBlocking = true): StaticCollider {
    const half = size.clone().multiplyScalar(0.5);
    const collider = {
      id,
      bounds: new Box3(center.clone().sub(half), center.clone().add(half)),
      cameraBlocking,
    };
    this.colliders.push(collider);
    return collider;
  }

  getAll(): readonly StaticCollider[] {
    return this.colliders;
  }

  overlapsCapsule(position: Vector3, shape: CapsuleShape): boolean {
    const capsuleMinY = position.y + 0.03;
    const capsuleMaxY = position.y + shape.height;

    return this.colliders.some(({ bounds }) => {
      if (capsuleMaxY <= bounds.min.y || capsuleMinY >= bounds.max.y) return false;
      const closestX = Math.max(bounds.min.x, Math.min(position.x, bounds.max.x));
      const closestZ = Math.max(bounds.min.z, Math.min(position.z, bounds.max.z));
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      return dx * dx + dz * dz < shape.radius * shape.radius;
    });
  }

  moveCapsule(position: Vector3, displacement: Vector3, shape: CapsuleShape): Vector3 {
    const horizontalDistance = Math.hypot(displacement.x, displacement.z);
    const steps = Math.max(1, Math.ceil(horizontalDistance / Math.max(0.12, shape.radius * 0.45)));
    const stepX = displacement.x / steps;
    const stepZ = displacement.z / steps;

    candidate.copy(position);
    for (let index = 0; index < steps; index += 1) {
      candidate.x += stepX;
      if (this.overlapsCapsule(candidate, shape)) candidate.x -= stepX;

      candidate.z += stepZ;
      if (this.overlapsCapsule(candidate, shape)) candidate.z -= stepZ;
    }

    candidate.y = Math.max(0, position.y + displacement.y);
    return position.copy(candidate);
  }
}
