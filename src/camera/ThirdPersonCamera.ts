import { MathUtils, Object3D, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';

const target = new Vector3();
const desired = new Vector3();
const direction = new Vector3();
const smoothedTarget = new Vector3();

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
    this.camera = new PerspectiveCamera(58, 1, 0.08, 170);
  }

  update(delta: number, playerPosition: Vector3, cameraDelta: Vector2): void {
    this.yaw -= cameraDelta.x * 0.0042;
    this.pitch = MathUtils.clamp(this.pitch + cameraDelta.y * 0.0035, -0.12, 0.72);

    target.copy(playerPosition).add(new Vector3(0, 1.28, 0));
    if (!this.initialized) {
      smoothedTarget.copy(target);
      this.initialized = true;
    } else {
      smoothedTarget.lerp(target, 1 - Math.exp(-delta * 14));
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
}
