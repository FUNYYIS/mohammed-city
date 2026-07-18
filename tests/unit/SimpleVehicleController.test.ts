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

  it('steers screen-right and screen-left without mirroring the joystick', () => {
    for (const steering of [1, -1]) {
      const world = new CollisionWorld();
      const car = new SimpleVehicleController(world, new Vector3());
      car.enter();
      for (let frame = 0; frame < 36; frame += 1) {
        car.update(1 / 60, input(new Vector2(steering, 1)));
      }

      // With the chase camera behind +Z travel, screen-right is world -X.
      expect(car.yaw * steering).toBeLessThan(0);
      expect(car.position.x * steering).toBeLessThan(0);
    }
  });

  it('finds a safe side exit and never returns a blocked candidate', () => {
    const world = new CollisionWorld();
    const car = new SimpleVehicleController(world, new Vector3());
    const shape = { radius: 0.4, height: 1.82 };
    const exit = car.findSafeExit(shape);

    expect(exit).not.toBeNull();
    expect(world.overlapsCapsule(exit!, shape, new Set(['mission-car-collider']))).toBe(false);
  });

  it('supports independently gated bicycle and sport-car controllers', () => {
    const world = new CollisionWorld();
    const bicycle = new SimpleVehicleController(world, new Vector3(), 0, {
      id: 'bicycle',
      displayName: 'الدراجة',
      kind: 'bicycle',
      size: new Vector3(1.05, 1.4, 2.15),
      shape: { radius: 0.62, height: 1.4 },
      maxForwardSpeed: 5.6,
    });
    const sport = new SimpleVehicleController(world, new Vector3(5, 0, 0), 0, {
      id: 'sport-car',
      displayName: 'السيارة الرياضية',
      kind: 'sport',
      maxForwardSpeed: 10.5,
    });

    bicycle.setAvailable(false);
    expect(bicycle.canEnter(new Vector3())).toBe(false);
    expect(world.getAll().find((item) => item.id === 'bicycle-collider')?.enabled).toBe(false);
    bicycle.setAvailable(true);
    bicycle.enter();
    for (let frame = 0; frame < 60; frame += 1) bicycle.update(1 / 60, input(new Vector2(0, 1)));

    expect(bicycle.position.z).toBeGreaterThan(1);
    expect(sport.getColliderId()).toBe('sport-car-collider');
    expect(sport.root.name).toBe('sport-car');
  });
});
