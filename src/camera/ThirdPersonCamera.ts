import { Box3, MathUtils, Object3D, PerspectiveCamera, Ray, Raycaster, Vector2, Vector3 } from 'three';

const target = new Vector3();
const desired = new Vector3();
const direction = new Vector3();
const smoothedTarget = new Vector3();
const collisionPoint = new Vector3();
const CAMERA_TARGET_HEIGHT = 1.28;
const HORIZONTAL_FOLLOW_RATE = 14;
const VERTICAL_FOLLOW_RATE = 5.5;
const CAMERA_COLLISION_RADIUS = 0.28;
const CAMERA_COLLISION_PADDING = 0.08;
const MIN_CAMERA_DISTANCE = 0.75;
const CAMERA_RECOVERY_RATE = 8;

export type CameraMode = 'outdoor' | 'indoor' | 'stair' | 'vehicle' | 'cinematic';

export class ThirdPersonCamera {
  readonly camera: PerspectiveCamera;
  yaw = 0;
  pitch = 0.27;
  distance = 5.5;
  mode: CameraMode = 'outdoor';
  private readonly raycaster = new Raycaster();
  private readonly collisionRay = new Ray();
  private readonly collisionBounds: Box3[];
  private initialized = false;
  private resolvedDistance = this.distance;

  constructor(private readonly obstacles: Object3D[]) {
    // A tighter near/far ratio materially improves depth precision on mobile
    // tile-based GPUs while preserving the whole Phase 1 test scene.
    this.camera = new PerspectiveCamera(58, 1, 0.18, 140);

    // A centre ray alone can miss a wall edge even though the camera's near
    // plane clips it. Expanding each static obstacle by the camera radius turns
    // the ray test into a lightweight swept-sphere approximation.
    this.collisionBounds = obstacles.map((obstacle) => {
      obstacle.updateWorldMatrix(true, false);
      return new Box3().setFromObject(obstacle).expandByScalar(CAMERA_COLLISION_RADIUS);
    });
  }

  update(delta: number, playerPosition: Vector3, cameraDelta: Vector2): void {
    const firstUpdate = !this.initialized;
    this.yaw -= cameraDelta.x * 0.0042;
    this.pitch = MathUtils.clamp(this.pitch + cameraDelta.y * 0.0035, -0.12, 0.72);

    // playerPosition is the single world-space jump source. No jump offset is
    // added here; the camera follows that world height exactly once.
    target.copy(playerPosition);
    target.y += CAMERA_TARGET_HEIGHT;
    if (!this.initialized) {
      smoothedTarget.copy(target);
      this.initialized = true;
    } else {
      const horizontalAlpha = 1 - Math.exp(-delta * HORIZONTAL_FOLLOW_RATE);
      const verticalAlpha = 1 - Math.exp(-delta * VERTICAL_FOLLOW_RATE);
      smoothedTarget.x += (target.x - smoothedTarget.x) * horizontalAlpha;
      smoothedTarget.z += (target.z - smoothedTarget.z) * horizontalAlpha;
      smoothedTarget.y += (target.y - smoothedTarget.y) * verticalAlpha;
    }

    const horizontal = Math.cos(this.pitch) * this.distance;
    desired.set(
      smoothedTarget.x + Math.sin(this.yaw) * horizontal,
      smoothedTarget.y + Math.sin(this.pitch) * this.distance,
      smoothedTarget.z + Math.cos(this.yaw) * horizontal,
    );

    direction.copy(desired).sub(smoothedTarget);
    const wantedDistance = direction.length();
    direction.normalize();
    const safeDistance = this.resolveCollisionDistance(smoothedTarget, direction, wantedDistance);
    const blocked = safeDistance < wantedDistance - 0.001;

    // distance can be configured after construction (for example, character
    // preview mode), so the collision state must adopt it on the first frame.
    if (firstUpdate) this.resolvedDistance = wantedDistance;

    // Contract immediately so the camera cannot interpolate through a wall.
    // When the obstruction clears, restore the requested distance gradually to
    // avoid the visible pop that is especially distracting on touch cameras.
    if (blocked) this.resolvedDistance = safeDistance;
    else this.resolvedDistance = MathUtils.damp(
      this.resolvedDistance,
      wantedDistance,
      CAMERA_RECOVERY_RATE,
      delta,
    );
    desired.copy(smoothedTarget).addScaledVector(direction, this.resolvedDistance);

    if (this.camera.position.lengthSq() === 0) this.camera.position.copy(desired);
    else if (blocked) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 1 - Math.exp(-delta * 18));
    this.camera.lookAt(smoothedTarget);
  }

  private resolveCollisionDistance(origin: Vector3, rayDirection: Vector3, wantedDistance: number): number {
    let safeDistance = wantedDistance;

    // Preserve the exact mesh hit for broad surfaces and use the expanded
    // bounds below to cover the camera volume at corners and thin obstacles.
    this.raycaster.set(origin, rayDirection);
    this.raycaster.far = wantedDistance;
    const hits = this.raycaster.intersectObjects(this.obstacles, false);
    if (hits.length > 0) {
      safeDistance = Math.min(
        safeDistance,
        Math.max(MIN_CAMERA_DISTANCE, hits[0].distance - CAMERA_COLLISION_PADDING),
      );
    }

    this.collisionRay.set(origin, rayDirection);
    for (const bounds of this.collisionBounds) {
      // The camera target may legitimately sit close to a wall while the
      // player faces away from it. In that case the sweep starts inside the
      // expanded volume, so its exit is not an obstruction in front of camera.
      if (bounds.containsPoint(origin)) continue;
      const hit = this.collisionRay.intersectBox(bounds, collisionPoint);
      if (!hit) continue;
      const hitDistance = hit.distanceTo(origin);
      if (hitDistance > wantedDistance) continue;
      safeDistance = Math.min(
        safeDistance,
        Math.max(MIN_CAMERA_DISTANCE, hitDistance - CAMERA_COLLISION_PADDING),
      );
    }

    return safeDistance;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  getSmoothedTarget(out: Vector3): Vector3 {
    return out.copy(smoothedTarget);
  }

  getResolvedDistance(): number {
    return this.resolvedDistance;
  }
}
