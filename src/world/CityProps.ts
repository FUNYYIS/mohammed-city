import { Box3, Object3D, Vector3 } from 'three';
import { cityAssetCache } from '../assets/GlbModelCache';
import { CollisionWorld } from '../physics/CollisionWorld';

export interface PlacedModel {
  object: Object3D;
  colliderId: string | null;
  size: Vector3;
}

export interface PlaceModelOptions {
  id: string;
  position: Vector3;
  /** Must be a multiple of 90 degrees when `collidable` is true; the AABB collider is axis-aligned. */
  yaw?: number;
  /** Uniformly scales the model so its native height becomes this many meters. Ignored if `scale` is set. */
  targetHeight?: number;
  scale?: number;
  /** Registers an axis-aligned box collider sized from the model's own scaled footprint. Default true. */
  collidable?: boolean;
  collisions?: CollisionWorld;
}

const bounds = new Box3();

/**
 * Clones a cached city-content GLB, scales it uniformly to a target
 * real-world height (never stretched to fit a pre-existing box), plants its
 * base at the given position, and -- when collidable -- fits a matching
 * AABB collider to the model's own resulting footprint rather than forcing
 * the model into an old placeholder's dimensions.
 */
export function placeModel(url: string, options: PlaceModelOptions): PlacedModel | null {
  const source = cityAssetCache.clone(url);
  if (!source) return null;
  return finishPlacement(source, options);
}

function finishPlacement(source: Object3D, options: PlaceModelOptions): PlacedModel {
  source.updateMatrixWorld(true);
  bounds.setFromObject(source);
  const nativeHeight = bounds.max.y - bounds.min.y;
  const scale = options.scale
    ?? (options.targetHeight && nativeHeight > 0.001 ? options.targetHeight / nativeHeight : 1);

  const wrapper = new Object3D();
  wrapper.name = options.id;
  wrapper.position.copy(options.position);
  wrapper.rotation.y = options.yaw ?? 0;
  wrapper.scale.setScalar(scale);
  source.position.y -= bounds.min.y;
  wrapper.add(source);

  let footprintX = (bounds.max.x - bounds.min.x) * scale;
  let footprintZ = (bounds.max.z - bounds.min.z) * scale;
  const rotatedQuarterTurn = Math.abs(Math.cos(options.yaw ?? 0)) < 0.5;
  if (rotatedQuarterTurn) [footprintX, footprintZ] = [footprintZ, footprintX];
  const size = new Vector3(footprintX, (bounds.max.y - bounds.min.y) * scale, footprintZ);

  let colliderId: string | null = null;
  if ((options.collidable ?? true) && options.collisions) {
    colliderId = options.id;
    const center = options.position.clone();
    center.y += size.y * 0.5;
    options.collisions.addBox(colliderId, center, size);
  }

  return { object: wrapper, colliderId, size };
}
