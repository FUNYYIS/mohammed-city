export type SurfaceMaterialId = 'grass' | 'road' | 'plazaBorder' | 'plazaInner';

export interface SurfaceRect {
  id: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  material: SurfaceMaterialId;
}

/**
 * One authoritative top surface exists at every covered X/Z coordinate.
 * The road and plaza are holes in the surrounding grass layout rather than
 * coplanar layers placed over a world-sized ground plane.
 */
export const WORLD_TOP_SURFACES: readonly SurfaceRect[] = [
  { id: 'grass-south', centerX: 0, centerZ: -34.5, width: 120, depth: 51, material: 'grass' },
  { id: 'grass-road-west', centerX: -48, centerZ: -4, width: 24, depth: 10, material: 'grass' },
  { id: 'grass-road-east', centerX: 52, centerZ: -4, width: 16, depth: 10, material: 'grass' },
  { id: 'grass-plaza-west', centerX: -37, centerZ: 10.5, width: 46, depth: 19, material: 'grass' },
  { id: 'grass-plaza-east', centerX: 37, centerZ: 10.5, width: 46, depth: 19, material: 'grass' },
  { id: 'grass-north', centerX: 0, centerZ: 40, width: 120, depth: 40, material: 'grass' },
  { id: 'road-main', centerX: 4, centerZ: -4, width: 80, depth: 10, material: 'road' },
  { id: 'plaza-south-border', centerX: 0, centerZ: 2, width: 28, depth: 2, material: 'plazaBorder' },
  { id: 'plaza-north-border', centerX: 0, centerZ: 19, width: 28, depth: 2, material: 'plazaBorder' },
  { id: 'plaza-west-border', centerX: -12.75, centerZ: 10.5, width: 2.5, depth: 15, material: 'plazaBorder' },
  { id: 'plaza-east-border', centerX: 12.75, centerZ: 10.5, width: 2.5, depth: 15, material: 'plazaBorder' },
  { id: 'plaza-inner', centerX: 0, centerZ: 10.5, width: 23, depth: 15, material: 'plazaInner' },
];

export function findSurfaceOverlaps(surfaces: readonly SurfaceRect[]): string[] {
  const overlaps: string[] = [];
  for (let leftIndex = 0; leftIndex < surfaces.length; leftIndex += 1) {
    const left = surfaces[leftIndex];
    const leftMinX = left.centerX - left.width / 2;
    const leftMaxX = left.centerX + left.width / 2;
    const leftMinZ = left.centerZ - left.depth / 2;
    const leftMaxZ = left.centerZ + left.depth / 2;
    for (let rightIndex = leftIndex + 1; rightIndex < surfaces.length; rightIndex += 1) {
      const right = surfaces[rightIndex];
      const overlapX = Math.min(leftMaxX, right.centerX + right.width / 2)
        - Math.max(leftMinX, right.centerX - right.width / 2);
      const overlapZ = Math.min(leftMaxZ, right.centerZ + right.depth / 2)
        - Math.max(leftMinZ, right.centerZ - right.depth / 2);
      if (overlapX > 0.0001 && overlapZ > 0.0001) overlaps.push(`${left.id} <> ${right.id}`);
    }
  }
  return overlaps;
}
