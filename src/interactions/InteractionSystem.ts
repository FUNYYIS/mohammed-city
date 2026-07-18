import { Vector3 } from 'three';
import { CollisionWorld } from '../physics/CollisionWorld';

export interface InteractableDefinition {
  id: string;
  label: string;
  position: Vector3;
  maxDistance?: number;
  minFacingDot?: number;
  priority?: number;
  lineOfSightIgnore?: readonly string[];
}

const eye = new Vector3();
const toTarget = new Vector3();
const horizontalDirection = new Vector3();
const facing = new Vector3();

export class InteractionSystem {
  constructor(private readonly collisions: CollisionWorld) {}

  findBest(
    playerPosition: Vector3,
    playerYaw: number,
    interactables: readonly InteractableDefinition[],
  ): InteractableDefinition | null {
    eye.copy(playerPosition);
    eye.y += 1.05;
    facing.set(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));

    let best: InteractableDefinition | null = null;
    let bestScore = -Infinity;
    for (const interactable of interactables) {
      toTarget.copy(interactable.position).sub(eye);
      const distance = toTarget.length();
      if (distance > (interactable.maxDistance ?? 2.25)) continue;

      horizontalDirection.set(toTarget.x, 0, toTarget.z);
      if (horizontalDirection.lengthSq() > 0.0001) horizontalDirection.normalize();
      const facingDot = facing.dot(horizontalDirection);
      if (facingDot < (interactable.minFacingDot ?? 0.1)) continue;

      const ignored = interactable.lineOfSightIgnore
        ? new Set(interactable.lineOfSightIgnore)
        : undefined;
      if (!this.collisions.hasLineOfSight(eye, interactable.position, ignored)) continue;

      const score = (interactable.priority ?? 0) * 10 + facingDot * 2 - distance;
      if (score <= bestScore) continue;
      best = interactable;
      bestScore = score;
    }
    return best;
  }
}
