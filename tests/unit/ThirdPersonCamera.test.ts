import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector2, Vector3 } from 'three';
import { ThirdPersonCamera } from '../../src/camera/ThirdPersonCamera';

describe('ThirdPersonCamera jump following', () => {
  it('follows player world Y once with slower vertical smoothing', () => {
    const rig = new ThirdPersonCamera([]);
    const playerPosition = new Vector3(0, 0, 0);
    const cameraDelta = new Vector2();
    const target = new Vector3();
    rig.update(1 / 60, playerPosition, cameraDelta);
    const initialCameraY = rig.camera.position.y;
    const initialTargetY = rig.getSmoothedTarget(target).y;

    playerPosition.y = 1;
    rig.update(1 / 60, playerPosition, cameraDelta);
    const targetRise = rig.getSmoothedTarget(target).y - initialTargetY;
    const cameraRise = rig.camera.position.y - initialCameraY;

    expect(targetRise).toBeGreaterThan(0);
    expect(targetRise).toBeLessThan(1);
    expect(cameraRise).toBeGreaterThan(0);
    expect(cameraRise).toBeLessThan(targetRise);
  });

  it('does not overshoot or add a second jump offset', () => {
    const rig = new ThirdPersonCamera([]);
    const playerPosition = new Vector3(0, 0, 0);
    const cameraDelta = new Vector2();
    const target = new Vector3();
    rig.update(1 / 60, playerPosition, cameraDelta);
    playerPosition.y = 1;
    for (let frame = 0; frame < 90; frame += 1) rig.update(1 / 60, playerPosition, cameraDelta);

    expect(rig.getSmoothedTarget(target).y).toBeLessThanOrEqual(2.28);
    expect(rig.getSmoothedTarget(target).y).toBeGreaterThan(2.27);
  });
});

describe('ThirdPersonCamera volumetric collision', () => {
  const cameraDelta = new Vector2();
  const playerPosition = new Vector3();

  function obstacle(size: Vector3, position: Vector3): Mesh {
    const mesh = new Mesh(
      new BoxGeometry(size.x, size.y, size.z),
      new MeshBasicMaterial(),
    );
    mesh.position.copy(position);
    mesh.updateMatrixWorld(true);
    return mesh;
  }

  it('uses a configured camera distance on the first frame', () => {
    const rig = new ThirdPersonCamera([]);
    rig.distance = 3.35;
    rig.update(1 / 60, playerPosition, cameraDelta);

    expect(rig.getResolvedDistance()).toBeCloseTo(3.35, 5);
  });

  it('contracts immediately before a wall on the camera path', () => {
    const wall = obstacle(new Vector3(4, 4, 0.2), new Vector3(0, 2, 2.8));
    const rig = new ThirdPersonCamera([wall]);
    rig.pitch = 0;
    rig.update(1 / 60, playerPosition, cameraDelta);

    expect(rig.getResolvedDistance()).toBeLessThan(2.5);
    expect(rig.camera.position.z).toBeLessThan(2.5);
  });

  it('catches a wall edge missed by the centre ray', () => {
    // The mesh begins at x=0.18, so the x=0 centre ray misses it. The camera
    // radius still overlaps that edge and must keep the near plane in front.
    const edge = obstacle(new Vector3(0.08, 4, 0.25), new Vector3(0.22, 2, 2.6));
    const rig = new ThirdPersonCamera([edge]);
    rig.pitch = 0;
    rig.update(1 / 60, playerPosition, cameraDelta);

    expect(rig.getResolvedDistance()).toBeLessThan(2.4);
  });

  it('catches an overhead edge within the camera collision radius', () => {
    // With zero pitch the centre ray sits at y=1.28 and misses this underside
    // at y=1.46, while the camera volume overlaps it.
    const ceilingEdge = obstacle(new Vector3(3, 0.08, 0.3), new Vector3(0, 1.5, 2.6));
    const rig = new ThirdPersonCamera([ceilingEdge]);
    rig.pitch = 0;
    rig.update(1 / 60, playerPosition, cameraDelta);

    expect(rig.getResolvedDistance()).toBeLessThan(2.4);
  });

  it('restores camera distance smoothly after rotating away from a wall', () => {
    const wall = obstacle(new Vector3(4, 4, 0.2), new Vector3(0, 2, 2.8));
    const rig = new ThirdPersonCamera([wall]);
    rig.pitch = 0;
    rig.update(1 / 60, playerPosition, cameraDelta);
    const blockedDistance = rig.getResolvedDistance();

    rig.yaw = Math.PI / 2;
    rig.update(1 / 60, playerPosition, cameraDelta);
    const firstClearDistance = rig.getResolvedDistance();

    expect(firstClearDistance).toBeGreaterThan(blockedDistance);
    expect(firstClearDistance).toBeLessThan(rig.distance);

    for (let frame = 0; frame < 90; frame += 1) {
      rig.update(1 / 60, playerPosition, cameraDelta);
    }
    expect(rig.getResolvedDistance()).toBeCloseTo(rig.distance, 3);
  });
});
