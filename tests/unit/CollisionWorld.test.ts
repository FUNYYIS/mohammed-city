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

  it('updates and disables dynamic box colliders', () => {
    const world = new CollisionWorld();
    world.addBox('door', new Vector3(0, 1, 0), new Vector3(2, 2, 0.3));
    const player = new Vector3(0, 0, 0);
    const shape = { radius: 0.4, height: 1.8 };
    expect(world.overlapsCapsule(player, shape)).toBe(true);

    world.updateBox('door', new Vector3(4, 1, 0), new Vector3(2, 2, 0.3));
    expect(world.overlapsCapsule(player, shape)).toBe(false);
    world.setEnabled('door', false);
    expect(world.overlapsCapsule(new Vector3(4, 0, 0), shape)).toBe(false);
  });

  it('reports line of sight blocked by enabled colliders only', () => {
    const world = new CollisionWorld();
    world.addBox('wall', new Vector3(0, 1, -1), new Vector3(2, 2, 0.2));
    const start = new Vector3(0, 1, 0);
    const end = new Vector3(0, 1, -2);
    expect(world.hasLineOfSight(start, end)).toBe(false);
    world.setEnabled('wall', false);
    expect(world.hasLineOfSight(start, end)).toBe(true);
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

  it('stops an upward capsule at a ceiling', () => {
    const world = new CollisionWorld();
    world.addBox('ceiling', new Vector3(0, 2.1, 0), new Vector3(4, 0.2, 4));
    const position = new Vector3(0, 0, 0);

    const result = world.moveCapsuleWithResult(position, new Vector3(0, 0.7, 0), { radius: 0.4, height: 1.82 });

    expect(result.hitCeiling).toBe(true);
    expect(position.y).toBeCloseTo(0.18);
    expect(position.y + 1.82).toBeLessThanOrEqual(2.0001);
  });

  it('lands a falling capsule on a visible platform top', () => {
    const world = new CollisionWorld();
    world.addBox('platform', new Vector3(0, 0.25, 0), new Vector3(4, 0.5, 4));
    const position = new Vector3(0, 1.2, 0);

    const result = world.moveCapsuleWithResult(position, new Vector3(0, -1, 0), { radius: 0.4, height: 1.82 });

    expect(result.hitGround).toBe(true);
    expect(position.y).toBeCloseTo(0.5);
  });
});
