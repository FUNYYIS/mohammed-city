import { BoxGeometry, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CityNPC } from '../../src/entities/npc/CityNPC';
import { AmbientTraffic } from '../../src/entities/vehicles/AmbientTraffic';
import { CollisionWorld } from '../../src/physics/CollisionWorld';

describe('city dynamic collision proxies', () => {
  it('prevents Mohammed capsule from entering an NPC proxy', () => {
    const collisions = new CollisionWorld();
    const npc = new CityNPC('collision-man', 'رجل', [new Vector3(0, 0, 0)], { clothing: 0x334455, accent: 0x778899 }, collisions);
    npc.update(1 / 60, new Vector3(3, 0, 0));
    expect(collisions.overlapsCapsule(new Vector3(0.65, 0, 0), { radius: 0.4, height: 1.82 })).toBe(true);
  });

  it('stops traffic before Mohammed and exposes a blocking proxy', () => {
    const collisions = new CollisionWorld();
    // A van-shaped stub (real geometry, not a bare Object3D): AmbientTraffic
    // now measures its collider from the model's own bounds, the same way
    // CityProps.ts sizes every placed prop, instead of a guessed constant.
    const model = new Mesh(new BoxGeometry(1.9, 1.5, 3.7));
    const traffic = new AmbientTraffic(model, new Vector3(0, 0, 0), new Vector3(10, 0, 0), 4, collisions);
    traffic.update(1, new Vector3(1, 0, 0));
    expect(traffic.root.position.x).toBe(0);
    expect(collisions.overlapsCapsule(new Vector3(0.7, 0, 0), { radius: 0.4, height: 1.82 })).toBe(true);
  });

  it('keeps the traffic collider correctly oriented after a quarter-turn rotation', () => {
    // Regression guard for the swapped-axis bug: this van travels along
    // world X (a 90-degree turn from its native heading, which faces along
    // Z), so the collider's long (3.7) axis must land on X and its narrow
    // (1.9) axis on Z -- not stay glued to the model's native orientation
    // the way a naive, rotation-unaware box would.
    const collisions = new CollisionWorld();
    const traffic = new AmbientTraffic(
      new Mesh(new BoxGeometry(1.9, 1.5, 3.7)),
      new Vector3(0, 0, 0),
      new Vector3(10, 0, 0),
      4,
      collisions,
    );
    void traffic;
    const box = collisions.getAll().find((c) => c.id === 'ambient-traffic-commercial-collider')!;
    const sizeX = box.bounds.max.x - box.bounds.min.x;
    const sizeZ = box.bounds.max.z - box.bounds.min.z;
    expect(sizeX).toBeCloseTo(3.7, 5);
    expect(sizeZ).toBeCloseTo(1.9, 5);
  });
});
