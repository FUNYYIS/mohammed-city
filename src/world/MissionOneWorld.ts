import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Scene,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { InteractableDefinition } from '../interactions/InteractionSystem';
import type { MissionProgress } from '../missions/runtime/MissionRuntime';
import { CollisionWorld } from '../physics/CollisionWorld';
import { MISSION_ONE_TOP_SURFACES, type MissionSurfaceMaterial } from './MissionOneSurfaceLayout';

const palette = {
  sky: 0x87b5c3,
  warehouse: 0x173f4b,
  warehouseTrim: 0xd8d1c2,
  floor: 0xb6aa95,
  road: 0x3e4850,
  curb: 0xd7d0c3,
  amber: 0xefa94a,
  teal: 0x28757a,
  coral: 0xc9664d,
  navy: 0x132d3d,
  green: 0x66b487,
};

const DOOR_COLLIDER_ID = 'warehouse-main-door';
const DOOR_CLOSED_Y = 2.08;
const DOOR_OPEN_RISE = 4.35;
const markerBaseY = new Map<string, number>();

export type MissionWorldEvent = 'generator-started' | 'door-opened';

export interface MissionOneWorldResult {
  scene: Scene;
  collisions: CollisionWorld;
  cameraObstacles: Object3D[];
}

export class MissionOneWorld {
  readonly scene = new Scene();
  readonly collisions = new CollisionWorld();
  readonly cameraObstacles: Object3D[] = [];
  readonly spawnPoint = new Vector3(0, 0, -5.5);
  readonly vehicleSpawn = new Vector3(0, 0, 10.2);
  readonly garageGoal = new Vector3(0, 0, 41.2);
  readonly interactables: Readonly<Record<string, InteractableDefinition>>;
  private readonly root = new Group();
  private readonly markers = new Map<string, Group>();
  private readonly breakerLevers = new Map<string, Mesh>();
  private readonly breakerOff = new MeshStandardMaterial({ color: 0x253b44, roughness: 0.62 });
  private readonly breakerMaterials = new Map<string, MeshStandardMaterial>();
  private readonly generatorIndicator = new MeshStandardMaterial({ color: 0x4a3927, emissive: 0x000000 });
  private readonly doorMesh: Mesh;
  private elapsed = 0;
  private generatorTimer = 0;
  private generatorStarting = false;
  private generatorRunning = false;
  private doorRequested = false;
  private doorProgress = 0;
  private doorEventSent = false;
  private generatorEventSent = false;

  constructor() {
    this.scene.name = 'phase-two-mission-one';
    this.scene.background = new Color(palette.sky);
    this.scene.fog = new Fog(palette.sky, 58, 108);
    this.scene.add(this.root);
    this.addLighting();
    this.addGroundLayout();
    this.doorMesh = this.addWarehouse();
    this.addPowerPuzzle();
    this.addWarehouseProps();
    this.addStreet();
    this.addGarage();
    this.addDistantCity();
    this.interactables = this.createInteractables();
    this.createMissionMarkers();
    this.reset();
  }

  getResult(): MissionOneWorldResult {
    return { scene: this.scene, collisions: this.collisions, cameraObstacles: this.cameraObstacles };
  }

  update(delta: number): MissionWorldEvent[] {
    this.elapsed += delta;
    const events: MissionWorldEvent[] = [];
    this.markers.forEach((marker, id) => {
      if (!marker.visible) return;
      marker.rotation.y += delta * 1.35;
      marker.position.y = (markerBaseY.get(id) ?? marker.position.y) + Math.sin(this.elapsed * 2.4) * 0.12;
    });

    if (this.generatorStarting && !this.generatorRunning) {
      this.generatorTimer += delta;
      this.generatorIndicator.emissive.setHex(Math.floor(this.generatorTimer * 10) % 2 ? 0xd58b2f : 0x18221d);
      if (this.generatorTimer >= 1.05) {
        this.generatorRunning = true;
        this.generatorStarting = false;
        this.generatorIndicator.color.setHex(palette.green);
        this.generatorIndicator.emissive.setHex(0x2f8f59);
        this.generatorIndicator.emissiveIntensity = 0.8;
      }
    }
    if (this.generatorRunning && !this.generatorEventSent) {
      this.generatorEventSent = true;
      events.push('generator-started');
    }

    if (this.doorRequested && this.doorProgress < 1) {
      this.doorProgress = Math.min(1, this.doorProgress + delta * 0.62);
      this.syncDoor();
    }
    if (this.doorProgress >= 1 && !this.doorEventSent) {
      this.doorEventSent = true;
      this.collisions.setEnabled(DOOR_COLLIDER_ID, false);
      events.push('door-opened');
    }
    return events;
  }

  startGenerator(): boolean {
    if (this.generatorStarting || this.generatorRunning) return false;
    this.generatorStarting = true;
    this.generatorTimer = 0;
    return true;
  }

  requestDoorOpen(): boolean {
    if (!this.generatorRunning || this.doorRequested) return false;
    this.doorRequested = true;
    return true;
  }

  setBreakerProgress(count: number): void {
    const order = ['breaker-blue', 'breaker-red', 'breaker-yellow'];
    order.forEach((id, index) => {
      const lever = this.breakerLevers.get(id);
      if (!lever) return;
      const active = index < count;
      lever.rotation.z = active ? -0.72 : 0.72;
      lever.material = active ? this.breakerMaterials.get(id)! : this.breakerOff;
    });
  }

  setActiveMarker(id: string | null): void {
    this.markers.forEach((marker, markerId) => { marker.visible = markerId === id; });
  }

  applyProgress(progress: MissionProgress): void {
    this.resetStateOnly();
    if (progress.objectiveIndex > 1) this.setBreakerProgress(3);
    else if (progress.objectiveIndex === 1) this.setBreakerProgress(progress.sequenceIndex);
    if (progress.objectiveIndex > 2) {
      this.generatorRunning = true;
      this.generatorEventSent = true;
      this.generatorIndicator.color.setHex(palette.green);
      this.generatorIndicator.emissive.setHex(0x2f8f59);
      this.generatorIndicator.emissiveIntensity = 0.8;
    }
    if (progress.objectiveIndex > 3) {
      this.doorRequested = true;
      this.doorProgress = 1;
      this.doorEventSent = true;
      this.collisions.setEnabled(DOOR_COLLIDER_ID, false);
      this.syncDoor();
    }
  }

  reset(): void {
    this.resetStateOnly();
    this.setActiveMarker('power-panel');
  }

  getSpawnForProgress(progress: MissionProgress): Vector3 {
    if (progress.objectiveIndex >= 5) return new Vector3(0, 0, 7.2);
    if (progress.objectiveIndex === 4) return new Vector3(0, 0, 2.0);
    return this.spawnPoint.clone();
  }

  isOutsideWarehouse(position: Vector3): boolean {
    return position.z > 5.35;
  }

  isInsideGarage(position: Vector3): boolean {
    const dx = position.x - this.garageGoal.x;
    const dz = position.z - this.garageGoal.z;
    return dx * dx + dz * dz <= 3.1 * 3.1;
  }

  isGeneratorOn(): boolean {
    return this.generatorRunning;
  }

  isDoorOpen(): boolean {
    return this.doorProgress >= 1;
  }

  private resetStateOnly(): void {
    this.generatorTimer = 0;
    this.generatorStarting = false;
    this.generatorRunning = false;
    this.generatorEventSent = false;
    this.generatorIndicator.color.setHex(0x4a3927);
    this.generatorIndicator.emissive.setHex(0x000000);
    this.generatorIndicator.emissiveIntensity = 1;
    this.doorRequested = false;
    this.doorProgress = 0;
    this.doorEventSent = false;
    this.collisions.setEnabled(DOOR_COLLIDER_ID, true);
    this.setBreakerProgress(0);
    this.syncDoor();
  }

  private syncDoor(): void {
    this.doorMesh.position.y = DOOR_CLOSED_Y + this.doorProgress * DOOR_OPEN_RISE;
    this.doorMesh.updateMatrixWorld(true);
    this.collisions.updateBox(
      DOOR_COLLIDER_ID,
      new Vector3(this.doorMesh.position.x, this.doorMesh.position.y, this.doorMesh.position.z),
      new Vector3(4.35, 4.15, 0.24),
    );
  }

  private addLighting(): void {
    const hemisphere = new HemisphereLight(0xdaf2fb, 0x4c665d, 1.65);
    this.scene.add(hemisphere);
    const sun = new DirectionalLight(0xffedd0, 2.85);
    sun.position.set(-18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.028;
    this.scene.add(sun);

    for (const z of [-7.5, 0.2]) {
      const light = new PointLight(0xffd9a0, 14, 14, 2);
      light.position.set(0, 4.65, z);
      this.scene.add(light);
    }
  }

  private addGroundLayout(): void {
    const materials: Record<MissionSurfaceMaterial, MeshStandardMaterial> = {
      warehouseFloor: new MeshStandardMaterial({ color: palette.floor, roughness: 0.95, side: DoubleSide }),
      road: new MeshStandardMaterial({ color: palette.road, roughness: 0.96, side: DoubleSide }),
      garageFloor: new MeshStandardMaterial({ color: 0x9b978d, roughness: 0.96, side: DoubleSide }),
      grass: new MeshStandardMaterial({ color: 0x69816b, roughness: 1, side: DoubleSide }),
    };
    MISSION_ONE_TOP_SURFACES.forEach((surface) => {
      const mesh = this.plane(surface.width, surface.depth, materials[surface.material]);
      mesh.name = surface.id;
      mesh.position.set(surface.centerX, 0, surface.centerZ);
      this.root.add(mesh);
    });
  }

  private addWarehouse(): Mesh {
    const wallMaterial = new MeshStandardMaterial({ color: palette.warehouse, roughness: 0.86 });
    const trimMaterial = new MeshStandardMaterial({ color: palette.warehouseTrim, roughness: 0.92 });
    this.addSolid('warehouse-back-wall', new Vector3(0, 2.8, -13), new Vector3(16, 5.6, 0.35), wallMaterial);
    this.addSolid('warehouse-left-wall', new Vector3(-8, 2.8, -4.25), new Vector3(0.35, 5.6, 17.5), wallMaterial);
    this.addSolid('warehouse-right-wall', new Vector3(8, 2.8, -4.25), new Vector3(0.35, 5.6, 17.5), wallMaterial);
    this.addSolid('warehouse-front-left', new Vector3(-5.15, 2.8, 4.5), new Vector3(5.7, 5.6, 0.35), wallMaterial);
    this.addSolid('warehouse-front-right', new Vector3(5.15, 2.8, 4.5), new Vector3(5.7, 5.6, 0.35), wallMaterial);
    this.addSolid('warehouse-front-header', new Vector3(0, 5.05, 4.5), new Vector3(4.6, 1.1, 0.35), trimMaterial);
    this.addSolid('warehouse-ceiling', new Vector3(0, 5.72, -4.25), new Vector3(16.35, 0.26, 17.8), trimMaterial);

    const door = new Mesh(
      new RoundedBoxGeometry(4.35, 4.15, 0.24, 3, 0.07),
      new MeshStandardMaterial({ color: 0x314953, metalness: 0.24, roughness: 0.58 }),
    );
    door.name = 'warehouse-main-door-visual';
    door.position.set(0, DOOR_CLOSED_Y, 4.36);
    door.castShadow = true;
    door.receiveShadow = true;
    door.userData.dynamicCameraObstacle = true;
    this.root.add(door);
    this.collisions.addBox(DOOR_COLLIDER_ID, door.position, new Vector3(4.35, 4.15, 0.24));
    this.cameraObstacles.push(door);

    const sign = new Mesh(new RoundedBoxGeometry(5.2, 0.7, 0.18, 3, 0.08), new MeshStandardMaterial({ color: palette.amber, roughness: 0.7 }));
    sign.position.set(0, 5.05, 4.72);
    this.root.add(sign);

    for (const z of [-8.5, -0.5]) {
      const lightPanel = new Mesh(new RoundedBoxGeometry(3.2, 0.1, 0.55, 2, 0.04), new MeshStandardMaterial({ color: 0xffe7bd, emissive: 0xffc46a, emissiveIntensity: 0.65 }));
      lightPanel.position.set(0, 5.5, z);
      this.root.add(lightPanel);
    }
    return door;
  }

  private addPowerPuzzle(): void {
    const panel = new Mesh(new RoundedBoxGeometry(0.28, 2.2, 2.8, 3, 0.09), new MeshStandardMaterial({ color: 0x52636a, metalness: 0.28, roughness: 0.55 }));
    panel.position.set(-7.72, 1.55, -5.1);
    panel.castShadow = true;
    this.root.add(panel);

    const colors: Record<string, number> = {
      'breaker-blue': 0x45a6c2,
      'breaker-red': 0xd65f52,
      'breaker-yellow': 0xe9b64c,
    };
    Object.entries(colors).forEach(([id, color], index) => {
      const material = new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.54 });
      this.breakerMaterials.set(id, material);
      const lever = new Mesh(new RoundedBoxGeometry(0.24, 0.18, 0.42, 2, 0.04), this.breakerOff);
      lever.name = id;
      lever.position.set(-7.5, 1.72, -5.8 + index * 0.7);
      lever.rotation.z = 0.72;
      this.breakerLevers.set(id, lever);
      this.root.add(lever);
    });

    const generator = new Group();
    const body = new Mesh(new RoundedBoxGeometry(2.2, 1.45, 1.8, 3, 0.16), new MeshStandardMaterial({ color: palette.coral, roughness: 0.75 }));
    body.position.y = 0.72;
    const top = new Mesh(new RoundedBoxGeometry(1.65, 0.45, 1.2, 3, 0.12), new MeshStandardMaterial({ color: palette.navy, metalness: 0.18, roughness: 0.58 }));
    top.position.y = 1.45;
    const indicator = new Mesh(new CylinderGeometry(0.12, 0.12, 0.08, 12), this.generatorIndicator);
    indicator.position.set(0.55, 1.72, 0.25);
    indicator.rotation.z = Math.PI / 2;
    generator.add(body, top, indicator);
    generator.position.set(5.7, 0, -9.2);
    generator.traverse((object) => { if (object instanceof Mesh) object.castShadow = true; });
    this.root.add(generator);
    this.collisions.addBox('generator-body', new Vector3(5.7, 0.85, -9.2), new Vector3(2.35, 1.7, 1.95));

    const doorControl = new Mesh(new RoundedBoxGeometry(0.35, 0.9, 0.55, 2, 0.07), new MeshStandardMaterial({ color: palette.teal, emissive: 0x17484c, emissiveIntensity: 0.35 }));
    doorControl.position.set(2.75, 1.2, 4.05);
    this.root.add(doorControl);
  }

  private addWarehouseProps(): void {
    const shelfMaterial = new MeshStandardMaterial({ color: 0x52646b, metalness: 0.2, roughness: 0.65 });
    const crateMaterial = new MeshStandardMaterial({ color: 0x9a6845, roughness: 0.92 });
    for (const z of [-10.5, -7.2, -1.2]) {
      const shelf = new Mesh(new RoundedBoxGeometry(0.8, 2.6, 2.5, 2, 0.08), shelfMaterial);
      shelf.position.set(6.95, 1.3, z);
      shelf.castShadow = true;
      this.root.add(shelf);
      this.collisions.addBox(`warehouse-shelf-${z}`, shelf.position, new Vector3(0.8, 2.6, 2.5));
      this.cameraObstacles.push(shelf);
    }
    const cratePositions = [
      [-4.5, -10.2, 1.2], [-3.0, -10.5, 0.9], [3.2, -2.6, 1.05], [4.5, -2.8, 0.72],
    ];
    cratePositions.forEach(([x, z, size], index) => {
      const crate = new Mesh(new RoundedBoxGeometry(size, size, size, 2, 0.06), crateMaterial);
      crate.position.set(x, size * 0.5, z);
      crate.castShadow = true;
      this.root.add(crate);
      this.collisions.addBox(`warehouse-crate-${index}`, crate.position, new Vector3(size, size, size));
      this.cameraObstacles.push(crate);
    });
  }

  private addStreet(): void {
    const curbMaterial = new MeshStandardMaterial({ color: palette.curb, roughness: 0.96 });
    for (const x of [-6.25, 6.25]) {
      const curb = new Mesh(new RoundedBoxGeometry(2.5, 0.2, 33.5, 3, 0.08), curbMaterial);
      curb.position.set(x, 0.1, 21.25);
      curb.receiveShadow = true;
      this.root.add(curb);
      this.collisions.addBox(`street-curb-${x}`, curb.position, new Vector3(2.5, 0.2, 33.5), false);
    }

    const stripeMaterial = new MeshStandardMaterial({
      color: 0xf0c367,
      roughness: 0.82,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
      depthWrite: false,
      side: DoubleSide,
    });
    for (let z = 8; z < 37; z += 5) {
      const stripe = this.plane(0.12, 2.4, stripeMaterial);
      stripe.position.set(0, 0.004, z);
      stripe.renderOrder = 2;
      this.root.add(stripe);
    }

    const poleMaterial = new MeshStandardMaterial({ color: palette.navy, metalness: 0.32, roughness: 0.55 });
    for (const z of [9, 20, 31]) {
      for (const x of [-7.0, 7.0]) {
        const pole = new Mesh(new CylinderGeometry(0.09, 0.12, 4, 10), poleMaterial);
        pole.position.set(x, 2, z);
        pole.castShadow = true;
        this.root.add(pole);
        this.collisions.addBox(`street-light-${x}-${z}`, pole.position, new Vector3(0.3, 4, 0.3), false);
      }
    }
  }

  private addGarage(): void {
    const wall = new MeshStandardMaterial({ color: palette.coral, roughness: 0.82 });
    const trim = new MeshStandardMaterial({ color: palette.amber, roughness: 0.75 });
    this.addSolid('garage-back', new Vector3(0, 2.5, 46), new Vector3(12, 5, 0.35), wall);
    this.addSolid('garage-left', new Vector3(-6, 2.5, 42), new Vector3(0.35, 5, 8), wall);
    this.addSolid('garage-right', new Vector3(6, 2.5, 42), new Vector3(0.35, 5, 8), wall);
    this.addSolid('garage-roof', new Vector3(0, 5.05, 42), new Vector3(12.3, 0.25, 8.3), trim);
    const sign = new Mesh(new RoundedBoxGeometry(5, 0.75, 0.2, 3, 0.08), trim);
    sign.position.set(0, 4.35, 37.9);
    this.root.add(sign);
    const workbench = new Mesh(new RoundedBoxGeometry(3.6, 1.1, 0.8, 3, 0.08), new MeshStandardMaterial({ color: 0x31505a, roughness: 0.72 }));
    workbench.position.set(-3.3, 0.55, 44.8);
    workbench.castShadow = true;
    this.root.add(workbench);
    this.collisions.addBox('garage-workbench', workbench.position, new Vector3(3.6, 1.1, 0.8));
  }

  private addDistantCity(): void {
    const material = new MeshStandardMaterial({ color: 0x527384, roughness: 0.98 });
    const blocks = [
      [-18, 16, 8, 11, 7], [18, 14, 9, 15, 8], [-17, 33, 10, 18, 7], [18, 35, 8, 12, 7],
    ];
    blocks.forEach(([x, z, width, height, depth]) => {
      const block = new Mesh(new RoundedBoxGeometry(width, height, depth, 3, 0.25), material);
      block.position.set(x, height / 2, z);
      this.root.add(block);
    });
  }

  private createInteractables(): Readonly<Record<string, InteractableDefinition>> {
    return {
      'power-panel': { id: 'power-panel', label: 'افحص لوحة الكهرباء', position: new Vector3(-7.25, 1.45, -5.1), priority: 2 },
      'breaker-blue': { id: 'breaker-blue', label: 'شغّل القاطع الأزرق', position: new Vector3(-7.24, 1.72, -5.8), priority: 3 },
      'breaker-red': { id: 'breaker-red', label: 'شغّل القاطع الأحمر', position: new Vector3(-7.24, 1.72, -5.1), priority: 3 },
      'breaker-yellow': { id: 'breaker-yellow', label: 'شغّل القاطع الأصفر', position: new Vector3(-7.24, 1.72, -4.4), priority: 3 },
      generator: { id: 'generator', label: 'شغّل المولد', position: new Vector3(4.45, 1.15, -9.2), priority: 2, lineOfSightIgnore: ['generator-body'] },
      'door-control': { id: 'door-control', label: 'افتح الباب الرئيسي', position: new Vector3(2.75, 1.2, 4.05), priority: 2 },
    };
  }

  private createMissionMarkers(): void {
    const positions: Record<string, Vector3> = {
      'power-panel': new Vector3(-6.9, 2.8, -5.1),
      'breaker-blue': new Vector3(-6.9, 2.65, -5.8),
      'breaker-red': new Vector3(-6.9, 2.65, -5.1),
      'breaker-yellow': new Vector3(-6.9, 2.65, -4.4),
      generator: new Vector3(4.5, 2.8, -9.2),
      'door-control': new Vector3(2.75, 2.5, 4.0),
      'warehouse-exit': new Vector3(0, 2.1, 6.4),
      'mission-car': new Vector3(0, 2.6, 10.2),
      'garage-goal': new Vector3(0, 2.6, 41.2),
    };
    Object.entries(positions).forEach(([id, position]) => {
      const marker = new Group();
      const ring = new Mesh(new TorusGeometry(0.28, 0.06, 8, 18), new MeshStandardMaterial({ color: palette.amber, emissive: 0xc87921, emissiveIntensity: 0.72 }));
      ring.rotation.x = Math.PI / 2;
      const pointer = new Mesh(new ConeGeometry(0.13, 0.32, 8), ring.material);
      pointer.position.y = -0.42;
      pointer.rotation.x = Math.PI;
      marker.add(ring, pointer);
      marker.position.copy(position);
      marker.visible = false;
      markerBaseY.set(id, position.y);
      this.markers.set(id, marker);
      this.root.add(marker);
    });
  }

  private addSolid(id: string, center: Vector3, size: Vector3, material: MeshStandardMaterial): Mesh {
    const mesh = new Mesh(new RoundedBoxGeometry(size.x, size.y, size.z, 3, Math.min(0.14, Math.min(size.x, size.y, size.z) * 0.2)), material);
    mesh.name = id;
    mesh.position.copy(center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.collisions.addBox(id, center, size);
    this.cameraObstacles.push(mesh);
    return mesh;
  }

  private plane(width: number, depth: number, material: MeshStandardMaterial): Mesh {
    const mesh = new Mesh(new PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  }
}
