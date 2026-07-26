import { describe, expect, it } from 'vitest';
import { Vector2, Vector3 } from 'three';
import { PlayerController } from '../../src/entities/player/PlayerController';
import { CollisionWorld } from '../../src/physics/CollisionWorld';
import type { InputSnapshot } from '../../src/controls/InputManager';

const input = (overrides: Partial<InputSnapshot> = {}): InputSnapshot => ({
  move: new Vector2(),
  cameraDelta: new Vector2(),
  run: false,
  crouch: false,
  jumpPressed: false,
  interactPressed: false,
  vehiclePressed: false,
  ...overrides,
});

describe('PlayerController', () => {
  it('restores control, grounding, collision movement, and running after leaving a vehicle', () => {
    const world = new CollisionWorld();
    world.addBox('vehicle-collider', new Vector3(0, 0.7, 0), new Vector3(1.9, 1.4, 3.4));
    const player = new PlayerController(world);
    player.suspendForVehicle();
    expect(player.isControlEnabled()).toBe(false);

    const safeExit = new Vector3(2.45, 0, 0);
    player.resumeAfterVehicleExit(safeExit, Math.PI);
    expect(player.isControlEnabled()).toBe(true);
    expect(player.grounded).toBe(true);
    expect(player.velocity.lengthSq()).toBe(0);
    expect(world.overlapsCapsule(player.position, player.standingShape)).toBe(false);

    const walkingStart = player.position.clone();
    for (let frame = 0; frame < 20; frame += 1) {
      player.update(1 / 60, input({ move: new Vector2(0, 1) }), Math.PI);
    }
    const walkingDistance = player.position.distanceTo(walkingStart);
    const runningStart = player.position.clone();
    for (let frame = 0; frame < 20; frame += 1) {
      player.update(1 / 60, input({ move: new Vector2(0, 1), run: true }), Math.PI);
    }
    expect(walkingDistance).toBeGreaterThan(0.4);
    expect(player.position.distanceTo(runningStart)).toBeGreaterThan(walkingDistance);
  });

  it('rejects a second jump while airborne', () => {
    const player = new PlayerController(new CollisionWorld());
    player.update(1 / 60, input({ jumpPressed: true }), 0);
    const firstVelocity = player.velocity.y;
    player.update(1 / 60, input({ jumpPressed: true }), 0);

    expect(player.grounded).toBe(false);
    expect(firstVelocity).toBeGreaterThan(5);
    expect(player.velocity.y).toBeLessThan(firstVelocity);
  });

  it('raises the player world position, capsule, and visual root together', () => {
    const player = new PlayerController(new CollisionWorld());
    player.update(1 / 60, input({ jumpPressed: true }), 0);

    expect(player.position.y).toBeGreaterThan(0);
    expect(player.view.root.position.y).toBeCloseTo(player.position.y);
    expect(player.view.visualRoot.position.y).toBeLessThan(0.05);
    expect(player.grounded).toBe(false);
  });

  it('completes a natural jump arc and lands once', () => {
    const player = new PlayerController(new CollisionWorld());
    let maximumY = 0;
    let airborneFrames = 0;
    player.update(1 / 60, input({ jumpPressed: true }), 0);
    for (let frame = 0; frame < 180; frame += 1) {
      player.update(1 / 60, input(), 0);
      maximumY = Math.max(maximumY, player.position.y);
      if (!player.grounded) airborneFrames += 1;
      if (player.grounded && frame > 5) break;
    }

    expect(maximumY).toBeGreaterThan(0.8);
    expect(airborneFrames).toBeGreaterThan(20);
    expect(player.grounded).toBe(true);
    expect(player.position.y).toBe(0);
    expect(player.velocity.y).toBe(0);
    expect(player.view.root.position.y).toBe(0);
  });

  it('jumps while walking and while running', () => {
    for (const run of [false, true]) {
      const player = new PlayerController(new CollisionWorld());
      const startZ = player.position.z;
      player.update(1 / 60, input({ jumpPressed: true, move: new Vector2(0, 1), run }), 0);
      for (let frame = 0; frame < 15; frame += 1) {
        player.update(1 / 60, input({ move: new Vector2(0, 1), run }), 0);
      }
      expect(player.position.y).toBeGreaterThan(0.5);
      expect(player.position.z).toBeLessThan(startZ - 0.1);
      expect(player.grounded).toBe(false);
    }
  });

  it('jumps near a wall without entering it', () => {
    const world = new CollisionWorld();
    world.addBox('jump-wall', new Vector3(0, 1.5, 4.3), new Vector3(5, 3, 0.25));
    const player = new PlayerController(world);
    let maximumY = 0;
    player.update(1 / 60, input({ jumpPressed: true, move: new Vector2(0, 1) }), 0);
    for (let frame = 0; frame < 40; frame += 1) {
      player.update(1 / 60, input({ move: new Vector2(0, 1), run: true }), 0);
      maximumY = Math.max(maximumY, player.position.y);
    }

    expect(maximumY).toBeGreaterThan(0.8);
    expect(world.overlapsCapsule(player.position, player.standingShape)).toBe(false);
    expect(player.position.z).toBeGreaterThan(4.8);
  });

  it('hits a low ceiling, falls, and lands without passing through it', () => {
    const world = new CollisionWorld();
    world.addBox('low-ceiling', new Vector3(0, 2.1, 5.5), new Vector3(4, 0.2, 4));
    const player = new PlayerController(world);
    let maximumY = 0;
    player.update(1 / 60, input({ jumpPressed: true }), 0);
    for (let frame = 0; frame < 120; frame += 1) {
      player.update(1 / 60, input(), 0);
      maximumY = Math.max(maximumY, player.position.y);
      if (player.grounded && frame > 8) break;
    }

    expect(maximumY).toBeLessThanOrEqual(0.1801);
    expect(player.position.y).toBe(0);
    expect(player.grounded).toBe(true);
  });

  it('moves relative to camera direction and accelerates smoothly', () => {
    const player = new PlayerController(new CollisionWorld());
    const start = player.position.clone();
    for (let frame = 0; frame < 30; frame += 1) {
      player.update(1 / 60, input({ move: new Vector2(0, 1) }), 0);
    }

    expect(player.position.z).toBeLessThan(start.z - 0.7);
    expect(player.getSpeed()).toBeLessThanOrEqual(3.21);
  });

  it('keeps all four movement directions aligned after a quarter-turn camera orbit', () => {
    const cases = [
      { name: 'up', move: new Vector2(0, 1), axis: 'x' as const, sign: -1 },
      { name: 'down', move: new Vector2(0, -1), axis: 'x' as const, sign: 1 },
      { name: 'right', move: new Vector2(1, 0), axis: 'z' as const, sign: -1 },
      { name: 'left', move: new Vector2(-1, 0), axis: 'z' as const, sign: 1 },
    ];

    for (const direction of cases) {
      const player = new PlayerController(new CollisionWorld());
      const start = player.position.clone();
      for (let frame = 0; frame < 20; frame += 1) {
        player.update(1 / 60, input({ move: direction.move }), Math.PI / 2);
      }

      const displacement = player.position[direction.axis] - start[direction.axis];
      expect(
        displacement * direction.sign,
        `${direction.name} should stay camera-relative`,
      ).toBeGreaterThan(0.35);
    }
  });

  it('keeps all four movement directions aligned before camera orbit', () => {
    const cases = [
      { move: new Vector2(0, 1), axis: 'z' as const, sign: -1 },
      { move: new Vector2(0, -1), axis: 'z' as const, sign: 1 },
      { move: new Vector2(1, 0), axis: 'x' as const, sign: 1 },
      { move: new Vector2(-1, 0), axis: 'x' as const, sign: -1 },
    ];

    for (const direction of cases) {
      const player = new PlayerController(new CollisionWorld());
      const start = player.position.clone();
      for (let frame = 0; frame < 20; frame += 1) {
        player.update(1 / 60, input({ move: direction.move }), 0);
      }

      const displacement = player.position[direction.axis] - start[direction.axis];
      expect(displacement * direction.sign).toBeGreaterThan(0.35);
    }
  });

  it('does not pass through a wall on a real movement path', () => {
    const world = new CollisionWorld();
    world.addBox('test-wall', new Vector3(0, 1.5, 3.6), new Vector3(5, 3, 0.25));
    const player = new PlayerController(world);
    for (let frame = 0; frame < 120; frame += 1) {
      player.update(1 / 60, input({ move: new Vector2(0, 1), run: true }), 0);
    }

    expect(player.position.z).toBeGreaterThanOrEqual(4.1 - 0.15);
    expect(world.overlapsCapsule(player.position, player.standingShape)).toBe(false);
  });

  it('uses the crouching state without changing controller identity', () => {
    const player = new PlayerController(new CollisionWorld());
    player.update(1 / 60, input({ crouch: true, move: new Vector2(1, 0) }), 0);

    expect(player.crouching).toBe(true);
    expect(player.crouchingShape.height).toBeLessThan(player.standingShape.height);
    expect(player.position).toBeInstanceOf(Vector3);
  });
});
