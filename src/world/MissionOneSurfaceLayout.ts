export type MissionSurfaceMaterial =
  | 'warehouseFloor'
  | 'road'
  | 'garageFloor'
  | 'houseFloor'
  | 'shopFloor'
  | 'grass';

export interface MissionTopSurface {
  id: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  material: MissionSurfaceMaterial;
}

export const MISSION_ONE_TOP_SURFACES: readonly MissionTopSurface[] = [
  { id: 'warehouse-floor', centerX: 0, centerZ: -4.25, width: 16, depth: 17.5, material: 'warehouseFloor' },
  { id: 'warehouse-grass-west', centerX: -31, centerZ: -5.75, width: 46, depth: 20.5, material: 'grass' },
  { id: 'warehouse-grass-east', centerX: 31, centerZ: -5.75, width: 46, depth: 20.5, material: 'grass' },
  { id: 'mission-road-south', centerX: 0, centerZ: 14.25, width: 10, depth: 19.5, material: 'road' },
  // The following ground rectangles are trimmed (or, where fully consumed,
  // removed) versus their original bounds so they stop exactly at the real
  // sidewalk tiles built in CitySidewalks.ts, instead of continuing to run
  // underneath them. Both this flat placeholder and the real sidewalk mesh
  // sit at the same y=0 top height, so any remaining overlap is an exact
  // coplanar surface and z-fights, flickering through as green/blue patches.
  // Confirmed by scanning the live scene's actual mesh bounding boxes -- 14
  // surfaces overlapped the sidewalk footprint before this trim.
  { id: 'south-grass-west-low', centerX: -31, centerZ: 7.25, width: 46, depth: 5.5, material: 'grass' },
  { id: 'south-grass-east-low', centerX: 31, centerZ: 7.25, width: 46, depth: 5.5, material: 'grass' },
  { id: 'old-house-floor', centerX: -47, centerZ: 15.5, width: 14, depth: 11, material: 'houseFloor' },
  { id: 'mohammed-house-floor', centerX: -34, centerZ: 15.5, width: 12, depth: 11, material: 'houseFloor' },
  { id: 'neighborhood-grass-east', centerX: -18, centerZ: 15.5, width: 20, depth: 11, material: 'grass' },
  { id: 'south-grass-east-high', centerX: 31, centerZ: 15.5, width: 46, depth: 11, material: 'grass' },
  { id: 'commercial-road', centerX: 0, centerZ: 29, width: 108, depth: 10, material: 'road' },
  { id: 'mission-road-north', centerX: 0, centerZ: 36, width: 10, depth: 4, material: 'road' },
  { id: 'garage-floor', centerX: 0, centerZ: 42, width: 12, depth: 8, material: 'garageFloor' },
  { id: 'garage-grass-west', centerX: -30, centerZ: 42.5, width: 48, depth: 11, material: 'grass' },
  { id: 'garage-grass-east', centerX: 14, centerZ: 42.5, width: 16, depth: 11, material: 'grass' },
  { id: 'supermarket-floor', centerX: 30, centerZ: 42.5, width: 16, depth: 11, material: 'shopFloor' },
  { id: 'supermarket-grass-east', centerX: 46, centerZ: 42.5, width: 16, depth: 11, material: 'grass' },
  { id: 'north-grass', centerX: 0, centerZ: 54, width: 108, depth: 12, material: 'grass' },
];
