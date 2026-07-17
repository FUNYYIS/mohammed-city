import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CollisionWorld } from '../physics/CollisionWorld';
import { WORLD_TOP_SURFACES, type SurfaceMaterialId } from './SurfaceLayout';

const palette = {
  sky: 0x9bc5d2,
  cream: 0xf0e8db,
  teal: 0x236c73,
  deepTeal: 0x174b56,
  navy: 0x18364b,
  road: 0x3e4850,
  curb: 0xd9d2c5,
  amber: 0xe9a34b,
  coral: 0xc7654d,
  green: 0x4f745e,
};

export interface TestWorldResult {
  scene: Scene;
  collisions: CollisionWorld;
  cameraObstacles: Object3D[];
}

export class TestWorld {
  readonly scene = new Scene();
  readonly collisions = new CollisionWorld();
  readonly cameraObstacles: Object3D[] = [];
  private readonly staticRoot = new Group();
  private colliderIndex = 0;

  constructor() {
    this.scene.name = 'phase-one-test-city';
    this.scene.background = new Color(palette.sky);
    this.scene.fog = new Fog(palette.sky, 52, 112);
    this.scene.add(this.staticRoot);
    this.addLighting();
    this.addGroundAndRoad();
    this.addWarehouseFacade();
    this.addWorkshopFacade();
    this.addTrainingWalls();
    this.addStreetFurniture();
    this.addTrees();
    this.addDistantSilhouette();
  }

  getResult(): TestWorldResult {
    return {
      scene: this.scene,
      collisions: this.collisions,
      cameraObstacles: this.cameraObstacles,
    };
  }

  private addLighting(): void {
    const hemisphere = new HemisphereLight(0xe4f5ff, 0x567064, 2.1);
    this.scene.add(hemisphere);
    const sun = new DirectionalLight(0xffefd2, 3.2);
    sun.position.set(-22, 32, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);
  }

  private addGroundAndRoad(): void {
    const surfaceMaterials: Record<SurfaceMaterialId, MeshStandardMaterial> = {
      grass: new MeshStandardMaterial({ color: 0x647d69, roughness: 1 }),
      road: new MeshStandardMaterial({ color: palette.road, roughness: 0.96 }),
      plazaBorder: new MeshStandardMaterial({ color: 0xc7bda9, roughness: 0.98 }),
      plazaInner: new MeshStandardMaterial({ color: 0xdad1c1, roughness: 0.96 }),
    };
    WORLD_TOP_SURFACES.forEach((surface) => {
      const mesh = this.surface(surface.width, surface.depth, surfaceMaterials[surface.material]);
      mesh.name = surface.id;
      mesh.position.set(surface.centerX, 0, surface.centerZ);
      this.staticRoot.add(mesh);
    });

    // Painted road markings are the only intentional decal layer. A tiny,
    // explicit paint separation plus polygon offset prevents mobile z-fighting.
    const laneMaterial = new MeshStandardMaterial({
      color: 0xf1c567,
      roughness: 0.86,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
      depthWrite: false,
    });
    const laneGeometry = new PlaneGeometry(2.4, 0.1);
    for (let x = -31; x <= 39; x += 5.2) {
      const stripe = new Mesh(laneGeometry, laneMaterial);
      stripe.name = 'road-lane-marking';
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.004, -4);
      stripe.renderOrder = 2;
      this.staticRoot.add(stripe);
    }

    for (const z of [-9.5, 1.5]) {
      const sidewalk = new Mesh(
        new RoundedBoxGeometry(80, 0.18, 2.7, 3, 0.1),
        new MeshStandardMaterial({ color: palette.curb, roughness: 0.95 }),
      );
      sidewalk.position.set(4, 0.08, z);
      sidewalk.receiveShadow = true;
      this.staticRoot.add(sidewalk);
    }
  }

  private addWarehouseFacade(): void {
    const root = new Group();
    root.position.set(-19, 0, -13.2);
    const bodyMaterial = new MeshStandardMaterial({ color: palette.deepTeal, roughness: 0.78 });
    const trimMaterial = new MeshStandardMaterial({ color: palette.cream, roughness: 0.86 });
    const body = new Mesh(new RoundedBoxGeometry(14, 6.8, 7.4, 4, 0.28), bodyMaterial);
    body.position.y = 3.4;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    const roof = new Mesh(new RoundedBoxGeometry(14.8, 0.5, 8.1, 3, 0.18), trimMaterial);
    roof.position.y = 6.72;
    roof.castShadow = true;
    root.add(roof);

    const door = new Mesh(
      new RoundedBoxGeometry(5.1, 4.35, 0.18, 3, 0.08),
      new MeshStandardMaterial({ color: 0x243a47, metalness: 0.18, roughness: 0.62 }),
    );
    door.position.set(2.1, 2.2, 3.73);
    root.add(door);
    for (let y = 0.65; y < 4; y += 0.55) {
      const seam = new Mesh(new BoxGeometry(4.7, 0.035, 0.03), trimMaterial);
      seam.position.set(2.1, y, 3.84);
      root.add(seam);
    }

    const office = new Mesh(
      new RoundedBoxGeometry(3.5, 2.9, 0.22, 3, 0.08),
      new MeshStandardMaterial({ color: 0x8fc0c2, metalness: 0.05, roughness: 0.38 }),
    );
    office.position.set(-3.7, 3.2, 3.73);
    root.add(office);

    const sign = this.makeSign('M CITY  •  01', 4.6, 0.7, palette.amber);
    sign.position.set(-2.6, 5.55, 3.85);
    root.add(sign);
    this.staticRoot.add(root);

    this.addColliderForMesh(body, root.position, new Vector3(14, 6.8, 7.4));
  }

  private addWorkshopFacade(): void {
    const root = new Group();
    root.position.set(22, 0, -12.5);
    const body = new Mesh(
      new RoundedBoxGeometry(12, 5.4, 6.5, 4, 0.32),
      new MeshStandardMaterial({ color: palette.coral, roughness: 0.84 }),
    );
    body.position.y = 2.7;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);
    const canopy = new Mesh(
      new RoundedBoxGeometry(8, 0.32, 1.8, 3, 0.12),
      new MeshStandardMaterial({ color: palette.amber, roughness: 0.78 }),
    );
    canopy.position.set(-0.5, 4.45, 3.85);
    canopy.castShadow = true;
    root.add(canopy);
    const garageDoor = new Mesh(
      new RoundedBoxGeometry(6.5, 3.5, 0.2, 3, 0.07),
      new MeshStandardMaterial({ color: 0x384d57, metalness: 0.22, roughness: 0.58 }),
    );
    garageDoor.position.set(-1.1, 1.8, 3.3);
    root.add(garageDoor);
    const sign = this.makeSign('GARAGE', 4.2, 0.72, palette.cream);
    sign.position.set(2.1, 4.55, 3.38);
    root.add(sign);
    this.staticRoot.add(root);
    this.addColliderForMesh(body, root.position, new Vector3(12, 5.4, 6.5));
  }

  private addTrainingWalls(): void {
    const material = new MeshStandardMaterial({ color: palette.cream, roughness: 0.92 });
    const accents = new MeshStandardMaterial({ color: palette.teal, roughness: 0.82 });
    const segments = [
      { center: new Vector3(-12.2, 1.15, 10), size: new Vector3(0.55, 2.3, 20) },
      { center: new Vector3(12.2, 1.15, 10), size: new Vector3(0.55, 2.3, 20) },
      { center: new Vector3(-7.5, 1.15, 19.8), size: new Vector3(9.8, 2.3, 0.55) },
      { center: new Vector3(7.5, 1.15, 19.8), size: new Vector3(9.8, 2.3, 0.55) },
    ];
    segments.forEach(({ center, size }, index) => {
      const wall = new Mesh(new RoundedBoxGeometry(size.x, size.y, size.z, 3, 0.16), index % 2 ? accents : material);
      wall.position.copy(center);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.staticRoot.add(wall);
      this.addColliderForMesh(wall, new Vector3(), size);
    });

    const lowBarrier = new Mesh(new RoundedBoxGeometry(3.2, 0.75, 0.55, 3, 0.15), accents);
    lowBarrier.position.set(-4, 0.375, 11);
    lowBarrier.castShadow = true;
    this.staticRoot.add(lowBarrier);
    this.addColliderForMesh(lowBarrier, new Vector3(), new Vector3(3.2, 0.75, 0.55));

    const tallBarrier = new Mesh(new RoundedBoxGeometry(0.65, 2.4, 4.8, 3, 0.14), material);
    tallBarrier.position.set(4.5, 1.2, 11.5);
    tallBarrier.castShadow = true;
    this.staticRoot.add(tallBarrier);
    this.addColliderForMesh(tallBarrier, new Vector3(), new Vector3(0.65, 2.4, 4.8));
  }

  private addStreetFurniture(): void {
    const dark = new MeshStandardMaterial({ color: palette.navy, metalness: 0.28, roughness: 0.5 });
    const glow = new MeshStandardMaterial({ color: 0xffd98d, emissive: 0xf0a53a, emissiveIntensity: 0.65 });
    for (const x of [-10, 0, 10, 20]) {
      const root = new Group();
      const pole = new Mesh(new CylinderGeometry(0.08, 0.11, 3.8, 10), dark);
      pole.position.y = 1.9;
      const arm = new Mesh(new CylinderGeometry(0.055, 0.055, 0.72, 8), dark);
      arm.position.set(0.32, 3.7, 0);
      arm.rotation.z = Math.PI / 2;
      const lamp = new Mesh(new RoundedBoxGeometry(0.42, 0.16, 0.3, 2, 0.06), glow);
      lamp.position.set(0.68, 3.65, 0);
      root.add(pole, arm, lamp);
      root.position.set(x, 0, 0.3);
      root.traverse((object) => { if (object instanceof Mesh) object.castShadow = true; });
      this.staticRoot.add(root);
      this.collisions.addBox(`lamp-${x}`, new Vector3(x, 1.9, 0.3), new Vector3(0.3, 3.8, 0.3), false);
    }

    const benchMaterial = new MeshStandardMaterial({ color: 0xa36a42, roughness: 0.9 });
    for (const x of [-7, 7]) {
      const bench = new Group();
      for (const z of [-0.22, 0, 0.22]) {
        const slat = new Mesh(new RoundedBoxGeometry(2.2, 0.1, 0.16, 2, 0.04), benchMaterial);
        slat.position.set(0, 0.62, z);
        bench.add(slat);
      }
      bench.position.set(x, 0, 16.2);
      bench.rotation.y = Math.PI;
      bench.traverse((object) => { if (object instanceof Mesh) object.castShadow = true; });
      this.staticRoot.add(bench);
      this.collisions.addBox(`bench-${x}`, new Vector3(x, 0.55, 16.2), new Vector3(2.35, 1.1, 0.7), false);
    }
  }

  private addTrees(): void {
    const trunkGeometry = new CylinderGeometry(0.13, 0.18, 1.7, 8);
    const crownGeometry = new ConeGeometry(1.05, 2.7, 9);
    const trunks = new InstancedMesh(trunkGeometry, new MeshStandardMaterial({ color: 0x795338, roughness: 1 }), 8);
    const crowns = new InstancedMesh(crownGeometry, new MeshStandardMaterial({ color: palette.green, roughness: 1 }), 8);
    const matrix = new Matrix4();
    const positions = [
      [-16, 2.5], [-6, 2.7], [5, 2.5], [16, 2.6], [-17, 18], [-15.5, 14], [15.5, 17], [17, 13],
    ];
    positions.forEach(([x, z], index) => {
      matrix.makeTranslation(x, 0.85, z);
      trunks.setMatrixAt(index, matrix);
      matrix.makeTranslation(x, 2.75, z);
      crowns.setMatrixAt(index, matrix);
      this.collisions.addBox(`tree-${index}`, new Vector3(x, 1.2, z), new Vector3(0.48, 2.4, 0.48), false);
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    this.staticRoot.add(trunks, crowns);
  }

  private addDistantSilhouette(): void {
    const colors = [0x557989, 0x426678, 0x64828c];
    const blocks = [
      [-34, -38, 12, 16, 9], [-18, -40, 16, 23, 10], [0, -41, 13, 18, 8],
      [17, -40, 15, 26, 9], [35, -38, 12, 17, 8], [-38, 26, 15, 13, 10], [37, 25, 17, 16, 12],
    ];
    blocks.forEach(([x, z, width, height, depth], index) => {
      const building = new Mesh(
        new RoundedBoxGeometry(width, height, depth, 3, 0.35),
        new MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.96 }),
      );
      building.position.set(x, height / 2, z);
      building.receiveShadow = true;
      this.staticRoot.add(building);
    });
  }

  private addColliderForMesh(mesh: Mesh, parentOffset: Vector3, size: Vector3): void {
    const center = mesh.position.clone().add(parentOffset);
    this.collisions.addBox(`static-${this.colliderIndex++}`, center, size);
    this.cameraObstacles.push(mesh);
  }

  private surface(width: number, depth: number, material: MeshStandardMaterial): Mesh {
    const mesh = new Mesh(new PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  }

  private makeSign(label: string, width: number, height: number, color: number): Group {
    const group = new Group();
    const background = new Mesh(
      new RoundedBoxGeometry(width, height, 0.12, 3, 0.08),
      new MeshStandardMaterial({ color, roughness: 0.68 }),
    );
    group.add(background);

    const lineShape = new Shape();
    lineShape.moveTo(-width * 0.32, -0.045);
    lineShape.lineTo(width * 0.32, -0.045);
    lineShape.lineTo(width * 0.32, 0.045);
    lineShape.lineTo(-width * 0.32, 0.045);
    const line = new Mesh(new ShapeGeometry(lineShape) as BufferGeometry, new MeshStandardMaterial({ color: palette.navy }));
    line.position.z = 0.071;
    group.add(line);
    group.userData.label = label;
    return group;
  }
}
