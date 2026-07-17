import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CollisionWorld } from '../../src/physics/CollisionWorld';

describe('CollisionWorld', () => {
  it('prevents a capsule from tunneling through a thin wall', () => {
    const world = new CollisionWorld();
    world.addBox('wall', new Vector3(0, 1.5, 0), new Vector3(4, 3, 0.2));
    const position = new Vector3(0, 0, 2);

    world.moveCapsule(position, new Vector3(0, 0, -5), { radius: 0.4, height: 1.8 });

    expect(position.z).toBeGreaterThanOrEqual(0.4);
    expect(world.overlapsCapsule(position, { radius: 0.4, height: 1.8 })).toBe(false);
  });

  it('slides along an obstacle and clears its corner when the path opens', () => {
    const world = new CollisionWorld();
    world.addBox('wall', new Vector3(0, 1.5, 0), new Vector3(4, 3, 0.3));
    const position = new Vector3(1.4, 0, 1);

    world.moveCapsule(position, new Vector3(2, 0, -2), { radius: 0.4, height: 1.8 });

    expect(position.x).toBeGreaterThan(2.5);
    expect(position.z).toBeLessThan(-0.35);
    expect(world.overlapsCapsule(position, { radius: 0.4, height: 1.8 })).toBe(false);
  });

  it('never moves the capsule below the visible ground plane', () => {
    const world = new CollisionWorld();
    const position = new Vector3(0, 0.1, 0);
    world.moveCapsule(position, new Vector3(0, -9, 0), { radius: 0.4, height: 1.8 });
    expect(position.y).toBe(0);
  });
});
