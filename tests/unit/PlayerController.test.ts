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
  ...overrides,
});

describe('PlayerController', () => {
  it('rejects a second jump while airborne', () => {
    const player = new PlayerController(new CollisionWorld());
    player.update(1 / 60, input({ jumpPressed: true }), 0);
    const firstVelocity = player.velocity.y;
    player.update(1 / 60, input({ jumpPressed: true }), 0);

    expect(player.grounded).toBe(false);
    expect(firstVelocity).toBeGreaterThan(5);
    expect(player.velocity.y).toBeLessThan(firstVelocity);
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
