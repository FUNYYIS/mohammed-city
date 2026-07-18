import {
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HingedCityDoor } from '../entities/doors/HingedCityDoor';
import type { InteractableDefinition } from '../interactions/InteractionSystem';
import { PHASE_FOUR_MISSIONS } from '../missions/definitions/phaseFourMissions';
import type { StoryProgress } from '../missions/runtime/StoryMissionRuntime';
import { CollisionWorld } from '../physics/CollisionWorld';

const palette = {
  cream: 0xd9cfbd,
  oldWall: 0x887c6b,
  oldTrim: 0x3d4c4c,
  amber: 0xefa94a,
  teal: 0x28757a,
  coral: 0xc9664d,
  navy: 0x132d3d,
  green: 0x5e986d,
  wood: 0x79553d,
  blue: 0x55a7c2,
};

const targetPositions: Readonly<Record<string, Vector3>> = {
  'friend-report': new Vector3(-24, 1.15, 20),
  'track-1': new Vector3(-16, 0.05, 29),
  'track-2': new Vector3(2, 0.05, 29),
  'track-3': new Vector3(16, 0.05, 29),
  'witness-one': new Vector3(18, 1.15, 22.2),
  'witness-two': new Vector3(42, 1.15, 22.2),
  'store-camera': new Vector3(45, 1.55, 20.7),
  'chase-1': new Vector3(44, 0, 29),
  'chase-2': new Vector3(36, 0, 23),
  'chase-3': new Vector3(27, 0, 35),
  'chase-4': new Vector3(16, 0, 36),
  'recover-bicycle': new Vector3(15, 1, 36),
  'return-bicycle': new Vector3(-24, 0, 20),
  'garage-race-talk': new Vector3(8.7, 1.15, 43),
  'training-1': new Vector3(0, 0, 29),
  'training-2': new Vector3(24, 0, 29),
  'training-3': new Vector3(46, 0, 29),
  'race1-1': new Vector3(36, 0, 29),
  'race1-2': new Vector3(0, 0, 29),
  'race1-3': new Vector3(-38, 0, 29),
  'race1-4': new Vector3(0, 0, 29),
  'race2-1': new Vector3(40, 0, 29),
  'race2-2': new Vector3(0, 0, 29),
  'race2-3': new Vector3(0, 0, 8),
  'race2-4': new Vector3(0, 0, 29),
  'race2-5': new Vector3(-40, 0, 29),
  'race3-1': new Vector3(-42, 0, 29),
  'race3-2': new Vector3(0, 0, 29),
  'race3-3': new Vector3(42, 0, 29),
  'race3-4': new Vector3(0, 0, 29),
  'race3-5': new Vector3(0, 0, 8),
  'race3-6': new Vector3(0, 0, 29),
  'old-key': new Vector3(-26, 1.15, 20),
  'old-house-entry': new Vector3(-39, 0, 16),
  'old-house-door': new Vector3(-39.65, 1.25, 16),
  'symbol-sun': new Vector3(-51.5, 1.25, 18.7),
  'symbol-wave': new Vector3(-49.5, 1.25, 18.7),
  'symbol-star': new Vector3(-47.5, 1.25, 18.7),
  'hidden-room-latch': new Vector3(-47, 1.2, 13.35),
  'map-fragment': new Vector3(-47, 1.1, 11.5),
  'garage-parts-talk': new Vector3(8.7, 1.15, 43),
  'part-battery': new Vector3(-14, 0.75, -10),
  'part-belt': new Vector3(47, 0.75, 24),
  'part-toolkit': new Vector3(-26, 0.75, 14),
  'repair-belt': new Vector3(-3.2, 1, 43.7),
  'repair-battery': new Vector3(0, 1, 43.7),
  'repair-panel': new Vector3(3.2, 1, 43.7),
  'start-classic': new Vector3(-11, 1, 29),
  'classic-test-1': new Vector3(-34, 0, 29),
  'classic-test-2': new Vector3(0, 0, 29),
  'classic-test-3': new Vector3(32, 0, 29),
  'drawer-clue': new Vector3(-3.3, 1.1, 44.4),
};

const interactionLabels: Readonly<Record<string, string>> = {
  'friend-report': 'كلم صديق محمد',
  'witness-one': 'اسأل الشاهد الأول',
  'witness-two': 'اسأل الشاهد الثاني',
  'store-camera': 'افحص تسجيل الكاميرا',
  'recover-bicycle': 'استرجع الدراجة',
  'garage-race-talk': 'كلم صاحب الكراج',
  'old-key': 'خذ المفتاح القديم',
  'old-house-door': 'افتح المدخل الجانبي',
  'symbol-sun': 'اضغط رمز الشمس',
  'symbol-wave': 'اضغط رمز الموجة',
  'symbol-star': 'اضغط رمز النجمة',
  'hidden-room-latch': 'افتح الغرفة المخفية',
  'map-fragment': 'خذ جزء الخريطة',
  'garage-parts-talk': 'اسأل عن القطع المفقودة',
  'part-battery': 'خذ البطارية',
  'part-belt': 'خذ السير',
  'part-toolkit': 'خذ صندوق الأدوات',
  'repair-belt': 'ركب السير',
  'repair-battery': 'وصل البطارية',
  'repair-panel': 'اقفل لوحة المحرك',
  'start-classic': 'شغّل السيارة القديمة',
  'drawer-clue': 'افحص الدرج المخفي',
};

const collectibleIds = new Set([
  'recover-bicycle', 'old-key', 'map-fragment',
  'part-battery', 'part-belt', 'part-toolkit',
]);

export class StoryWorld {
  readonly root = new Group();
  readonly interactables: Readonly<Record<string, InteractableDefinition>>;
  private readonly marker = new Group();
  private readonly nodeMeshes = new Map<string, Object3D>();
  private readonly symbolMaterials = new Map<string, MeshStandardMaterial>();
  private readonly oldHouseDoor: HingedCityDoor;
  private readonly hiddenPanel: Mesh;
  private hiddenPanelRequested = false;
  private hiddenPanelProgress = 0;
  private markerElapsed = 0;
  private markerBaseY = 0;

  constructor(
    private readonly collisions: CollisionWorld,
    cameraObstacles: Object3D[],
  ) {
    this.root.name = 'phase-four-story-world';
    this.addOldHouse(cameraObstacles);
    this.oldHouseDoor = this.createOldHouseDoor(cameraObstacles);
    this.hiddenPanel = this.createHiddenPanel(cameraObstacles);
    this.addStoryProps();
    this.createMarker();
    this.interactables = this.createInteractables();
    this.oldHouseDoor.setZoneActive(true);
  }

  update(delta: number): void {
    this.markerElapsed += delta;
    if (this.marker.visible) {
      this.marker.rotation.y += delta * 1.5;
      this.marker.position.y = this.markerBaseY + Math.sin(this.markerElapsed * 2.6) * 0.08;
    }
    this.oldHouseDoor.update(delta);
    const panelTarget = this.hiddenPanelRequested ? 1 : 0;
    this.hiddenPanelProgress = MathUtils.damp(this.hiddenPanelProgress, panelTarget, 6, delta);
    this.hiddenPanel.position.x = -47 + this.hiddenPanelProgress * 2.4;
    this.collisions.setEnabled('old-house-hidden-panel', this.hiddenPanelProgress < 0.86);
  }

  getTargetPosition(id: string | null): Vector3 | null {
    return id ? targetPositions[id]?.clone() ?? null : null;
  }

  setActiveTarget(id: string | null): void {
    const position = this.getTargetPosition(id);
    this.marker.visible = Boolean(position);
    if (!position) return;
    this.marker.position.copy(position);
    this.marker.position.y = Math.max(2.2, position.y + 1.45);
    this.markerBaseY = this.marker.position.y;
  }

  handleInteraction(id: string): void {
    if (id === 'old-house-door') this.oldHouseDoor.setOpen(true);
    if (id === 'hidden-room-latch') this.hiddenPanelRequested = true;
    if (id.startsWith('symbol-')) {
      const material = this.symbolMaterials.get(id);
      if (material) {
        material.emissive.setHex(palette.amber);
        material.emissiveIntensity = 0.9;
      }
    }
    if (collectibleIds.has(id)) {
      const mesh = this.nodeMeshes.get(id);
      if (mesh) mesh.visible = false;
    }
  }

  applyProgress(progress: StoryProgress): void {
    const completedTargets = completedTargetIds(progress);
    this.nodeMeshes.forEach((mesh, id) => {
      if (collectibleIds.has(id)) mesh.visible = !completedTargets.has(id);
    });
    const doorCompleted = completedTargets.has('old-house-door');
    this.oldHouseDoor.setOpen(doorCompleted);
    this.hiddenPanelRequested = completedTargets.has('hidden-room-latch');
    ['symbol-sun', 'symbol-wave', 'symbol-star'].forEach((id) => {
      const material = this.symbolMaterials.get(id);
      if (!material) return;
      const active = completedTargets.has(id);
      material.emissive.setHex(active ? palette.amber : 0x101514);
      material.emissiveIntensity = active ? 0.9 : 0.12;
    });
  }

  private addOldHouse(cameraObstacles: Object3D[]): void {
    const wall = new MeshStandardMaterial({ color: palette.oldWall, roughness: 0.96 });
    const trim = new MeshStandardMaterial({ color: palette.oldTrim, roughness: 0.88 });
    const pieces: Array<[string, Vector3, Vector3, MeshStandardMaterial]> = [
      ['old-house-back', new Vector3(-47, 2.35, 10), new Vector3(14, 4.7, 0.32), wall],
      ['old-house-left', new Vector3(-54, 2.35, 16), new Vector3(0.32, 4.7, 12), wall],
      ['old-house-front', new Vector3(-47, 2.35, 22), new Vector3(14, 4.7, 0.32), wall],
      ['old-house-right-low', new Vector3(-40, 2.35, 12.3), new Vector3(0.32, 4.7, 4.6), wall],
      ['old-house-right-high', new Vector3(-40, 2.35, 19.7), new Vector3(0.32, 4.7, 4.6), wall],
      ['old-house-door-header', new Vector3(-40, 4.05, 16), new Vector3(0.32, 1.3, 2.8), trim],
      ['old-house-roof', new Vector3(-47, 4.82, 16), new Vector3(14.4, 0.26, 12.4), trim],
      ['old-house-divider-left', new Vector3(-51, 2.35, 13), new Vector3(6, 4.7, 0.25), wall],
      ['old-house-divider-right', new Vector3(-43, 2.35, 13), new Vector3(6, 4.7, 0.25), wall],
    ];
    pieces.forEach(([id, center, size, material]) => {
      const mesh = new Mesh(new RoundedBoxGeometry(size.x, size.y, size.z, 3, 0.1), material);
      mesh.name = id;
      mesh.position.copy(center);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.collisions.addBox(id, center, size);
      cameraObstacles.push(mesh);
    });
    const oldSign = new Mesh(new RoundedBoxGeometry(4.8, 0.62, 0.16, 3, 0.06), new MeshStandardMaterial({ color: palette.wood, roughness: 0.92 }));
    oldSign.position.set(-47, 3.8, 22.2);
    this.root.add(oldSign);
  }

  private createOldHouseDoor(cameraObstacles: Object3D[]): HingedCityDoor {
    const door = new HingedCityDoor(
      'old-house-door',
      new Vector3(-40.14, 1.35, 14.6),
      2.8,
      2.7,
      0.16,
      targetPositions['old-house-door'],
      this.collisions,
      palette.wood,
      -Math.PI / 2,
    );
    this.root.add(door.root);
    cameraObstacles.push(door.mesh);
    return door;
  }

  private createHiddenPanel(cameraObstacles: Object3D[]): Mesh {
    const panel = new Mesh(
      new RoundedBoxGeometry(2, 2.7, 0.2, 3, 0.06),
      new MeshStandardMaterial({ color: palette.oldTrim, roughness: 0.86 }),
    );
    panel.name = 'old-house-hidden-panel';
    panel.position.set(-47, 1.35, 13);
    panel.castShadow = true;
    panel.userData.dynamicCameraObstacle = true;
    this.root.add(panel);
    this.collisions.addBox('old-house-hidden-panel', panel.position, new Vector3(2, 2.7, 0.2));
    cameraObstacles.push(panel);
    return panel;
  }

  private addStoryProps(): void {
    const trackMaterial = new MeshStandardMaterial({
      color: 0x242f31,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -3,
      depthWrite: false,
      side: DoubleSide,
    });
    for (const id of ['track-1', 'track-2', 'track-3']) {
      const track = new Mesh(new RingGeometry(0.34, 0.48, 14, 1, 0, Math.PI * 1.4), trackMaterial);
      track.name = id;
      track.position.copy(targetPositions[id]);
      track.rotation.x = -Math.PI / 2;
      track.renderOrder = 3;
      this.root.add(track);
      this.nodeMeshes.set(id, track);
    }

    const camera = new Group();
    const cameraBody = new Mesh(new RoundedBoxGeometry(0.7, 0.5, 0.55, 3, 0.09), new MeshStandardMaterial({ color: palette.navy, roughness: 0.65 }));
    const lens = new Mesh(new CylinderGeometry(0.15, 0.15, 0.18, 12), new MeshStandardMaterial({ color: palette.blue, emissive: 0x183e4c, emissiveIntensity: 0.4 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.35;
    camera.add(cameraBody, lens);
    camera.position.copy(targetPositions['store-camera']);
    this.root.add(camera);
    this.nodeMeshes.set('store-camera', camera);

    const bikeStand = this.storyBox('recover-bicycle', new Vector3(1.1, 1.45, 0.6), palette.teal);
    bikeStand.position.copy(targetPositions['recover-bicycle']);

    const key = new Mesh(new TorusGeometry(0.2, 0.055, 8, 16), new MeshStandardMaterial({ color: palette.amber, metalness: 0.45, roughness: 0.45 }));
    key.position.copy(targetPositions['old-key']);
    this.root.add(key);
    this.nodeMeshes.set('old-key', key);

    const symbolColors: Record<string, number> = { 'symbol-sun': 0xe6a33d, 'symbol-wave': 0x4f9db3, 'symbol-star': 0xc66b55 };
    Object.entries(symbolColors).forEach(([id, color]) => {
      const material = new MeshStandardMaterial({ color, emissive: 0x101514, emissiveIntensity: 0.12, roughness: 0.7 });
      const button = new Mesh(new CylinderGeometry(0.28, 0.28, 0.15, id === 'symbol-star' ? 5 : 14), material);
      button.position.copy(targetPositions[id]);
      button.rotation.x = Math.PI / 2;
      this.root.add(button);
      this.symbolMaterials.set(id, material);
      this.nodeMeshes.set(id, button);
    });

    const map = new Mesh(new PlaneGeometry(0.9, 0.65), new MeshStandardMaterial({ color: 0xd7b66d, roughness: 0.94, side: DoubleSide }));
    map.position.copy(targetPositions['map-fragment']);
    map.rotation.x = -Math.PI / 2;
    this.root.add(map);
    this.nodeMeshes.set('map-fragment', map);

    const partSpecs: Array<[string, Vector3, number]> = [
      ['part-battery', new Vector3(0.75, 0.55, 0.55), palette.coral],
      ['part-belt', new Vector3(0.65, 0.65, 0.22), palette.navy],
      ['part-toolkit', new Vector3(0.9, 0.5, 0.55), palette.amber],
    ];
    partSpecs.forEach(([id, size, color]) => {
      const part = this.storyBox(id, size, color);
      part.position.copy(targetPositions[id]);
    });

    for (const [index, id] of ['repair-belt', 'repair-battery', 'repair-panel'].entries()) {
      const station = this.storyBox(id, new Vector3(1.15, 1.15, 0.75), [palette.navy, palette.coral, palette.teal][index]);
      station.position.copy(targetPositions[id]);
    }
    const starter = this.storyBox('start-classic', new Vector3(0.55, 0.75, 0.45), palette.green);
    starter.position.copy(targetPositions['start-classic']);
    const drawer = this.storyBox('drawer-clue', new Vector3(0.8, 0.35, 0.55), palette.amber);
    drawer.position.copy(targetPositions['drawer-clue']);
  }

  private storyBox(id: string, size: Vector3, color: number): Mesh {
    const mesh = new Mesh(new RoundedBoxGeometry(size.x, size.y, size.z, 3, 0.07), new MeshStandardMaterial({ color, roughness: 0.78 }));
    mesh.name = id;
    mesh.castShadow = true;
    this.root.add(mesh);
    this.nodeMeshes.set(id, mesh);
    return mesh;
  }

  private createMarker(): void {
    const markerMaterial = new MeshStandardMaterial({ color: palette.amber, emissive: 0xc87921, emissiveIntensity: 0.75 });
    const ring = new Mesh(new TorusGeometry(0.42, 0.08, 8, 20), markerMaterial);
    ring.rotation.x = Math.PI / 2;
    const pointer = new Mesh(new ConeGeometry(0.18, 0.48, 8), markerMaterial);
    pointer.position.y = -0.62;
    pointer.rotation.x = Math.PI;
    this.marker.add(ring, pointer);
    this.marker.visible = false;
    this.root.add(this.marker);
  }

  private createInteractables(): Readonly<Record<string, InteractableDefinition>> {
    return Object.fromEntries(Object.entries(interactionLabels).map(([id, label]) => [id, {
      id,
      label,
      position: targetPositions[id].clone(),
      maxDistance: 2.65,
      minFacingDot: -0.18,
      priority: 4,
      lineOfSightIgnore: interactionObstaclesToIgnore(id),
    }]));
  }
}

function interactionObstaclesToIgnore(id: string): readonly string[] | undefined {
  if (id === 'old-house-door') return ['old-house-door-collider'];
  if (id === 'store-camera') return ['corner-shop-shell'];
  if (id === 'drawer-clue') return ['garage-workbench'];
  return undefined;
}

function completedTargetIds(progress: StoryProgress): Set<string> {
  const completed = new Set<string>();
  PHASE_FOUR_MISSIONS.forEach((mission, missionIndex) => {
    if (missionIndex > progress.missionIndex) return;
    mission.objectives.forEach((objective, objectiveIndex) => {
      const missionFinished = missionIndex < progress.missionIndex;
      const objectiveFinished = missionFinished || objectiveIndex < progress.objectiveIndex;
      if (objectiveFinished) {
        if (objective.targetId) completed.add(objective.targetId);
        objective.sequence?.forEach((id) => completed.add(id));
      } else if (missionIndex === progress.missionIndex && objectiveIndex === progress.objectiveIndex) {
        objective.sequence?.slice(0, progress.sequenceIndex).forEach((id) => completed.add(id));
      }
    });
  });
  return completed;
}
