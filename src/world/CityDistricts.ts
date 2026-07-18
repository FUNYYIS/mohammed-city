import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HingedCityDoor } from '../entities/doors/HingedCityDoor';
import { CityNPC } from '../entities/npc/CityNPC';
import type { InteractableDefinition } from '../interactions/InteractionSystem';
import { CollisionWorld } from '../physics/CollisionWorld';
import {
  ZoneStreamingManager,
  type StreamedZoneContent,
  type ZoneStreamingState,
} from '../streaming/ZoneStreamingManager';

const colors = {
  cream: 0xe9dfcb,
  warmWhite: 0xf2ead9,
  teal: 0x26747a,
  navy: 0x173b4b,
  coral: 0xc76b52,
  amber: 0xe9a744,
  green: 0x4e8064,
  dark: 0x263840,
  wood: 0x8c6548,
  glass: 0x83b7c1,
};

export interface CityStreamingUpdate {
  enteredLocation: string | null;
}

export class CityDistricts {
  readonly cityStartPoint = new Vector3(0, 0, 31);
  private readonly streaming: ZoneStreamingManager;
  private lastLocation = '';

  constructor(
    root: Group,
    private readonly collisions: CollisionWorld,
    cameraObstacles: Object3D[],
  ) {
    this.streaming = new ZoneStreamingManager([
      {
        id: 'warehouse-district',
        label: 'منطقة المستودعات',
        center: new Vector3(0, 0, -4),
        preloadRadius: 52,
        activeRadius: 29,
        build: () => this.buildWarehouseDistrict(),
      },
      {
        id: 'mohammed-neighborhood',
        label: 'حي محمد',
        center: new Vector3(-34, 0, 16),
        preloadRadius: 48,
        activeRadius: 27,
        build: () => this.buildNeighborhood(),
      },
      {
        id: 'commercial-street',
        label: 'الشارع التجاري',
        center: new Vector3(31, 0, 34),
        preloadRadius: 50,
        activeRadius: 34,
        build: () => this.buildCommercialStreet(),
      },
      {
        id: 'garage-district',
        label: 'منطقة الكراجات',
        center: new Vector3(8, 0, 43),
        preloadRadius: 42,
        activeRadius: 25,
        build: () => this.buildGarageDistrict(),
      },
    ], root, collisions, cameraObstacles);
  }

  update(delta: number, navigationPosition: Vector3, playerPosition: Vector3): CityStreamingUpdate {
    this.streaming.update(delta, navigationPosition, playerPosition);
    const location = this.getLocationLabel(navigationPosition);
    const enteredLocation = location !== this.lastLocation ? location : null;
    this.lastLocation = location;
    return { enteredLocation };
  }

  getStates(): Readonly<Record<string, ZoneStreamingState>> {
    return this.streaming.getStates();
  }

  getActiveZoneIds(): string[] {
    return this.streaming.getActiveZoneIds();
  }

  getActiveNPCCount(): number {
    return this.streaming.getActiveNPCCount();
  }

  getInteractables(): InteractableDefinition[] {
    return this.streaming.getActiveInteractables();
  }

  interact(id: string): string | null {
    return this.streaming.interact(id);
  }

  getLocationLabel(position: Vector3): string {
    if (position.z < 7) return 'منطقة المستودعات';
    if (position.x < -13 && position.z < 24) return 'حي محمد';
    if (position.x > 13 && position.z >= 22 && position.z <= 50) return 'الشارع التجاري';
    if (position.z > 35 && position.x <= 13) return 'منطقة الكراجات';
    return 'تقاطع المدينة';
  }

  isInsideInterior(position: Vector3): boolean {
    const insideHouse = position.x > -39.6 && position.x < -28.4
      && position.z > 10.4 && position.z < 21.8;
    const insideSupermarket = position.x > 22.4 && position.x < 37.6
      && position.z > 36.2 && position.z < 47.7;
    const insideWarehouse = position.x > -7.7 && position.x < 7.7
      && position.z > -12.7 && position.z < 4.25;
    const insideGarage = position.x > -5.7 && position.x < 5.7
      && position.z > 38.15 && position.z < 45.7;
    return insideHouse || insideSupermarket || insideWarehouse || insideGarage;
  }

  private buildNeighborhood(): StreamedZoneContent {
    const root = new Group();
    const colliderIds: string[] = [];
    const cameraObstacles: Object3D[] = [];
    const wall = material(colors.warmWhite, 0.9);
    const trim = material(colors.teal, 0.76);
    const roof = material(colors.navy, 0.82);

    this.addSolid(root, colliderIds, cameraObstacles, 'home-back', new Vector3(-34, 2.3, 10), new Vector3(12, 4.6, 0.3), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'home-left', new Vector3(-40, 2.3, 16), new Vector3(0.3, 4.6, 12), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'home-right', new Vector3(-28, 2.3, 16), new Vector3(0.3, 4.6, 12), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'home-front-left', new Vector3(-37.5, 2.3, 22), new Vector3(5, 4.6, 0.3), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'home-front-right', new Vector3(-30.5, 2.3, 22), new Vector3(5, 4.6, 0.3), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'home-door-header', new Vector3(-34, 4, 22), new Vector3(2, 1.2, 0.3), trim);
    this.addSolid(root, colliderIds, cameraObstacles, 'home-roof', new Vector3(-34, 4.72, 16), new Vector3(12.4, 0.24, 12.4), roof);

    const door = new HingedCityDoor(
      'mohammed-home-door',
      new Vector3(-35, 1.3, 21.86),
      2,
      2.6,
      0.16,
      new Vector3(-34, 1.25, 22.35),
      this.collisions,
      colors.wood,
    );
    root.add(door.root);
    colliderIds.push(door.getColliderId());
    cameraObstacles.push(door.mesh);

    const windowMaterial = new MeshStandardMaterial({ color: colors.glass, roughness: 0.26, metalness: 0.08 });
    for (const x of [-38.1, -29.9]) {
      const window = new Mesh(new RoundedBoxGeometry(2.2, 1.35, 0.12, 3, 0.06), windowMaterial);
      window.position.set(x, 2.4, 22.18);
      root.add(window);
    }
    this.addSolid(root, colliderIds, cameraObstacles, 'home-sofa', new Vector3(-37, 0.55, 14), new Vector3(3.1, 1.1, 1.15), material(colors.coral, 0.88));
    this.addSolid(root, colliderIds, cameraObstacles, 'home-kitchen', new Vector3(-30, 0.55, 12), new Vector3(3.2, 1.1, 0.8), material(colors.teal, 0.82));
    this.addSolid(root, colliderIds, cameraObstacles, 'home-table', new Vector3(-34, 0.55, 17), new Vector3(1.7, 1.1, 1.25), material(colors.wood, 0.88));

    this.addTree(root, -46, 18, 1.05);
    this.addTree(root, -23, 13, 0.9);
    const resident = new CityNPC('neighborhood-resident', 'أبو راشد', [
      new Vector3(-25, 0, 20),
      new Vector3(-21, 0, 20),
      new Vector3(-21, 0, 15),
      new Vector3(-25, 0, 15),
    ], { clothing: 0xe8e2d5, accent: 0x527184 });
    root.add(resident.root);

    return {
      root,
      colliderIds,
      cameraObstacles,
      interactables: [door.interactable],
      update: (delta, player) => { door.update(delta); resident.update(delta, player); },
      interact: (id) => id === door.interactable.id ? door.toggle() : null,
      setActive: (active) => door.setZoneActive(active),
      getActiveNPCCount: () => 1,
    };
  }

  private buildCommercialStreet(): StreamedZoneContent {
    const root = new Group();
    const colliderIds: string[] = [];
    const cameraObstacles: Object3D[] = [];
    const wall = material(0xe6d6b8, 0.88);
    const trim = material(colors.coral, 0.76);
    const roof = material(colors.navy, 0.84);

    this.addSolid(root, colliderIds, cameraObstacles, 'market-back', new Vector3(30, 2.5, 48), new Vector3(16, 5, 0.3), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'market-left', new Vector3(22, 2.5, 42), new Vector3(0.3, 5, 12), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'market-right', new Vector3(38, 2.5, 42), new Vector3(0.3, 5, 12), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'market-front-left', new Vector3(25.25, 2.5, 36), new Vector3(6.5, 5, 0.3), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'market-front-right', new Vector3(34.75, 2.5, 36), new Vector3(6.5, 5, 0.3), wall);
    this.addSolid(root, colliderIds, cameraObstacles, 'market-door-header', new Vector3(30, 4.2, 36), new Vector3(3, 1.6, 0.3), trim);
    this.addSolid(root, colliderIds, cameraObstacles, 'market-roof', new Vector3(30, 5.12, 42), new Vector3(16.4, 0.24, 12.4), roof);

    const door = new HingedCityDoor(
      'supermarket-door',
      new Vector3(28.5, 1.35, 36.14),
      3,
      2.7,
      0.14,
      new Vector3(30, 1.25, 35.55),
      this.collisions,
      colors.teal,
    );
    root.add(door.root);
    colliderIds.push(door.getColliderId());
    cameraObstacles.push(door.mesh);

    const glass = new MeshStandardMaterial({ color: colors.glass, roughness: 0.22, metalness: 0.05 });
    for (const x of [24.8, 35.2]) {
      const window = new Mesh(new RoundedBoxGeometry(3.8, 2.25, 0.1, 3, 0.05), glass);
      window.position.set(x, 2.25, 35.82);
      root.add(window);
    }
    const shelfMaterial = material(colors.green, 0.8);
    for (const x of [26, 34]) {
      this.addSolid(root, colliderIds, cameraObstacles, `market-shelf-${x}`, new Vector3(x, 1.0, 42.5), new Vector3(1.15, 2, 5.1), shelfMaterial);
    }
    this.addSolid(root, colliderIds, cameraObstacles, 'market-cashier', new Vector3(35, 0.65, 38), new Vector3(3.4, 1.3, 0.8), material(colors.wood, 0.82));
    this.addSolid(root, colliderIds, cameraObstacles, 'market-fridge', new Vector3(23, 1.25, 44.5), new Vector3(0.75, 2.5, 4), material(0xdde8e6, 0.5));

    this.addStorefront(root, colliderIds, cameraObstacles, 'bakery', 18, 17.2, colors.amber);
    this.addStorefront(root, colliderIds, cameraObstacles, 'corner-shop', 45, 17.2, colors.teal);
    for (const x of [14, 42, 50]) this.addStreetLamp(root, x, 21.6);

    const worker = new CityNPC('market-worker', 'سالم', [
      new Vector3(31, 0, 45.5),
      new Vector3(31, 0, 39),
    ], { clothing: colors.teal, accent: 0xe6d8c3 });
    const shopper = new CityNPC('shopper', 'راشد', [
      new Vector3(14, 0, 22.2),
      new Vector3(22, 0, 22.2),
      new Vector3(22, 0, 35),
      new Vector3(14, 0, 35),
    ], { clothing: colors.coral, accent: colors.navy });
    root.add(worker.root, shopper.root);

    return {
      root,
      colliderIds,
      cameraObstacles,
      interactables: [door.interactable],
      update: (delta, player) => {
        door.update(delta);
        worker.update(delta, player);
        shopper.update(delta, player);
      },
      interact: (id) => id === door.interactable.id ? door.toggle() : null,
      setActive: (active) => door.setZoneActive(active),
      getActiveNPCCount: () => 2,
    };
  }

  private buildWarehouseDistrict(): StreamedZoneContent {
    const root = new Group();
    const colliderIds: string[] = [];
    const cameraObstacles: Object3D[] = [];
    const warehouse = material(0x42616b, 0.91);
    const trim = material(colors.amber, 0.76);
    for (const x of [-21, 21]) {
      this.addSolid(root, colliderIds, cameraObstacles, `outer-warehouse-${x}`, new Vector3(x, 2.8, -5), new Vector3(10, 5.6, 13), warehouse);
      const sign = new Mesh(new RoundedBoxGeometry(5.2, 0.65, 0.18, 3, 0.07), trim);
      sign.position.set(x, 4.5, 1.58);
      root.add(sign);
    }
    const crateMaterial = material(colors.wood, 0.94);
    for (const [index, x, z] of [[0, -13, -10], [1, 13, -8], [2, 15, 0]] as const) {
      this.addSolid(root, colliderIds, cameraObstacles, `yard-crate-${index}`, new Vector3(x, 0.75, z), new Vector3(1.5, 1.5, 1.5), crateMaterial);
    }
    const guard = new CityNPC('warehouse-guard', 'حارس المستودع', [
      new Vector3(10, 0, 1.5),
      new Vector3(15, 0, 1.5),
      new Vector3(15, 0, -11),
      new Vector3(10, 0, -11),
    ], { clothing: colors.navy, accent: colors.amber });
    root.add(guard.root);
    return {
      root,
      colliderIds,
      cameraObstacles,
      update: (delta, player) => guard.update(delta, player),
      getActiveNPCCount: () => 1,
    };
  }

  private buildGarageDistrict(): StreamedZoneContent {
    const root = new Group();
    const colliderIds: string[] = [];
    const cameraObstacles: Object3D[] = [];
    const workshop = material(colors.dark, 0.86);
    const trim = material(colors.amber, 0.78);
    this.addSolid(root, colliderIds, cameraObstacles, 'secondary-garage-back', new Vector3(15, 2.35, 58), new Vector3(12, 4.7, 0.32), workshop);
    this.addSolid(root, colliderIds, cameraObstacles, 'secondary-garage-left', new Vector3(9, 2.35, 53), new Vector3(0.32, 4.7, 10), workshop);
    this.addSolid(root, colliderIds, cameraObstacles, 'secondary-garage-right', new Vector3(21, 2.35, 53), new Vector3(0.32, 4.7, 10), workshop);
    this.addSolid(root, colliderIds, cameraObstacles, 'secondary-garage-roof', new Vector3(15, 4.8, 53), new Vector3(12.4, 0.25, 10.4), trim);
    this.addSolid(root, colliderIds, cameraObstacles, 'garage-tool-chest', new Vector3(9.5, 0.65, 39.5), new Vector3(1.2, 1.3, 2.8), material(colors.coral, 0.75));
    const mechanic = new CityNPC('garage-owner', 'صاحب الكراج', [
      new Vector3(8.5, 0, 43),
      new Vector3(11, 0, 43),
      new Vector3(11, 0, 38.5),
      new Vector3(8.5, 0, 38.5),
    ], { clothing: colors.coral, accent: colors.dark });
    root.add(mechanic.root);
    return {
      root,
      colliderIds,
      cameraObstacles,
      update: (delta, player) => mechanic.update(delta, player),
      getActiveNPCCount: () => 1,
    };
  }

  private addStorefront(
    root: Group,
    colliderIds: string[],
    obstacles: Object3D[],
    id: string,
    x: number,
    z: number,
    accentColor: number,
  ): void {
    const building = this.addSolid(root, colliderIds, obstacles, `${id}-shell`, new Vector3(x, 2.4, z), new Vector3(10, 4.8, 7.5), material(colors.cream, 0.92));
    building.receiveShadow = true;
    const awning = new Mesh(new RoundedBoxGeometry(7, 0.35, 1.4, 3, 0.12), material(accentColor, 0.7));
    awning.position.set(x, 3.15, 21.05);
    root.add(awning);
  }

  private addTree(root: Group, x: number, z: number, scale: number): void {
    const trunk = new Mesh(new CylinderGeometry(0.16 * scale, 0.22 * scale, 2.2 * scale, 8), material(colors.wood, 0.95));
    trunk.position.set(x, 1.1 * scale, z);
    const crown = new Mesh(new ConeGeometry(1.05 * scale, 2.6 * scale, 9), material(colors.green, 0.94));
    crown.position.set(x, 2.8 * scale, z);
    trunk.castShadow = true;
    crown.castShadow = true;
    root.add(trunk, crown);
  }

  private addStreetLamp(root: Group, x: number, z: number): void {
    const pole = new Mesh(new CylinderGeometry(0.08, 0.12, 3.6, 9), material(colors.dark, 0.62));
    pole.position.set(x, 1.8, z);
    const lamp = new Mesh(new RoundedBoxGeometry(0.65, 0.22, 0.42, 2, 0.05), material(0xffdda0, 0.45));
    lamp.position.set(x, 3.55, z);
    root.add(pole, lamp);
  }

  private addSolid(
    root: Group,
    colliderIds: string[],
    obstacles: Object3D[],
    id: string,
    center: Vector3,
    size: Vector3,
    meshMaterial: MeshStandardMaterial,
  ): Mesh {
    const mesh = new Mesh(
      new RoundedBoxGeometry(size.x, size.y, size.z, 3, Math.min(0.14, Math.min(size.x, size.y, size.z) * 0.2)),
      meshMaterial,
    );
    mesh.name = id;
    mesh.position.copy(center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    this.collisions.addBox(id, center, size);
    colliderIds.push(id);
    obstacles.push(mesh);
    return mesh;
  }
}

function material(color: number, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness });
}
