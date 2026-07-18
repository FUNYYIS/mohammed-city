import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { InteractionSystem } from '../../src/interactions/InteractionSystem';
import { MISSION_ONE } from '../../src/missions/definitions/missionOne';
import { MissionOneDirector } from '../../src/missions/runtime/MissionOneDirector';
import { MissionRuntime } from '../../src/missions/runtime/MissionRuntime';
import { MissionOneWorld } from '../../src/world/MissionOneWorld';

function setup(): { world: MissionOneWorld; director: MissionOneDirector } {
  const world = new MissionOneWorld();
  const director = new MissionOneDirector(
    new MissionRuntime(MISSION_ONE),
    world,
    new InteractionSystem(world.collisions),
  );
  director.startNew();
  return { world, director };
}

function interactAt(
  director: MissionOneDirector,
  position: Vector3,
  yaw: number,
): void {
  expect(director.updateInteraction(position, yaw)).not.toBeNull();
  expect(director.interact().changed).toBe(true);
}

describe('MissionOneDirector vertical slice', () => {
  it('runs the complete warehouse-to-garage path without early success', () => {
    const { world, director } = setup();
    expect(director.updateZones(world.garageGoal, true).completed).toBe(false);

    interactAt(director, new Vector3(-5.8, 0, -5.1), Math.PI / 2);
    interactAt(director, new Vector3(-5.8, 0, -6.15), Math.PI / 2);
    interactAt(director, new Vector3(-5.8, 0, -5.1), Math.PI / 2);
    interactAt(director, new Vector3(-5.8, 0, -4.05), Math.PI / 2);
    expect(director.runtime.getCurrentObjective()?.id).toBe('start-generator');

    interactAt(director, new Vector3(3.2, 0, -9.2), -Math.PI / 2);
    for (let frame = 0; frame < 80; frame += 1) {
      world.update(1 / 60).forEach((event) => director.handleWorldEvent(event));
    }
    expect(world.isGeneratorOn()).toBe(true);
    expect(director.runtime.getCurrentObjective()?.id).toBe('open-main-door');

    interactAt(director, new Vector3(2.75, 0, 2.55), Math.PI);
    for (let frame = 0; frame < 120; frame += 1) {
      world.update(1 / 60).forEach((event) => director.handleWorldEvent(event));
    }
    expect(world.isDoorOpen()).toBe(true);
    expect(director.runtime.getCurrentObjective()?.id).toBe('exit-warehouse');

    expect(director.updateZones(new Vector3(0, 0, 6), false).changed).toBe(true);
    expect(director.vehicleEntered().changed).toBe(true);
    expect(director.updateZones(world.garageGoal, true).completed).toBe(true);
    expect(director.runtime.getProgress().completed).toBe(true);
  });

  it('resets the visible breaker state after a wrong order', () => {
    const { world, director } = setup();
    interactAt(director, new Vector3(-5.8, 0, -5.1), Math.PI / 2);
    interactAt(director, new Vector3(-5.8, 0, -6.15), Math.PI / 2);

    director.updateInteraction(new Vector3(-5.8, 0, -4.05), Math.PI / 2);
    const feedback = director.interact();
    expect(feedback.message).toContain('الترتيب غلط');
    expect(director.runtime.getProgress().sequenceIndex).toBe(0);
    expect(world.isGeneratorOn()).toBe(false);
  });

  it('reset restores the closed door, stopped generator, and first objective', () => {
    const { world, director } = setup();
    interactAt(director, new Vector3(-5.8, 0, -5.1), Math.PI / 2);
    director.reset();

    expect(director.runtime.getCurrentObjective()?.id).toBe('discover-panel');
    expect(world.isGeneratorOn()).toBe(false);
    expect(world.isDoorOpen()).toBe(false);
    expect(world.collisions.getAll().find((item) => item.id === 'warehouse-main-door')?.enabled).toBe(true);
  });
});
