import { describe, expect, it } from 'vitest';
import { Vector2, Vector3 } from 'three';
import type { InputSnapshot } from '../../src/controls/InputManager';
import { SimpleVehicleController } from '../../src/entities/vehicles/SimpleVehicleController';
import { CollisionWorld } from '../../src/physics/CollisionWorld';

const input = (move = new Vector2()): InputSnapshot => ({
  move,
  cameraDelta: new Vector2(),
  run: false,
  crouch: false,
  jumpPressed: false,
  interactPressed: false,
  vehiclePressed: false,
});

describe('SimpleVehicleController', () => {
  it('accelerates forward and keeps its collider synchronized', () => {
    const world = new CollisionWorld();
    const car = new SimpleVehicleController(world, new Vector3());
    car.enter();
    for (let frame = 0; frame < 60; frame += 1) car.update(1 / 60, input(new Vector2(0, 1)));

    expect(car.position.z).toBeGreaterThan(2);
    expect(car.speed).toBeGreaterThan(4);
    const collider = world.getAll().find((item) => item.id === 'mission-car-collider');
    expect(collider?.bounds.getCenter(new Vector3()).z).toBeCloseTo(car.position.z);
  });

  it('stops before entering a wall', () => {
    const world = new CollisionWorld();
    world.addBox('wall', new Vector3(0, 1, 3), new Vector3(6, 2, 0.4));
    const car = new SimpleVehicleController(world, new Vector3());
    car.enter();
    for (let frame = 0; frame < 120; frame += 1) car.update(1 / 60, input(new Vector2(0, 1)));

    expect(car.position.z).toBeLessThan(1.79);
    expect(world.overlapsCapsule(
      car.position,
      { radius: 1.02, height: 1.35 },
      new Set(['mission-car-collider']),
    )).toBe(false);
    expect(world.getAll().find((item) => item.id === 'wall')?.bounds.containsPoint(car.position)).toBe(false);
  });

  it('finds a safe side exit and never returns a blocked candidate', () => {
    const world = new CollisionWorld();
    const car = new SimpleVehicleController(world, new Vector3());
    const shape = { radius: 0.4, height: 1.82 };
    const exit = car.findSafeExit(shape);

    expect(exit).not.toBeNull();
    expect(world.overlapsCapsule(exit!, shape, new Set(['mission-car-collider']))).toBe(false);
  });
});
