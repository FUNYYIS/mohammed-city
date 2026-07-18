import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { InteractionSystem } from '../../src/interactions/InteractionSystem';
import { CollisionWorld } from '../../src/physics/CollisionWorld';

describe('InteractionSystem', () => {
  it('selects only a nearby target in the player facing direction', () => {
    const system = new InteractionSystem(new CollisionWorld());
    const player = new Vector3();
    const front = { id: 'front', label: 'تفاعل', position: new Vector3(0, 1, -1.5) };
    const behind = { id: 'behind', label: 'خلف', position: new Vector3(0, 1, 1) };

    expect(system.findBest(player, 0, [behind, front])?.id).toBe('front');
  });

  it('rejects interaction through a wall', () => {
    const collisions = new CollisionWorld();
    collisions.addBox('wall', new Vector3(0, 1, -1), new Vector3(3, 2, 0.2));
    const system = new InteractionSystem(collisions);
    const target = { id: 'target', label: 'تفاعل', position: new Vector3(0, 1, -2) };

    expect(system.findBest(new Vector3(), 0, [target])).toBeNull();
  });

  it('uses priority without ignoring distance and line of sight rules', () => {
    const system = new InteractionSystem(new CollisionWorld());
    const low = { id: 'low', label: 'عادي', position: new Vector3(0, 1, -1), priority: 0 };
    const high = { id: 'high', label: 'مهمة', position: new Vector3(0.4, 1, -1.2), priority: 2 };

    expect(system.findBest(new Vector3(), 0, [low, high])?.id).toBe('high');
  });
});
