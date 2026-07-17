import { MathUtils, Object3D, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';

const target = new Vector3();
const desired = new Vector3();
const direction = new Vector3();
const smoothedTarget = new Vector3();
const CAMERA_TARGET_HEIGHT = 1.28;
const HORIZONTAL_FOLLOW_RATE = 14;
const VERTICAL_FOLLOW_RATE = 5.5;

export type CameraMode = 'outdoor' | 'indoor' | 'stair' | 'vehicle' | 'cinematic';

export class ThirdPersonCamera {
  readonly camera: PerspectiveCamera;
  yaw = 0;
  pitch = 0.27;
  distance = 5.5;
  mode: CameraMode = 'outdoor';
  private readonly raycaster = new Raycaster();
  private initialized = false;

  constructor(private readonly obstacles: Object3D[]) {
    // A tighter near/far ratio materially improves depth precision on mobile
    // tile-based GPUs while preserving the whole Phase 1 test scene.
    this.camera = new PerspectiveCamera(58, 1, 0.18, 140);
  }

  update(delta: number, playerPosition: Vector3, cameraDelta: Vector2): void {
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
    this.raycaster.set(smoothedTarget, direction);
    this.raycaster.far = wantedDistance;
    const hits = this.raycaster.intersectObjects(this.obstacles, false);
    const safeDistance = hits.length > 0 ? Math.max(0.75, hits[0].distance - 0.3) : wantedDistance;
    desired.copy(smoothedTarget).addScaledVector(direction, safeDistance);

    if (this.camera.position.lengthSq() === 0) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 1 - Math.exp(-delta * 18));
    this.camera.lookAt(smoothedTarget);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  getSmoothedTarget(out: Vector3): Vector3 {
    return out.copy(smoothedTarget);
  }
}
