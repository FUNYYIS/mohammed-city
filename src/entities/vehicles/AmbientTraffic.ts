import { Group, Object3D, Vector3 } from 'three';

/**
 * Purely decorative background traffic: loops a real vehicle model back and
 * forth between two points for city-ambiance. It never collides with the
 * player and is not driveable -- SimpleVehicleController remains the only
 * enterable vehicle system. Kept intentionally simple (no steering, no
 * physics) to match this phase's exterior-ambiance scope.
 */
export class AmbientTraffic {
  readonly root = new Group();
  private direction = 1;

  constructor(
    model: Object3D,
    private readonly from: Vector3,
    private readonly to: Vector3,
    private readonly speed: number,
  ) {
    this.root.name = 'ambient-traffic';
    this.root.add(model);
    this.root.position.copy(from);
    this.faceTravelDirection();
  }

  update(delta: number): void {
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
  }

  private faceTravelDirection(): void {
    const target = this.direction > 0 ? this.to : this.from;
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    this.root.rotation.y = Math.atan2(dx, dz);
  }
}
