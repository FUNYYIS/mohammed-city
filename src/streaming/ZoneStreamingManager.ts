import { Group, Material, Mesh, Object3D, Vector3 } from 'three';
import type { InteractableDefinition } from '../interactions/InteractionSystem';
import { CollisionWorld } from '../physics/CollisionWorld';

export type ZoneStreamingState =
  | 'unloaded'
  | 'preloading'
  | 'readyHidden'
  | 'active'
  | 'cooling'
  | 'unloading';

export interface StreamedZoneContent {
  root: Group;
  colliderIds: readonly string[];
  cameraObstacles: readonly Object3D[];
  interactables?: readonly InteractableDefinition[];
  update?: (delta: number, playerPosition: Vector3) => void;
  interact?: (id: string) => string | null;
  setActive?: (active: boolean) => void;
  getActiveNPCCount?: () => number;
  dispose?: () => void;
}

export interface StreamedZoneDefinition {
  id: string;
  label: string;
  center: Vector3;
  preloadRadius: number;
  activeRadius: number;
  build: () => StreamedZoneContent;
}

export interface ZoneTransition {
  id: string;
  label: string;
  from: ZoneStreamingState;
  to: ZoneStreamingState;
}

interface ZoneRuntime {
  definition: StreamedZoneDefinition;
  state: ZoneStreamingState;
  content: StreamedZoneContent | null;
  coolingElapsed: number;
}

const HIDE_DELAY_SECONDS = 1.25;
const ACTIVE_HYSTERESIS = 8;
const UNLOAD_HYSTERESIS = 12;

export class ZoneStreamingManager {
  private readonly zones: ZoneRuntime[];

  constructor(
    definitions: readonly StreamedZoneDefinition[],
    private readonly sceneRoot: Group,
    private readonly collisions: CollisionWorld,
    private readonly cameraObstacles: Object3D[],
  ) {
    this.zones = definitions.map((definition) => ({
      definition,
      state: 'unloaded',
      content: null,
      coolingElapsed: 0,
    }));
  }

  update(delta: number, position: Vector3, playerPosition = position): ZoneTransition[] {
    const transitions: ZoneTransition[] = [];
    for (const zone of this.zones) {
      const distance = horizontalDistance(position, zone.definition.center);

      if (zone.state === 'unloaded' && distance <= zone.definition.preloadRadius) {
        this.transition(zone, 'preloading', transitions);
      } else if (zone.state === 'preloading') {
        this.build(zone);
        this.transition(zone, 'readyHidden', transitions);
      } else if (zone.state === 'readyHidden') {
        if (distance <= zone.definition.activeRadius) {
          this.setContentActive(zone, true);
          this.transition(zone, 'active', transitions);
        } else if (distance > zone.definition.preloadRadius + UNLOAD_HYSTERESIS) {
          this.transition(zone, 'unloading', transitions);
        }
      } else if (zone.state === 'active') {
        if (distance > zone.definition.activeRadius + ACTIVE_HYSTERESIS) {
          zone.coolingElapsed = 0;
          this.transition(zone, 'cooling', transitions);
        }
      } else if (zone.state === 'cooling') {
        if (distance <= zone.definition.activeRadius) {
          zone.coolingElapsed = 0;
          this.transition(zone, 'active', transitions);
        } else {
          zone.coolingElapsed += delta;
          if (zone.coolingElapsed >= HIDE_DELAY_SECONDS) {
            this.setContentActive(zone, false);
            this.transition(zone, 'readyHidden', transitions);
          }
        }
      } else if (zone.state === 'unloading') {
        this.unload(zone);
        this.transition(zone, 'unloaded', transitions);
      }

      if ((zone.state === 'active' || zone.state === 'cooling') && zone.content) {
        zone.content.update?.(delta, playerPosition);
      }
    }
    return transitions;
  }

  getStates(): Readonly<Record<string, ZoneStreamingState>> {
    return Object.fromEntries(this.zones.map((zone) => [zone.definition.id, zone.state]));
  }

  getActiveZoneIds(): string[] {
    return this.zones
      .filter((zone) => zone.state === 'active' || zone.state === 'cooling')
      .map((zone) => zone.definition.id);
  }

  getActiveInteractables(): InteractableDefinition[] {
    return this.zones.flatMap((zone) => (
      zone.state === 'active' || zone.state === 'cooling'
        ? [...(zone.content?.interactables ?? [])]
        : []
    ));
  }

  interact(id: string): string | null {
    for (const zone of this.zones) {
      if (zone.state !== 'active' && zone.state !== 'cooling') continue;
      const message = zone.content?.interact?.(id);
      if (message) return message;
    }
    return null;
  }

  getActiveNPCCount(): number {
    return this.zones.reduce((count, zone) => {
      if (zone.state !== 'active' && zone.state !== 'cooling') return count;
      return count + (zone.content?.getActiveNPCCount?.() ?? 0);
    }, 0);
  }

  private build(zone: ZoneRuntime): void {
    const content = zone.definition.build();
    content.root.name = `streamed-zone-${zone.definition.id}`;
    content.root.visible = false;
    this.sceneRoot.add(content.root);
    content.colliderIds.forEach((id) => this.collisions.setEnabled(id, false));
    content.cameraObstacles.forEach((obstacle) => {
      obstacle.visible = false;
      this.cameraObstacles.push(obstacle);
    });
    content.setActive?.(false);
    zone.content = content;
  }

  private setContentActive(zone: ZoneRuntime, active: boolean): void {
    if (!zone.content) return;
    zone.content.root.visible = active;
    zone.content.colliderIds.forEach((id) => this.collisions.setEnabled(id, active));
    zone.content.cameraObstacles.forEach((obstacle) => { obstacle.visible = active; });
    zone.content.setActive?.(active);
  }

  private unload(zone: ZoneRuntime): void {
    const content = zone.content;
    if (!content) return;
    this.setContentActive(zone, false);
    content.root.removeFromParent();
    this.collisions.removeBoxes(new Set(content.colliderIds));
    content.cameraObstacles.forEach((obstacle) => {
      const index = this.cameraObstacles.indexOf(obstacle);
      if (index >= 0) this.cameraObstacles.splice(index, 1);
    });
    if (content.dispose) content.dispose();
    else disposeObject(content.root);
    zone.content = null;
  }

  private transition(
    zone: ZoneRuntime,
    next: ZoneStreamingState,
    transitions: ZoneTransition[],
  ): void {
    const previous = zone.state;
    zone.state = next;
    transitions.push({
      id: zone.definition.id,
      label: zone.definition.label,
      from: previous,
      to: next,
    });
  }
}

function horizontalDistance(left: Vector3, right: Vector3): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function disposeObject(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material: Material) => material.dispose());
  });
}
