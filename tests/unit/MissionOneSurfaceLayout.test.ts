import { describe, expect, it } from 'vitest';
import { MISSION_ONE_TOP_SURFACES } from '../../src/world/MissionOneSurfaceLayout';

describe('Mission 1 top surface layout', () => {
  it('never overlaps two coplanar ground surfaces by area', () => {
    for (let leftIndex = 0; leftIndex < MISSION_ONE_TOP_SURFACES.length; leftIndex += 1) {
      const left = MISSION_ONE_TOP_SURFACES[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < MISSION_ONE_TOP_SURFACES.length; rightIndex += 1) {
        const right = MISSION_ONE_TOP_SURFACES[rightIndex];
        const overlapX = Math.min(left.centerX + left.width / 2, right.centerX + right.width / 2)
          - Math.max(left.centerX - left.width / 2, right.centerX - right.width / 2);
        const overlapZ = Math.min(left.centerZ + left.depth / 2, right.centerZ + right.depth / 2)
          - Math.max(left.centerZ - left.depth / 2, right.centerZ - right.depth / 2);

        expect(
          overlapX > 0.0001 && overlapZ > 0.0001,
          `${left.id} overlaps ${right.id}`,
        ).toBe(false);
      }
    }
  });
});
