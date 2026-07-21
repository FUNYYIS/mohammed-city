export type AssetKind = 'character' | 'vehicle' | 'building' | 'interior' | 'prop' | 'npc' | 'audio';

export interface AssetDefinition {
  id: string;
  kind: AssetKind;
  url: string | null;
  status: 'procedural-prototype' | 'candidate' | 'approved';
  licenseId: string | null;
  triangleBudget?: [minimum: number, maximum: number];
}

/**
 * Direct URLs for the Phase 5 city-content GLBs, used by
 * CityDistricts/CityNPC/SimpleVehicleController. Each Kenney pack ships its
 * own external `Textures/colormap.png` next to its GLBs (these are not
 * fully self-contained single-file GLBs), so every pack lives in its own
 * subfolder -- mixing two packs' models in one folder would make them
 * silently load the wrong colormap.
 */
export const CITY_MODEL_URLS = {
  buildings: {
    a: '/assets/models/buildings/city-kit-commercial/building-a.glb',
    b: '/assets/models/buildings/city-kit-commercial/building-b.glb',
    e: '/assets/models/buildings/city-kit-commercial/building-e.glb',
    h: '/assets/models/buildings/city-kit-commercial/building-h.glb',
    j: '/assets/models/buildings/city-kit-commercial/building-j.glb',
    n: '/assets/models/buildings/city-kit-commercial/building-n.glb',
    skyscraperA: '/assets/models/buildings/city-kit-commercial/building-skyscraper-a.glb',
    skyscraperC: '/assets/models/buildings/city-kit-commercial/building-skyscraper-c.glb',
    lowDetailA: '/assets/models/buildings/city-kit-commercial/low-detail-building-a.glb',
    awning: '/assets/models/buildings/city-kit-commercial/detail-awning.glb',
    overhang: '/assets/models/buildings/city-kit-commercial/detail-overhang.glb',
    industrialA: '/assets/models/buildings/city-kit-industrial/industrial-a.glb',
    industrialK: '/assets/models/buildings/city-kit-industrial/industrial-k.glb',
    industrialR: '/assets/models/buildings/city-kit-industrial/industrial-r.glb',
  },
  props: {
    streetLamp: '/assets/models/props/city-kit-roads/street-lamp.glb',
    streetLampCurved: '/assets/models/props/city-kit-roads/street-lamp-curved.glb',
    roadSign: '/assets/models/props/city-kit-roads/road-sign.glb',
    treeDefault: '/assets/models/props/nature-kit/tree-default.glb',
    treeDetailed: '/assets/models/props/nature-kit/tree-detailed.glb',
    treeCone: '/assets/models/props/nature-kit/tree-cone.glb',
    bush: '/assets/models/props/nature-kit/bush.glb',
    crate: '/assets/models/props/car-kit/crate.glb',
  },
  vehicles: {
    sedan: '/assets/models/vehicles/car-kit/sedan.glb',
    sedanSports: '/assets/models/vehicles/car-kit/sedan-sports.glb',
    taxi: '/assets/models/vehicles/car-kit/taxi.glb',
    van: '/assets/models/vehicles/car-kit/van.glb',
    police: '/assets/models/vehicles/car-kit/police.glb',
    delivery: '/assets/models/vehicles/car-kit/delivery.glb',
    suv: '/assets/models/vehicles/car-kit/suv.glb',
    hatchbackSports: '/assets/models/vehicles/car-kit/hatchback-sports.glb',
  },
  npcs: {
    maleA: '/assets/models/npcs/mini-characters/character-male-a.glb',
    maleC: '/assets/models/npcs/mini-characters/character-male-c.glb',
    femaleA: '/assets/models/npcs/mini-characters/character-female-a.glb',
    femaleD: '/assets/models/npcs/mini-characters/character-female-d.glb',
  },
} as const;

/** Flattened for preloading everything in one pass. */
export const ALL_CITY_MODEL_URLS: readonly string[] = Object.values(CITY_MODEL_URLS)
  .flatMap((group) => Object.values(group));

const phaseOneAssets: AssetDefinition[] = [
  {
    id: 'character.mohammed',
    kind: 'character',
    url: '/assets/characters/mohammed/Meshy_AI_Boy_Thobe_Closed_Mout_biped_Meshy_AI_Meshy_Merged_Animations.glb',
    status: 'approved',
    licenseId: 'meshy-mohammed-2026',
    triangleBudget: [25_000, 60_000],
  },
  { id: 'building.warehouse', kind: 'building', url: null, status: 'procedural-prototype', licenseId: null },
  { id: 'building.garage', kind: 'building', url: null, status: 'procedural-prototype', licenseId: null },
  { id: 'vehicle.bicycle', kind: 'vehicle', url: null, status: 'procedural-prototype', licenseId: null },

  ...Object.entries(CITY_MODEL_URLS.buildings).map(([key, url]): AssetDefinition => ({
    id: `building.kenney.${key}`,
    kind: 'building',
    url,
    status: 'approved',
    licenseId: key.startsWith('industrial') ? 'kenney-city-kit-industrial-2026' : 'kenney-city-kit-commercial-2026',
    triangleBudget: [40, 5300],
  })),
  ...Object.entries(CITY_MODEL_URLS.props).map(([key, url]): AssetDefinition => {
    const licenseId = key.startsWith('tree') || key === 'bush'
      ? 'kenney-nature-kit-2020'
      : key === 'crate' ? 'kenney-car-kit-2026' : 'kenney-city-kit-roads-2026';
    return { id: `prop.kenney.${key}`, kind: 'prop', url, status: 'approved', licenseId, triangleBudget: [40, 410] };
  }),
  ...Object.entries(CITY_MODEL_URLS.vehicles).map(([key, url]): AssetDefinition => ({
    id: `vehicle.kenney-car-kit.${key}`,
    kind: 'vehicle',
    url,
    status: 'approved',
    licenseId: 'kenney-car-kit-2026',
    triangleBudget: [1500, 2200],
  })),
  ...Object.entries(CITY_MODEL_URLS.npcs).map(([key, url]): AssetDefinition => ({
    id: `npc.kenney-mini-characters.${key}`,
    kind: 'npc',
    url,
    status: 'approved',
    licenseId: 'kenney-mini-characters-2026',
    triangleBudget: [700, 900],
  })),
];

export class AssetRegistry {
  private readonly entries = new Map<string, AssetDefinition>();

  constructor(definitions: AssetDefinition[] = phaseOneAssets) {
    definitions.forEach((definition) => this.entries.set(definition.id, { ...definition }));
  }

  get(id: string): AssetDefinition {
    const definition = this.entries.get(id);
    if (!definition) throw new Error(`Unknown asset id: ${id}`);
    return { ...definition };
  }

  replace(id: string, next: Pick<AssetDefinition, 'url' | 'status' | 'licenseId'>): void {
    const current = this.get(id);
    this.entries.set(id, { ...current, ...next });
  }

  list(): AssetDefinition[] {
    return [...this.entries.values()].map((definition) => ({ ...definition }));
  }
}

export const assetRegistry = new AssetRegistry();
