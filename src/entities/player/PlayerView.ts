import {
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';

const skin = new MeshStandardMaterial({ color: 0xc9855a, roughness: 0.88 });
const hair = new MeshStandardMaterial({ color: 0x1a1718, roughness: 0.95 });
const shirt = new MeshStandardMaterial({ color: 0x1f7784, roughness: 0.74 });
const shirtAccent = new MeshStandardMaterial({ color: 0xf1b45a, roughness: 0.78 });
const trousers = new MeshStandardMaterial({ color: 0x18344b, roughness: 0.86 });
const shoes = new MeshStandardMaterial({ color: 0xf2e7d8, roughness: 0.8 });

export class PlayerView {
  readonly root = new Group();
  private readonly leftArm = new Group();
  private readonly rightArm = new Group();
  private readonly leftLeg = new Group();
  private readonly rightLeg = new Group();
  private elapsed = 0;

  constructor() {
    this.root.name = 'temporary-mohammed-character';
    this.root.scale.setScalar(0.96);

    const torso = new Mesh(new CapsuleGeometry(0.27, 0.42, 5, 10), shirt);
    torso.position.y = 1.16;
    torso.scale.set(1, 1, 0.76);
    this.root.add(torso);

    const stripe = new Mesh(new CylinderGeometry(0.276, 0.276, 0.08, 14), shirtAccent);
    stripe.position.y = 1.2;
    stripe.scale.z = 0.76;
    this.root.add(stripe);

    const neck = new Mesh(new CylinderGeometry(0.1, 0.11, 0.14, 12), skin);
    neck.position.y = 1.51;
    this.root.add(neck);

    const head = new Mesh(new SphereGeometry(0.25, 18, 14), skin);
    head.position.y = 1.72;
    head.scale.set(0.92, 1.08, 0.94);
    this.root.add(head);

    const hairCap = new Mesh(new SphereGeometry(0.255, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.53), hair);
    hairCap.position.y = 1.77;
    hairCap.scale.set(0.93, 0.68, 0.95);
    this.root.add(hairCap);

    this.addFaceDetail();
    this.makeArm(this.leftArm, -0.32);
    this.makeArm(this.rightArm, 0.32);
    this.makeLeg(this.leftLeg, -0.14);
    this.makeLeg(this.rightLeg, 0.14);
    this.root.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  update(delta: number, speedRatio: number, crouching: boolean, grounded: boolean): void {
    this.elapsed += delta * (3.5 + speedRatio * 7);
    const swing = grounded ? Math.sin(this.elapsed) * 0.72 * speedRatio : 0.18;
    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;
    const targetScaleY = crouching ? 0.72 : 0.96;
    this.root.scale.y += (targetScaleY - this.root.scale.y) * Math.min(1, delta * 12);
    this.root.position.y = crouching ? 0.01 : Math.abs(Math.sin(this.elapsed * 2)) * 0.018 * speedRatio;
  }

  private addFaceDetail(): void {
    const eyeMaterial = new MeshStandardMaterial({ color: 0x171b22, roughness: 0.7 });
    for (const x of [-0.085, 0.085]) {
      const eye = new Mesh(new SphereGeometry(0.022, 8, 6), eyeMaterial);
      eye.position.set(x, 1.75, -0.225);
      this.root.add(eye);
    }
  }

  private makeArm(group: Group, x: number): void {
    group.position.set(x, 1.37, 0);
    const sleeve = new Mesh(new CapsuleGeometry(0.075, 0.16, 4, 8), shirt);
    sleeve.position.y = -0.1;
    const hand = new Mesh(new SphereGeometry(0.075, 10, 8), skin);
    hand.position.y = -0.34;
    group.add(sleeve, hand);
    this.root.add(group);
  }

  private makeLeg(group: Group, x: number): void {
    group.position.set(x, 0.88, 0);
    const leg = new Mesh(new CapsuleGeometry(0.09, 0.38, 4, 8), trousers);
    leg.position.y = -0.28;
    const shoe = new Mesh(new CapsuleGeometry(0.09, 0.13, 4, 8), shoes);
    shoe.position.set(0, -0.57, -0.04);
    shoe.rotation.x = Math.PI / 2;
    group.add(leg, shoe);
    this.root.add(group);
  }
}
