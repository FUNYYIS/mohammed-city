import { Group, Mesh, Object3D } from 'three';
import { CITY_MODEL_URLS } from '../assets/AssetRegistry';
import { cityAssetCache } from '../assets/GlbModelCache';

/**
 * Real Downtown City MegaKit road tiles replacing the flat colour-only
 * planes for the three 'road' rectangles in MISSION_ONE_TOP_SURFACES:
 * mission-road-south (N/S, x=0, z 4.5..24), commercial-road (E/W, z=29,
 * x -54..54), mission-road-north (N/S, x=0, z 34..38). Roads have never
 * carried their own collider (the capsule ground clamp is unconditional at
 * y=0; only walls/buildings/vehicles/NPCs block movement), so swapping the
 * visual here cannot change where Mohammed can walk.
 *
 * Measured native tile footprints (flat top at y=~0):
 *  - Street_2Lane_noSidewalk: 6 x 6
 *  - Street_4Lane_noSidewalk: 6 x 12
 *  - Street_4WayIntersection: 24.67 x 24.67 (square, symmetric on all 4 arms)
 *
 * Each tile is scaled only on its cross-street axis to reach the existing
 * 10-unit road width (widening a flat asphalt+lane-marking texture across
 * its short axis is the least visually distorting way to fit a modular kit
 * into a footprint it wasn't authored for); the travel-axis keeps its
 * native tile length wherever it divides evenly, so the lane markings are
 * never stretched lengthwise except on the two short, less-visible
 * connector spans noted below.
 */

const ROAD_WIDTH = 10;
const LANE2_NATIVE = 6;
const LANE4_NATIVE_WIDTH = 6;
const LANE4_NATIVE_LENGTH = 12;
const INTERSECTION_NATIVE = 24.67;

// The 4-way intersection tile ships a raised curb/median strip (material
// "MI_Trim_MetalConcrete", geometry y=[-0.15,0]) meant to sit beside a real
// sidewalk. Roads have no collider here, so Mohammed's feet (clamped to
// y=0) walk straight through this raised ridge -- it visually cuts across
// his legs, and its rusty-orange texture is what reads as a red glow.
// Stripped at clone time so the intersection stays a flat, natural surface.
const RAISED_TRIM_MATERIAL_NAME = 'MI_Trim_MetalConcrete';

const ASPHALT_MATERIAL_NAME = 'MI_Asphalt';

function stripMaterial(model: Object3D, materialName: string): void {
  const toRemove: Object3D[] = [];
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    if (materials.some((m) => m.name === materialName)) toRemove.push(child);
  });
  toRemove.forEach((child) => child.removeFromParent());
}

function stripRaisedTrim(model: Object3D): void {
  stripMaterial(model, RAISED_TRIM_MATERIAL_NAME);
}

// MI_Asphalt ships a per-vertex COLOR_0 attribute baked as an uneven
// gradient (R pinned at 1.0 on every vertex, but G/B ranging from 1.0 down to
// as low as 0.0097 at other vertices) -- confirmed by decoding the raw glTF
// buffer. GLTFLoader auto-enables vertexColors whenever COLOR_0 is present,
// so three.js multiplies this red-leaning gradient into the otherwise clean,
// neutral-grey BaseColor texture, producing uneven reddish-brown patches
// across the asphalt. The material is cloned before mutating it, since
// cityAssetCache shares one material instance across every tile clone --
// mutating the shared instance directly would be fine here too (every use of
// MI_Asphalt wants this fix), but cloning keeps this change locally scoped to
// the meshes it actually touches, per the requested pattern.
function fixAsphaltVertexColorTint(model: Object3D): void {
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const next = materials.map((m) => {
      if (m.name !== ASPHALT_MATERIAL_NAME) return m;
      const cloned = m.clone();
      cloned.vertexColors = false;
      cloned.needsUpdate = true;
      return cloned;
    });
    child.material = Array.isArray(child.material) ? next : next[0];
  });
}

// The street-decal mesh (crosswalk stripes, lane lines) ships a per-vertex
// COLOR_0 attribute baked to solid pure red (1,0,0,1) on every vertex --
// confirmed by decoding the raw glTF buffer, this is uniform across all
// tiles and isn't a lighting or texture issue. GLTFLoader auto-enables
// vertexColors whenever COLOR_0 is present, so three.js multiplies this red
// into the otherwise white/gold decal texture, tinting every stripe and its
// alpha-faded border red. The base texture itself is clean, so the fix is to
// stop the loaded material from applying that vertex-colour multiply.
const DECAL_MATERIAL_NAME = 'MI_StreetDecals';

// Every straight tile (2-lane, 4-lane) maps this same decal mesh to just the
// atlas's top sliver (a single stop-line style bar spanning the tile's full
// width) -- fine once, right at a real stop line, but placed on every
// straight tile it repeats every 6-12m as a spurious transverse white line.
// Only the 4-way intersection's decal covers the actual crosswalk artwork in
// the right place, so straight tiles drop this mesh entirely; the intersection
// keeps it.
function stripDecals(model: Object3D): void {
  stripMaterial(model, DECAL_MATERIAL_NAME);
}

// The kept decal mesh (crosswalk + stop-line art on the intersection tile)
// ships as alpha-blended geometry sitting a couple of millimetres above the
// asphalt. Alpha-blended draws are depth-tested but not depth-written, so
// when Mohammed stands on/behind part of the crosswalk, sorting between this
// transparent quad and his opaque body isn't reliable and the white paint can
// draw over him. Converting it to alpha-tested "cutout" transparency makes it
// participate in the normal opaque pass (full depth test + depth write), so
// it is always correctly occluded by (and occludes) solid geometry like the
// player. alphaTest=0.4 sits well below the texture's solid-fill alpha
// (~0.7-0.85, measured directly from the source PNG) and above its
// background/antialiasing noise (<0.3), giving a clean cutout silhouette.
function fixDecalRendering(model: Object3D): void {
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const hasDecalMaterial = materials.some((m) => m.name === DECAL_MATERIAL_NAME);
    if (!hasDecalMaterial) return;
    for (const m of materials) {
      m.vertexColors = false;
      m.transparent = false;
      m.depthTest = true;
      m.depthWrite = true;
      m.alphaTest = 0.4;
      m.needsUpdate = true;
    }
    if (child.geometry.hasAttribute('color')) child.geometry.deleteAttribute('color');
  });
}

function place(
  url: string,
  x: number,
  z: number,
  yaw: number,
  scaleX: number,
  scaleZ: number,
  root: Group,
  keepDecals = true,
  keepAsphalt = true,
): void {
  const model: Object3D | null = cityAssetCache.clone(url);
  if (!model) {
    console.warn(`[CityRoads] "${url}" not cached; leaving this road segment without a tile`);
    return;
  }
  stripRaisedTrim(model);
  if (keepDecals) fixDecalRendering(model);
  else stripDecals(model);
  if (!keepAsphalt) stripMaterial(model, ASPHALT_MATERIAL_NAME);
  else fixAsphaltVertexColorTint(model);
  const wrapper = new Group();
  wrapper.name = 'production-road-tile';
  wrapper.position.set(x, 0, z);
  wrapper.rotation.y = yaw;
  // scaleX/scaleZ are given in world axes; convert to the model's own local
  // axes by undoing the yaw rotation (only 0 or 90-degree yaws are used here).
  const quarterTurn = Math.abs(Math.cos(yaw)) < 0.5;
  wrapper.scale.set(quarterTurn ? scaleZ : scaleX, 1, quarterTurn ? scaleX : scaleZ);
  wrapper.add(model);
  root.add(wrapper);
}

export function buildMissionRoadNetwork(root: Group): void {
  const widthScale = ROAD_WIDTH / LANE2_NATIVE;

  // mission-road-south: N/S run, x=0, native span z=[4.5,24] (19.5 long).
  // Two native 6-long tiles anchored flush against the intersection (z=24)
  // cover z=[12,24]; the remaining 7.5m down to the warehouse plaza is
  // covered by a third tile stretched only on this one segment (scale
  // 7.5/6) so the road reaches z=4.5 with no gap.
  const lastTileLength = 24 - 2 * LANE2_NATIVE - 4.5; // = 7.5
  place(CITY_MODEL_URLS.roads.lane2, 0, 21, 0, widthScale, 1, root, false);
  place(CITY_MODEL_URLS.roads.lane2, 0, 15, 0, widthScale, 1, root, false);
  place(CITY_MODEL_URLS.roads.lane2, 0, 4.5 + lastTileLength / 2, 0, widthScale, lastTileLength / LANE2_NATIVE, root, false);

  // commercial-road: E/W run, z=29, x=[-54,54] (108 long). The 4-lane
  // tile's native 12-length axis divides 108 exactly (9 tiles, no length
  // scaling); only its cross-width axis is scaled to 10. Tile i=4 (centered
  // at x=0) would land exactly on the 4-way intersection's own 10-unit-wide
  // footprint (x=[-5,5]) -- two coincident asphalt planes there were
  // z-fighting and reading as a red flicker -- so it is skipped, and its two
  // immediate neighbours (i=3, i=5) are each stretched by 1 extra unit so
  // they butt flush against the intersection's edges with no gap or overlap.
  const lane4WidthScale = ROAD_WIDTH / LANE4_NATIVE_WIDTH;
  const intersectionHalfWidth = ROAD_WIDTH / 2;
  for (let i = 0; i < 9; i += 1) {
    if (i === 4) continue;
    let length = LANE4_NATIVE_LENGTH;
    let x = -54 + LANE4_NATIVE_LENGTH * i + LANE4_NATIVE_LENGTH / 2;
    if (i === 3) {
      length = LANE4_NATIVE_LENGTH + 1;
      x = -intersectionHalfWidth - length / 2;
    } else if (i === 5) {
      length = LANE4_NATIVE_LENGTH + 1;
      x = intersectionHalfWidth + length / 2;
    }
    place(CITY_MODEL_URLS.roads.lane4, x, 29, Math.PI / 2, length / LANE4_NATIVE_LENGTH, lane4WidthScale, root, false);
  }

  // mission-road-north: short N/S connector to the garage, native span
  // z=[34,38] (only 4m). No native tile is that short, so this one segment
  // is deliberately scaled on both axes to fit exactly -- the shortest,
  // least-visible connector, called out here rather than left undocumented.
  place(CITY_MODEL_URLS.roads.lane2, 0, 36, 0, widthScale, 4 / LANE2_NATIVE, root, false);

  // The intersection tile's own asphalt primitive is a square with its 4
  // true diagonal corners chamfered off (by design, meant for corner
  // sidewalks/curb ramps that aren't part of this build), which left bare
  // grass/shoulder triangles at each corner. Rather than patch those
  // triangles piecemeal (visible seams against the chamfer's diagonal cut),
  // the intersection's own asphalt is dropped entirely and replaced with one
  // continuous, uncut real-asset asphalt slab -- a plain, decal-free clone of
  // the 2-lane tile's own asphalt, scaled up to exactly cover the full
  // 10x10 crossing square. Same asphalt material/texture as every other
  // road surface, one seamless piece, no code-drawn plane/box.
  place(CITY_MODEL_URLS.roads.lane2, 0, 29, 0, ROAD_WIDTH / LANE2_NATIVE, ROAD_WIDTH / LANE2_NATIVE, root, false, true);

  // 4-way intersection decal (crosswalk stripes) at the crossing (x=0,
  // z=29), uniformly scaled down from its native 24.67 square to exactly the
  // 10-unit arm width shared by every road meeting here -- uniform scale
  // keeps it undistorted. Its own chamfered asphalt is stripped (keepAsphalt
  // = false) since the continuous slab above already covers the whole area.
  place(
    CITY_MODEL_URLS.roads.intersection4Way,
    0,
    29,
    0,
    ROAD_WIDTH / INTERSECTION_NATIVE,
    ROAD_WIDTH / INTERSECTION_NATIVE,
    root,
    true,
    false,
  );
}
