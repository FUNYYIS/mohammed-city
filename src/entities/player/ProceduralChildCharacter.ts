import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Path,
  QuadraticBezierCurve3,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type {
  CharacterPoseInput,
  CharacterPoseName,
  CharacterRenderMetrics,
  CharacterVisual,
} from './CharacterVisual';

interface RingProfile {
  y: number;
  radiusX: number;
  radiusZ: number;
}

interface ArmRig {
  upper: Group;
  elbow: Group;
}

interface LegRig {
  upper: Group;
  knee: Group;
  ankle: Group;
  baseY: number;
}

const skinMaterial = new MeshStandardMaterial({ color: 0xb96f49, roughness: 0.82 });
const hairMaterial = new MeshStandardMaterial({ color: 0x101116, roughness: 0.9, side: DoubleSide });
const thobeMaterial = new MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.84 });
const thobeDetailMaterial = new MeshStandardMaterial({
  color: 0xe7e4dc,
  roughness: 0.78,
  side: DoubleSide,
});
const shoeMaterial = new MeshStandardMaterial({ color: 0x20242a, roughness: 0.68 });
const soleMaterial = new MeshStandardMaterial({ color: 0x0f1114, roughness: 0.82 });
const eyeWhiteMaterial = new MeshStandardMaterial({ color: 0xf8f5e9, roughness: 0.55 });
const irisMaterial = new MeshStandardMaterial({ color: 0x33271f, roughness: 0.52 });
const pupilMaterial = new MeshStandardMaterial({ color: 0x101216, roughness: 0.42 });
const glassesMaterial = new MeshStandardMaterial({
  color: 0x4b5d60,
  roughness: 0.38,
  metalness: 0.05,
  transparent: true,
  opacity: 0.9,
});
const lensMaterial = new MeshStandardMaterial({
  color: 0xaed1d6,
  transparent: true,
  opacity: 0.18,
  roughness: 0.18,
  depthWrite: false,
});
const eyebrowMaterial = new MeshStandardMaterial({ color: 0x211b19, roughness: 0.88 });
const mouthMaterial = new MeshStandardMaterial({ color: 0x6b2d2a, roughness: 0.7 });
const teethMaterial = new MeshStandardMaterial({ color: 0xfffbef, roughness: 0.52 });
const buttonMaterial = new MeshStandardMaterial({ color: 0xb9b8b2, roughness: 0.55, metalness: 0.18 });

const tempMatrix = new Matrix4();

function createProfileGeometry(rings: RingProfile[], segments = 14): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const ring of rings) {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      positions.push(
        Math.cos(angle) * ring.radiusX,
        ring.y,
        Math.sin(angle) * ring.radiusZ,
      );
    }
  }

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + segment;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, b, b, c, d);
    }
  }

  const bottomCenter = positions.length / 3;
  positions.push(0, rings[0].y, 0);
  const topCenter = positions.length / 3;
  positions.push(0, rings.at(-1)!.y, 0);
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(bottomCenter, next, segment);
    const topOffset = (rings.length - 1) * segments;
    indices.push(topCenter, topOffset + segment, topOffset + next);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createLimbGeometry(length: number, topRadius: number, bottomRadius: number, depthScale = 0.9): BufferGeometry {
  return createProfileGeometry([
    { y: 0, radiusX: topRadius, radiusZ: topRadius * depthScale },
    { y: -length * 0.48, radiusX: MathUtils.lerp(topRadius, bottomRadius, 0.48), radiusZ: MathUtils.lerp(topRadius, bottomRadius, 0.48) * depthScale },
    { y: -length, radiusX: bottomRadius, radiusZ: bottomRadius * depthScale },
  ], 12);
}

function createChildHeadGeometry(): BufferGeometry {
  const longitudeSegments = 18;
  const latitudeSegments = 12;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let latitude = 0; latitude <= latitudeSegments; latitude += 1) {
    const v = latitude / latitudeSegments;
    const phi = v * Math.PI;
    const normalizedY = Math.cos(phi);
    const cheek = Math.exp(-Math.pow((normalizedY + 0.08) / 0.42, 2)) * 0.17;
    const jawTaper = normalizedY < -0.35 ? 1 - (-normalizedY - 0.35) * 0.2 : 1;
    for (let longitude = 0; longitude <= longitudeSegments; longitude += 1) {
      const theta = (longitude / longitudeSegments) * Math.PI * 2;
      const radial = Math.sin(phi);
      const frontWeight = Math.max(0, -Math.sin(theta));
      const radiusX = 0.198 * (1 + cheek) * jawTaper;
      const radiusZ = 0.178 * (1 + cheek * 0.45);
      positions.push(
        Math.cos(theta) * radial * radiusX,
        normalizedY * 0.215,
        Math.sin(theta) * radial * radiusZ - frontWeight * radial * 0.009,
      );
    }
  }

  for (let latitude = 0; latitude < latitudeSegments; latitude += 1) {
    for (let longitude = 0; longitude < longitudeSegments; longitude += 1) {
      const a = latitude * (longitudeSegments + 1) + longitude;
      const b = a + longitudeSegments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createHairShellGeometry(): BufferGeometry {
  const longitudeSegments = 18;
  const latitudeSegments = 7;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let latitude = 0; latitude <= latitudeSegments; latitude += 1) {
    const t = latitude / latitudeSegments;
    for (let longitude = 0; longitude <= longitudeSegments; longitude += 1) {
      const theta = (longitude / longitudeSegments) * Math.PI * 2;
      const front = Math.max(0, -Math.sin(theta));
      const sideTexture = Math.sin(theta * 5) * 0.025;
      const bottomPhi = 1.56 - front * 0.42 + sideTexture;
      const phi = t * bottomPhi;
      const crownTexture = Math.sin(theta * 4 + t * 3) * 0.004 * t;
      positions.push(
        Math.cos(theta) * Math.sin(phi) * (0.201 + crownTexture),
        Math.cos(phi) * (0.224 + crownTexture),
        Math.sin(theta) * Math.sin(phi) * (0.187 + crownTexture),
      );
    }
  }
  for (let latitude = 0; latitude < latitudeSegments; latitude += 1) {
    for (let longitude = 0; longitude < longitudeSegments; longitude += 1) {
      const a = latitude * (longitudeSegments + 1) + longitude;
      const b = a + longitudeSegments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createHairTuftGeometry(width: number, height: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    -width / 2, 0, 0,
    width / 2, 0, 0,
    0, -height, -0.008,
    0, -height * 0.22, 0.026,
  ]), 3));
  geometry.setIndex([0, 2, 1, 0, 3, 2, 1, 2, 3, 0, 1, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function transformed(
  source: BufferGeometry,
  position = new Vector3(),
  scale = new Vector3(1, 1, 1),
  rotation = new Vector3(),
): BufferGeometry {
  const geometry = source.clone();
  geometry.scale(scale.x, scale.y, scale.z);
  geometry.rotateX(rotation.x);
  geometry.rotateY(rotation.y);
  geometry.rotateZ(rotation.z);
  geometry.translate(position.x, position.y, position.z);
  return geometry;
}

function mergeGeometrySet(geometries: BufferGeometry[]): BufferGeometry {
  const normalized = geometries.map((source) => {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    for (const attribute of Object.keys(geometry.attributes)) {
      if (attribute !== 'position' && attribute !== 'normal') geometry.deleteAttribute(attribute);
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    return geometry;
  });
  const merged = mergeGeometries(normalized, false);
  for (const geometry of normalized) geometry.dispose();
  if (!merged) throw new Error('Failed to merge procedural character geometry');
  return merged;
}

function roundedRectangle(target: Shape | Path, centerX: number, centerY: number, width: number, height: number, radius: number, clockwise = false): void {
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const bottom = centerY - height / 2;
  const top = centerY + height / 2;
  if (!clockwise) {
    target.moveTo(left + radius, bottom);
    target.lineTo(right - radius, bottom);
    target.quadraticCurveTo(right, bottom, right, bottom + radius);
    target.lineTo(right, top - radius);
    target.quadraticCurveTo(right, top, right - radius, top);
    target.lineTo(left + radius, top);
    target.quadraticCurveTo(left, top, left, top - radius);
    target.lineTo(left, bottom + radius);
    target.quadraticCurveTo(left, bottom, left + radius, bottom);
  } else {
    target.moveTo(left + radius, bottom);
    target.lineTo(left, bottom + radius);
    target.lineTo(left, top - radius);
    target.quadraticCurveTo(left, top, left + radius, top);
    target.lineTo(right - radius, top);
    target.quadraticCurveTo(right, top, right, top - radius);
    target.lineTo(right, bottom + radius);
    target.quadraticCurveTo(right, bottom, right - radius, bottom);
    target.lineTo(left + radius, bottom);
  }
}

function createGlassesFrameShape(centerX: number): Shape {
  const shape = new Shape();
  roundedRectangle(shape, centerX, 0.15, 0.17, 0.106, 0.034);
  const hole = new Path();
  roundedRectangle(hole, centerX, 0.15, 0.13, 0.074, 0.023, true);
  shape.holes.push(hole);
  return shape;
}

function createLensShape(centerX: number): Shape {
  const shape = new Shape();
  roundedRectangle(shape, centerX, 0.15, 0.132, 0.072, 0.022);
  return shape;
}

function makeMesh(name: string, geometry: BufferGeometry, material: MeshStandardMaterial): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function dampRotation(group: Group, axis: 'x' | 'y' | 'z', target: number, delta: number, rate = 14): void {
  group.rotation[axis] = MathUtils.damp(group.rotation[axis], target, rate, delta);
}

export class ProceduralChildCharacter implements CharacterVisual {
  readonly root = new Group();
  private readonly rigRoot = new Group();
  private readonly upperBody = new Group();
  private readonly garment = new Group();
  private readonly head = new Group();
  private readonly leftArm: ArmRig;
  private readonly rightArm: ArmRig;
  private readonly leftLeg: LegRig;
  private readonly rightLeg: LegRig;
  private elapsed = 0;
  private speedBlend = 0;
  private crouchBlend = 0;
  private landingCompression = 0;
  private poseName: CharacterPoseName = 'idle';

  constructor() {
    this.root.name = 'procedural-child-character';
    this.rigRoot.name = 'child-humanoid-rig';
    this.upperBody.name = 'upper-body-rig';
    this.garment.name = 'white-thobe';
    this.head.name = 'head-rig';
    this.root.add(this.rigRoot);
    this.rigRoot.add(this.upperBody);
    this.upperBody.add(this.garment, this.head);

    this.buildThobe();
    this.buildHead();
    this.leftArm = this.buildArm(-1);
    this.rightArm = this.buildArm(1);
    this.leftLeg = this.buildLeg(-1);
    this.rightLeg = this.buildLeg(1);
  }

  update(input: CharacterPoseInput): void {
    const delta = Math.min(input.delta, 1 / 20);
    this.speedBlend = MathUtils.damp(this.speedBlend, MathUtils.clamp(input.speedRatio, 0, 1), 10, delta);
    this.crouchBlend = MathUtils.damp(this.crouchBlend, input.crouching ? 1 : 0, 16, delta);
    if (input.justLanded) this.landingCompression = 1;
    else this.landingCompression = Math.max(0, this.landingCompression - delta * 6.5);

    if (input.crouching) this.poseName = 'crouch';
    else if (!input.grounded) this.poseName = input.verticalVelocity >= -0.2 ? 'jump' : 'fall';
    else if (this.speedBlend > 0.72) this.poseName = 'run';
    else if (this.speedBlend > 0.06) this.poseName = 'walk';
    else this.poseName = 'idle';

    const runBlend = MathUtils.smoothstep(this.speedBlend, 0.62, 1);
    const movementCycle = 4.2 + this.speedBlend * 7.6;
    this.elapsed += delta * (this.poseName === 'idle' ? 1.7 : movementCycle);
    const gait = Math.sin(this.elapsed);
    const movementBob = input.grounded && !input.crouching
      ? Math.abs(Math.sin(this.elapsed * 2)) * this.speedBlend * (0.012 + runBlend * 0.008)
      : 0;
    const idleBreath = this.poseName === 'idle' ? Math.sin(this.elapsed * 1.25) * 0.004 : 0;
    this.rigRoot.position.y = MathUtils.damp(
      this.rigRoot.position.y,
      movementBob + idleBreath - this.crouchBlend * 0.425 - this.landingCompression * 0.035,
      16,
      delta,
    );

    let leftLegX = gait * this.speedBlend * (0.46 + runBlend * 0.23);
    let rightLegX = -leftLegX;
    let leftKneeX = -Math.max(0, -gait) * this.speedBlend * (0.16 + runBlend * 0.48);
    let rightKneeX = -Math.max(0, gait) * this.speedBlend * (0.16 + runBlend * 0.48);
    let leftAnkleX = 0;
    let rightAnkleX = 0;
    let leftArmX = -gait * this.speedBlend * (0.5 + runBlend * 0.28);
    let rightArmX = -leftArmX;
    let elbowX = -0.08 - runBlend * 0.38 * this.speedBlend;
    let upperBodyX = -runBlend * 0.055;

    if (this.poseName === 'jump') {
      leftLegX = 0.2;
      rightLegX = -0.12;
      leftKneeX = -0.5;
      rightKneeX = -0.28;
      leftAnkleX = 0.28;
      rightAnkleX = 0.18;
      leftArmX = 0.58;
      rightArmX = 0.58;
      elbowX = -0.34;
      upperBodyX = -0.035;
    } else if (this.poseName === 'fall') {
      leftLegX = 0.08;
      rightLegX = -0.08;
      leftKneeX = -0.24;
      rightKneeX = -0.24;
      leftAnkleX = 0.12;
      rightAnkleX = 0.12;
      leftArmX = 0.34;
      rightArmX = 0.34;
      elbowX = -0.18;
      upperBodyX = 0.02;
    }

    leftLegX = MathUtils.lerp(leftLegX, 1.05, this.crouchBlend);
    rightLegX = MathUtils.lerp(rightLegX, 1.05, this.crouchBlend);
    leftKneeX = MathUtils.lerp(leftKneeX, -2.05, this.crouchBlend);
    rightKneeX = MathUtils.lerp(rightKneeX, -2.05, this.crouchBlend);
    leftAnkleX = MathUtils.lerp(leftAnkleX, 1, this.crouchBlend);
    rightAnkleX = MathUtils.lerp(rightAnkleX, 1, this.crouchBlend);
    leftArmX = MathUtils.lerp(leftArmX, 0.28, this.crouchBlend);
    rightArmX = MathUtils.lerp(rightArmX, 0.28, this.crouchBlend);
    elbowX = MathUtils.lerp(elbowX, -0.55, this.crouchBlend);
    upperBodyX = MathUtils.lerp(upperBodyX, -0.12, this.crouchBlend);

    const landingKnee = this.landingCompression * 0.22;
    leftKneeX -= landingKnee;
    rightKneeX -= landingKnee;
    this.leftLeg.upper.position.y = this.leftLeg.baseY + this.crouchBlend * 0.155;
    this.rightLeg.upper.position.y = this.rightLeg.baseY + this.crouchBlend * 0.155;

    dampRotation(this.leftLeg.upper, 'x', leftLegX, delta);
    dampRotation(this.rightLeg.upper, 'x', rightLegX, delta);
    dampRotation(this.leftLeg.knee, 'x', leftKneeX, delta);
    dampRotation(this.rightLeg.knee, 'x', rightKneeX, delta);
    dampRotation(this.leftLeg.ankle, 'x', leftAnkleX, delta);
    dampRotation(this.rightLeg.ankle, 'x', rightAnkleX, delta);
    dampRotation(this.leftArm.upper, 'x', leftArmX, delta);
    dampRotation(this.rightArm.upper, 'x', rightArmX, delta);
    dampRotation(this.leftArm.elbow, 'x', elbowX, delta);
    dampRotation(this.rightArm.elbow, 'x', elbowX, delta);
    dampRotation(this.upperBody, 'x', upperBodyX, delta);
    dampRotation(this.garment, 'x', input.grounded ? gait * this.speedBlend * 0.018 : 0, delta, 10);
    dampRotation(this.head, 'x', this.crouchBlend * 0.1 - upperBodyX * 0.35, delta, 9);
    dampRotation(this.head, 'z', this.poseName === 'idle' ? Math.sin(this.elapsed * 0.72) * 0.018 : 0, delta, 7);
    dampRotation(this.leftArm.upper, 'z', -0.055, delta, 9);
    dampRotation(this.rightArm.upper, 'z', 0.055, delta, 9);
  }

  getPoseName(): CharacterPoseName {
    return this.poseName;
  }

  getRenderMetrics(): CharacterRenderMetrics {
    let drawCalls = 0;
    let triangles = 0;
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      drawCalls += 1;
      const triangleCount = object.geometry.index
        ? object.geometry.index.count / 3
        : object.geometry.getAttribute('position').count / 3;
      triangles += triangleCount * (object instanceof InstancedMesh ? object.count : 1);
    });
    return { drawCalls, triangles };
  }

  private buildThobe(): void {
    const body = makeMesh('tailored-white-thobe-body', createProfileGeometry([
      { y: 0.43, radiusX: 0.305, radiusZ: 0.16 },
      { y: 0.58, radiusX: 0.29, radiusZ: 0.155 },
      { y: 1.03, radiusX: 0.26, radiusZ: 0.145 },
      { y: 1.3, radiusX: 0.31, radiusZ: 0.16 },
      { y: 1.4, radiusX: 0.29, radiusZ: 0.145 },
      { y: 1.44, radiusX: 0.17, radiusZ: 0.105 },
    ], 18), thobeMaterial);
    this.garment.add(body);

    const standingCollar = createProfileGeometry([
      { y: 1.395, radiusX: 0.135, radiusZ: 0.105 },
      { y: 1.455, radiusX: 0.108, radiusZ: 0.09 },
    ], 14);
    const placket = transformed(
      createLimbGeometry(0.34, 0.012, 0.009, 0.55),
      new Vector3(0, 1.31, -0.169),
    );
    const frontSeam = transformed(
      createLimbGeometry(0.5, 0.006, 0.005, 0.5),
      new Vector3(0, 0.98, -0.164),
    );
    const pocket = new BufferGeometry();
    pocket.setAttribute('position', new BufferAttribute(new Float32Array([
      -0.205, 1.19, -0.153,
      -0.09, 1.19, -0.165,
      -0.085, 1.11, -0.169,
      -0.2, 1.11, -0.157,
    ]), 3));
    pocket.setIndex([0, 1, 2, 0, 2, 3]);
    pocket.computeVertexNormals();
    this.garment.add(makeMesh(
      'thobe-collar-placket-pocket-and-seam',
      mergeGeometrySet([standingCollar, placket, frontSeam, pocket]),
      thobeDetailMaterial,
    ));

    const buttonGeometry = new SphereGeometry(0.013, 7, 5);
    const buttons = new InstancedMesh(buttonGeometry, buttonMaterial, 4);
    buttons.name = 'thobe-buttons';
    for (let index = 0; index < 4; index += 1) {
      tempMatrix.makeTranslation(0, 1.25 - index * 0.085, -0.176);
      buttons.setMatrixAt(index, tempMatrix);
    }
    buttons.instanceMatrix.needsUpdate = true;
    buttons.castShadow = true;
    this.garment.add(buttons);
  }

  private buildHead(): void {
    this.head.position.y = 1.48;
    const headGeometry = transformed(createChildHeadGeometry(), new Vector3(0, 0.14, 0));
    const ear = new SphereGeometry(0.065, 10, 8);
    const nose = new SphereGeometry(0.032, 10, 7);
    const skinGeometry = mergeGeometrySet([
      headGeometry,
      transformed(ear, new Vector3(-0.212, 0.13, 0), new Vector3(0.55, 1, 0.48)),
      transformed(ear, new Vector3(0.212, 0.13, 0), new Vector3(0.55, 1, 0.48)),
      transformed(nose, new Vector3(0, 0.09, -0.205), new Vector3(0.78, 1.05, 0.86)),
    ]);
    this.head.add(makeMesh('sculpted-child-face', skinGeometry, skinMaterial));

    const hairTuft = createHairTuftGeometry(0.07, 0.046);
    const crownTuft = createHairTuftGeometry(0.058, 0.032);
    const hairGeometry = mergeGeometrySet([
      transformed(createHairShellGeometry(), new Vector3(0, 0.155, 0)),
      transformed(hairTuft, new Vector3(-0.12, 0.28, -0.172), new Vector3(1, 1, 1), new Vector3(0, 0, -0.22)),
      transformed(hairTuft, new Vector3(-0.06, 0.292, -0.18), new Vector3(1.05, 1, 1), new Vector3(0, 0, -0.1)),
      transformed(hairTuft, new Vector3(0, 0.3, -0.183), new Vector3(1.08, 1.05, 1)),
      transformed(hairTuft, new Vector3(0.06, 0.292, -0.18), new Vector3(1.05, 1, 1), new Vector3(0, 0, 0.1)),
      transformed(hairTuft, new Vector3(0.12, 0.28, -0.172), new Vector3(1, 1, 1), new Vector3(0, 0, 0.22)),
      transformed(crownTuft, new Vector3(-0.105, 0.353, -0.04), new Vector3(0.88, 0.9, 1), new Vector3(0, 0, Math.PI - 0.28)),
      transformed(crownTuft, new Vector3(-0.018, 0.361, -0.052), new Vector3(1.08, 1.06, 1), new Vector3(0, 0, Math.PI - 0.05)),
      transformed(crownTuft, new Vector3(0.083, 0.35, -0.043), new Vector3(0.96, 0.82, 1), new Vector3(0, 0, Math.PI + 0.2)),
    ]);
    const hair = makeMesh('layered-black-hair', hairGeometry, hairMaterial);
    this.head.add(hair);

    const eye = new SphereGeometry(0.023, 10, 7);
    const iris = new SphereGeometry(0.0125, 9, 6);
    const pupil = new SphereGeometry(0.0065, 8, 5);
    const eyePositions = [-0.083, 0.083];
    this.head.add(
      makeMesh('eye-whites', mergeGeometrySet(eyePositions.map((x) => transformed(
        eye,
        new Vector3(x, 0.145, -0.177),
        new Vector3(1.15, 0.82, 0.38),
      ))), eyeWhiteMaterial),
      makeMesh('brown-irises', mergeGeometrySet(eyePositions.map((x) => transformed(
        iris,
        new Vector3(x, 0.145, -0.196),
        new Vector3(1, 1, 0.42),
      ))), irisMaterial),
      makeMesh('pupils', mergeGeometrySet(eyePositions.map((x) => transformed(
        pupil,
        new Vector3(x, 0.145, -0.204),
        new Vector3(1, 1, 0.42),
      ))), pupilMaterial),
    );

    const brow = createLimbGeometry(0.072, 0.009, 0.007, 0.55);
    this.head.add(makeMesh('soft-eyebrows', mergeGeometrySet([
      transformed(brow, new Vector3(-0.115, 0.225, -0.188), new Vector3(1, 1, 1), new Vector3(0, 0, -1.42)),
      transformed(brow, new Vector3(0.115, 0.225, -0.188), new Vector3(1, 1, 1), new Vector3(0, 0, 1.42)),
    ]), eyebrowMaterial));

    const frameGeometry = new ExtrudeGeometry([
      createGlassesFrameShape(-0.09),
      createGlassesFrameShape(0.09),
    ], { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 1, steps: 1 });
    frameGeometry.translate(0, 0, -0.226);
    const bridge = transformed(
      createLimbGeometry(0.035, 0.007, 0.007, 0.8),
      new Vector3(-0.0175, 0.15, -0.219),
      new Vector3(1, 1, 1),
      new Vector3(0, 0, Math.PI / 2),
    );
    const temple = createLimbGeometry(0.16, 0.006, 0.005, 0.8);
    const frames = mergeGeometrySet([
      frameGeometry,
      bridge,
      transformed(temple, new Vector3(-0.174, 0.15, -0.214), new Vector3(1, 1, 1), new Vector3(-Math.PI / 2, 0, 0)),
      transformed(temple, new Vector3(0.174, 0.15, -0.214), new Vector3(1, 1, 1), new Vector3(-Math.PI / 2, 0, 0)),
    ]);
    this.head.add(makeMesh('clear-grey-glasses-frame', frames, glassesMaterial));

    const lenses = new ShapeGeometry([createLensShape(-0.09), createLensShape(0.09)]);
    lenses.translate(0, 0, -0.229);
    const lensMesh = makeMesh('subtle-glasses-lenses', lenses, lensMaterial);
    lensMesh.castShadow = false;
    lensMesh.receiveShadow = false;
    this.head.add(lensMesh);

    const smileCurve = new QuadraticBezierCurve3(
      new Vector3(-0.07, 0.058, -0.205),
      new Vector3(0, 0.012, -0.212),
      new Vector3(0.07, 0.058, -0.205),
    );
    const mouthCavity = transformed(
      new SphereGeometry(0.045, 10, 6),
      new Vector3(0, 0.052, -0.195),
      new Vector3(1.55, 0.72, 0.27),
    );
    this.head.add(makeMesh(
      'smile',
      mergeGeometrySet([new TubeGeometry(smileCurve, 12, 0.008, 5, false), mouthCavity]),
      mouthMaterial,
    ));
    const teeth = transformed(
      new SphereGeometry(0.04, 10, 6),
      new Vector3(0, 0.064, -0.209),
      new Vector3(0.92, 0.18, 0.14),
    );
    this.head.add(makeMesh('smile-teeth', teeth, teethMaterial));

    const neck = makeMesh('neck', createProfileGeometry([
      { y: 1.405, radiusX: 0.085, radiusZ: 0.075 },
      { y: 1.5, radiusX: 0.095, radiusZ: 0.082 },
    ], 12), skinMaterial);
    this.upperBody.add(neck);
  }

  private buildArm(side: -1 | 1): ArmRig {
    const upper = new Group();
    const elbow = new Group();
    upper.name = side < 0 ? 'left-upper-arm' : 'right-upper-arm';
    elbow.name = side < 0 ? 'left-elbow' : 'right-elbow';
    upper.position.set(side * 0.315, 1.34, 0);
    elbow.position.y = -0.225;
    upper.add(makeMesh('upper-thobe-sleeve', createLimbGeometry(0.235, 0.085, 0.072), thobeMaterial), elbow);
    elbow.add(makeMesh('lower-thobe-sleeve', createLimbGeometry(0.22, 0.074, 0.061), thobeMaterial));

    const handBody = createProfileGeometry([
      { y: -0.205, radiusX: 0.058, radiusZ: 0.05 },
      { y: -0.275, radiusX: 0.069, radiusZ: 0.055 },
      { y: -0.345, radiusX: 0.045, radiusZ: 0.04 },
    ], 11);
    const thumb = new SphereGeometry(0.038, 8, 6);
    const handGeometry = mergeGeometrySet([
      handBody,
      transformed(thumb, new Vector3(side * 0.055, -0.27, -0.005), new Vector3(0.7, 1.05, 0.72)),
    ]);
    elbow.add(makeMesh('child-hand', handGeometry, skinMaterial));
    this.upperBody.add(upper);
    return { upper, elbow };
  }

  private buildLeg(side: -1 | 1): LegRig {
    const upper = new Group();
    const knee = new Group();
    const ankle = new Group();
    const baseY = 0.64;
    upper.name = side < 0 ? 'left-upper-leg' : 'right-upper-leg';
    knee.name = side < 0 ? 'left-knee' : 'right-knee';
    ankle.name = side < 0 ? 'left-ankle' : 'right-ankle';
    upper.position.set(side * 0.125, baseY, 0);
    knee.position.y = -0.285;
    ankle.position.y = -0.285;
    upper.add(makeMesh('upper-white-trouser-leg', createLimbGeometry(0.295, 0.102, 0.088, 0.86), thobeDetailMaterial), knee);
    knee.add(makeMesh('lower-white-trouser-leg', createLimbGeometry(0.295, 0.09, 0.074, 0.84), thobeDetailMaterial), ankle);

    const shoeBody = transformed(
      new SphereGeometry(0.11, 12, 8),
      new Vector3(0, -0.018, -0.055),
      new Vector3(0.94, 0.46, 1.5),
    );
    const sole = createProfileGeometry([
      { y: -0.058, radiusX: 0.105, radiusZ: 0.165 },
      { y: -0.076, radiusX: 0.108, radiusZ: 0.17 },
    ], 12);
    sole.translate(0, 0, -0.055);
    ankle.add(
      makeMesh('rounded-black-shoe', shoeBody, shoeMaterial),
      makeMesh('black-shoe-sole', sole, soleMaterial),
    );
    this.rigRoot.add(upper);
    return { upper, knee, ankle, baseY };
  }
}
