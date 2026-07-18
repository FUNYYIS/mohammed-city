export type MissionSurfaceMaterial = 'warehouseFloor' | 'road' | 'garageFloor' | 'grass';

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
  { id: 'mission-road', centerX: 0, centerZ: 21.25, width: 10, depth: 33.5, material: 'road' },
  { id: 'garage-floor', centerX: 0, centerZ: 42, width: 12, depth: 8, material: 'garageFloor' },
  { id: 'street-grass-left', centerX: -13.75, centerZ: 25.25, width: 12.5, depth: 41.5, material: 'grass' },
  { id: 'street-grass-right', centerX: 13.75, centerZ: 25.25, width: 12.5, depth: 41.5, material: 'grass' },
];
