export type AssetKind = 'character' | 'vehicle' | 'building' | 'interior' | 'prop' | 'audio';

export interface AssetDefinition {
  id: string;
  kind: AssetKind;
  url: string | null;
  status: 'procedural-prototype' | 'candidate' | 'approved';
  licenseId: string | null;
  triangleBudget?: [minimum: number, maximum: number];
}

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
  { id: 'prop.street-furniture', kind: 'prop', url: null, status: 'procedural-prototype', licenseId: null },
  { id: 'vehicle.compact', kind: 'vehicle', url: null, status: 'candidate', licenseId: null, triangleBudget: [10_000, 35_000] },
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
