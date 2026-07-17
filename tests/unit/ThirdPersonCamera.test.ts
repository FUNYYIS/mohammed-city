import { describe, expect, it } from 'vitest';
import { Vector2, Vector3 } from 'three';
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
