import { Box3, Group, Object3D, Vector3 } from 'three';
import type { CollisionWorld } from '../../physics/CollisionWorld';

const bounds = new Box3();

/**
 * Purely decorative background traffic: loops a real vehicle model back and
 * forth between two points for city-ambiance. Not driveable --
 * SimpleVehicleController remains the only enterable vehicle system. Kept
 * intentionally simple (no steering, no physics) to match this phase's
 * exterior-ambiance scope, but it does register a real, rotation-aware
 * collider so Mohammed can't walk through it (see the size-swap note below).
 */
export class AmbientTraffic {
  readonly root = new Group();
  private direction = 1;
  // Measured once from the model's own native (unrotated) footprint, the
  // same way CityProps.ts sizes every other placed model -- never a guessed
  // constant. `nativeFootprint.x`/`.z` are this van's real width/length
  // *before* faceTravelDirection() below ever rotates it.
  private readonly nativeFootprint: Vector3;
  private readonly colliderSize = new Vector3();

  constructor(
    model: Object3D,
    private readonly from: Vector3,
    private readonly to: Vector3,
    private readonly speed: number,
    private readonly collisions?: CollisionWorld,
  ) {
    this.root.name = 'ambient-traffic';
    this.root.add(model);
    this.root.position.copy(from);
    model.updateMatrixWorld(true);
    bounds.setFromObject(model);
    this.nativeFootprint = new Vector3(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
    );
    this.faceTravelDirection();
    this.collisions?.addBox(
      this.getColliderId(),
      new Vector3(from.x, this.colliderSize.y * 0.5, from.z),
      this.colliderSize,
    );
  }

  update(delta: number, playerPosition?: Vector3): void {
    if (playerPosition && this.root.position.distanceToSquared(playerPosition) < 9) return;
    const target = this.direction > 0 ? this.to : this.from;
    const toTarget = target.clone().sub(this.root.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance < 0.2) {
      this.direction *= -1;
      this.faceTravelDirection();
      return;
    }
    toTarget.normalize();
    this.root.position.addScaledVector(toTarget, Math.min(distance, this.speed * delta));
    this.collisions?.updateBox(
      this.getColliderId(),
      new Vector3(this.root.position.x, this.colliderSize.y * 0.5, this.root.position.z),
      this.colliderSize,
    );
  }

  getColliderId(): string { return 'ambient-traffic-commercial-collider'; }

  private faceTravelDirection(): void {
    const target = this.direction > 0 ? this.to : this.from;
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    this.root.rotation.y = Math.atan2(dx, dz);
    // Same convention as CityProps.ts's placeModel(): a quarter-turn (the van
    // travelling along world X instead of its native Z, or vice versa) swaps
    // which native axis maps to which world axis, or the collider ends up
    // long on the wrong side -- narrow across the direction of travel and
    // wide across the direction Mohammed actually approaches from, which is
    // exactly what let him walk deep into the van's visible body before the
    // (undersized-for-that-axis) box ever stopped him.
    const rotatedQuarterTurn = Math.abs(Math.cos(this.root.rotation.y)) < 0.5;
    this.colliderSize.set(
      rotatedQuarterTurn ? this.nativeFootprint.z : this.nativeFootprint.x,
      this.nativeFootprint.y,
      rotatedQuarterTurn ? this.nativeFootprint.x : this.nativeFootprint.z,
    );
  }
}
