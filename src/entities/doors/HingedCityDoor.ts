import {
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { InteractableDefinition } from '../../interactions/InteractionSystem';
import { CollisionWorld } from '../../physics/CollisionWorld';

const doorCenter = new Vector3();
const doorSize = new Vector3();

export class HingedCityDoor {
  readonly root = new Group();
  readonly mesh: Mesh;
  readonly interactable: InteractableDefinition;
  private readonly colliderId: string;
  private open = false;
  private progress = 0;
  private zoneActive = false;

  constructor(
    id: string,
    hingePosition: Vector3,
    private readonly width: number,
    private readonly height: number,
    private readonly depth: number,
    interactionPosition: Vector3,
    private readonly collisions: CollisionWorld,
    color: number,
  ) {
    this.colliderId = `${id}-collider`;
    this.root.name = id;
    this.root.position.copy(hingePosition);
    this.mesh = new Mesh(
      new RoundedBoxGeometry(width, height, depth, 3, 0.08),
      new MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.06 }),
    );
    this.mesh.name = `${id}-leaf`;
    this.mesh.position.set(width * 0.5, 0, 0);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.dynamicCameraObstacle = true;
    this.root.add(this.mesh);
    this.interactable = {
      id,
      label: 'افتح الباب',
      position: interactionPosition.clone(),
      maxDistance: 2.5,
      minFacingDot: -0.15,
      priority: 2,
      lineOfSightIgnore: [this.colliderId],
    };
    this.collisions.addBox(
      this.colliderId,
      new Vector3(hingePosition.x + width * 0.5, hingePosition.y, hingePosition.z),
      new Vector3(width, height, depth),
    );
    this.collisions.setEnabled(this.colliderId, false);
  }

  getColliderId(): string {
    return this.colliderId;
  }

  setZoneActive(active: boolean): void {
    this.zoneActive = active;
    this.syncCollider();
  }

  toggle(): string {
    this.open = !this.open;
    this.interactable.label = this.open ? 'اقفل الباب' : 'افتح الباب';
    return this.open ? 'انفتح الباب' : 'انقفل الباب';
  }

  update(delta: number): void {
    const target = this.open ? -Math.PI * 0.5 : 0;
    this.progress = MathUtils.damp(this.progress, this.open ? 1 : 0, 8, delta);
    this.root.rotation.y = target * this.progress;
    this.root.updateMatrixWorld(true);
    this.syncCollider();
  }

  private syncCollider(): void {
    if (!this.zoneActive) {
      this.collisions.setEnabled(this.colliderId, false);
      return;
    }
    this.mesh.getWorldPosition(doorCenter);
    const angle = this.root.rotation.y;
    doorSize.set(
      Math.abs(Math.cos(angle)) * this.width + Math.abs(Math.sin(angle)) * this.depth,
      this.height,
      Math.abs(Math.sin(angle)) * this.width + Math.abs(Math.cos(angle)) * this.depth,
    );
    this.collisions.updateBox(this.colliderId, doorCenter, doorSize);
    this.collisions.setEnabled(this.colliderId, true);
  }
}
