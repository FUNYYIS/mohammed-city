import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { InteractionSystem } from '../../src/interactions/InteractionSystem';
import { MissionOneWorld } from '../../src/world/MissionOneWorld';

function warmZone(world: MissionOneWorld, position: Vector3, frames = 4): void {
  for (let frame = 0; frame < frames; frame += 1) {
    world.updateCityStreaming(1 / 60, position, position);
  }
}

describe('Phase 3 core city', () => {
  it('streams the four named districts according to player proximity', () => {
    const world = new MissionOneWorld();
    const warehouse = new Vector3(0, 0, -4);
    warmZone(world, warehouse);

    expect(world.getActiveCityZoneIds()).toContain('warehouse-district');
    expect(world.getCityZoneStates()['mohammed-neighborhood']).not.toBe('active');
    expect(world.getActiveNPCCount()).toBeGreaterThanOrEqual(1);

    const neighborhood = new Vector3(-34, 0, 20);
    warmZone(world, neighborhood);
    expect(world.getActiveCityZoneIds()).toContain('mohammed-neighborhood');
    expect(world.city.getLocationLabel(neighborhood)).toBe('حي محمد');
  });

  it('opens Mohammed home door and permits a real capsule path through the visible opening', () => {
    const world = new MissionOneWorld();
    const outside = new Vector3(-34, 0, 23.5);
    warmZone(world, outside);
    const interaction = new InteractionSystem(world.collisions).findBest(
      outside,
      0,
      world.city.getInteractables(),
    );

    expect(interaction?.id).toBe('mohammed-home-door');
    expect(world.city.interact(interaction!.id)).toContain('انفتح');
    for (let frame = 0; frame < 90; frame += 1) {
      world.updateCityStreaming(1 / 60, outside, outside);
    }

    const position = outside.clone();
    world.collisions.moveCapsule(position, new Vector3(0, 0, -4), { radius: 0.4, height: 1.82 });
    expect(position.z).toBeLessThan(21);
    expect(world.city.isInsideInterior(position)).toBe(true);
    expect(world.collisions.overlapsCapsule(position, { radius: 0.4, height: 1.82 })).toBe(false);
  });

  it('exposes the supermarket as a second interactive interior', () => {
    const world = new MissionOneWorld();
    const entrance = new Vector3(30, 0, 34.8);
    warmZone(world, entrance);

    expect(world.city.getInteractables().some((item) => item.id === 'supermarket-door')).toBe(true);
    expect(world.city.getLocationLabel(entrance)).toBe('الشارع التجاري');
  });
});
