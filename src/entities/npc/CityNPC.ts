import {
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const nextPosition = new Vector3();

export interface CityNPCStyle {
  clothing: number;
  accent: number;
  skin?: number;
}

export class CityNPC {
  readonly root = new Group();
  private readonly leftArm = new Group();
  private readonly rightArm = new Group();
  private readonly leftLeg = new Group();
  private readonly rightLeg = new Group();
  private elapsed = 0;
  private waypointIndex = 0;

  constructor(
    readonly id: string,
    readonly displayName: string,
    private readonly waypoints: readonly Vector3[],
    style: CityNPCStyle,
  ) {
    this.root.name = `npc-${id}`;
    this.root.position.copy(waypoints[0]);
    this.buildVisual(style);
  }

  update(delta: number, playerPosition: Vector3): void {
    this.elapsed += delta;
    const target = this.waypoints[this.waypointIndex];
    nextPosition.copy(target).sub(this.root.position);
    nextPosition.y = 0;
    const distance = nextPosition.length();
    const nearPlayer = this.root.position.distanceToSquared(playerPosition) < 16;

    if (distance < 0.18) {
      this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
    } else {
      nextPosition.normalize();
      const speed = nearPlayer ? 0 : 0.72;
      this.root.position.addScaledVector(nextPosition, Math.min(distance, speed * delta));
      if (!nearPlayer) {
        const yaw = Math.atan2(nextPosition.x, nextPosition.z);
        this.root.rotation.y = MathUtils.damp(this.root.rotation.y, yaw, 8, delta);
      }
    }

    if (nearPlayer) {
      const lookX = playerPosition.x - this.root.position.x;
      const lookZ = playerPosition.z - this.root.position.z;
      const yaw = Math.atan2(lookX, lookZ);
      this.root.rotation.y = MathUtils.damp(this.root.rotation.y, yaw, 7, delta);
    }

    const walking = !nearPlayer && distance >= 0.18;
    const swing = walking ? Math.sin(this.elapsed * 7.5) * 0.42 : Math.sin(this.elapsed * 1.8) * 0.035;
    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing * 0.8;
    this.rightLeg.rotation.x = swing * 0.8;
  }

  private buildVisual(style: CityNPCStyle): void {
    const skin = new MeshStandardMaterial({ color: style.skin ?? 0xb97855, roughness: 0.82 });
    const clothes = new MeshStandardMaterial({ color: style.clothing, roughness: 0.86 });
    const accent = new MeshStandardMaterial({ color: style.accent, roughness: 0.72 });
    const dark = new MeshStandardMaterial({ color: 0x17232b, roughness: 0.88 });

    const torso = new Mesh(new RoundedBoxGeometry(0.62, 0.78, 0.38, 3, 0.12), clothes);
    torso.position.y = 1.12;
    const head = new Mesh(new SphereGeometry(0.28, 12, 8), skin);
    head.scale.set(0.9, 1.05, 0.9);
    head.position.y = 1.72;
    const hair = new Mesh(new SphereGeometry(0.285, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), dark);
    hair.position.y = 1.79;
    const collar = new Mesh(new CylinderGeometry(0.13, 0.2, 0.18, 8), accent);
    collar.position.y = 1.47;
    this.root.add(torso, head, hair, collar);

    this.leftArm.position.set(-0.38, 1.38, 0);
    this.rightArm.position.set(0.38, 1.38, 0);
    const armGeometry = new RoundedBoxGeometry(0.18, 0.7, 0.2, 2, 0.07);
    const leftArmMesh = new Mesh(armGeometry, clothes);
    const rightArmMesh = new Mesh(armGeometry, clothes);
    leftArmMesh.position.y = -0.3;
    rightArmMesh.position.y = -0.3;
    this.leftArm.add(leftArmMesh);
    this.rightArm.add(rightArmMesh);

    this.leftLeg.position.set(-0.17, 0.76, 0);
    this.rightLeg.position.set(0.17, 0.76, 0);
    const legGeometry = new RoundedBoxGeometry(0.22, 0.7, 0.26, 2, 0.07);
    const leftLegMesh = new Mesh(legGeometry, accent);
    const rightLegMesh = new Mesh(legGeometry, accent);
    leftLegMesh.position.y = -0.32;
    rightLegMesh.position.y = -0.32;
    this.leftLeg.add(leftLegMesh);
    this.rightLeg.add(rightLegMesh);
    this.root.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);

    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }
}
