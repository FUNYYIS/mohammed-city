import { describe, expect, it } from 'vitest';
import { findSurfaceOverlaps, WORLD_TOP_SURFACES } from '../../src/world/SurfaceLayout';

describe('WORLD_TOP_SURFACES', () => {
  it('contains no overlapping top-level ground, road, or plaza rectangles', () => {
    expect(findSurfaceOverlaps(WORLD_TOP_SURFACES)).toEqual([]);
  });

  it('keeps road markings out of the top-surface registry', () => {
    expect(WORLD_TOP_SURFACES.some((surface) => surface.id.includes('lane'))).toBe(false);
  });
});
