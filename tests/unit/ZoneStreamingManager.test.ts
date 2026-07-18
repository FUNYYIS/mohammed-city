import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../../src/physics/CollisionWorld';
import { ZoneStreamingManager } from '../../src/streaming/ZoneStreamingManager';

describe('ZoneStreamingManager', () => {
  it('preloads, activates, hides, unloads, and rebuilds a zone without stale collisions', () => {
    const collisions = new CollisionWorld();
    const sceneRoot = new Group();
    const cameraObstacles: Mesh[] = [];
    let builds = 0;
    const manager = new ZoneStreamingManager([{
      id: 'test-zone',
      label: 'Test zone',
      center: new Vector3(),
      preloadRadius: 20,
      activeRadius: 10,
      build: () => {
        builds += 1;
        const root = new Group();
        const obstacle = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
        root.add(obstacle);
        collisions.addBox('streamed-wall', new Vector3(0, 1, 0), new Vector3(2, 2, 2));
        return { root, colliderIds: ['streamed-wall'], cameraObstacles: [obstacle] };
      },
    }], sceneRoot, collisions, cameraObstacles);

    manager.update(1 / 60, new Vector3(5, 0, 0));
    expect(manager.getStates()['test-zone']).toBe('preloading');
    manager.update(1 / 60, new Vector3(5, 0, 0));
    expect(manager.getStates()['test-zone']).toBe('readyHidden');
    expect(collisions.getAll()[0].enabled).toBe(false);
    manager.update(1 / 60, new Vector3(5, 0, 0));
    expect(manager.getStates()['test-zone']).toBe('active');
    expect(collisions.getAll()[0].enabled).toBe(true);
    expect(cameraObstacles).toHaveLength(1);

    manager.update(1 / 60, new Vector3(40, 0, 0));
    expect(manager.getStates()['test-zone']).toBe('cooling');
    manager.update(1.3, new Vector3(40, 0, 0));
    expect(manager.getStates()['test-zone']).toBe('readyHidden');
    manager.update(1 / 60, new Vector3(40, 0, 0));
    expect(manager.getStates()['test-zone']).toBe('unloading');
    manager.update(1 / 60, new Vector3(40, 0, 0));
    expect(manager.getStates()['test-zone']).toBe('unloaded');
    expect(collisions.getAll()).toHaveLength(0);
    expect(cameraObstacles).toHaveLength(0);

    manager.update(1 / 60, new Vector3(0, 0, 0));
    manager.update(1 / 60, new Vector3(0, 0, 0));
    manager.update(1 / 60, new Vector3(0, 0, 0));
    expect(builds).toBe(2);
    expect(collisions.getAll().filter((item) => item.id === 'streamed-wall')).toHaveLength(1);
  });
});
