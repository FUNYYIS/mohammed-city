import { Group, Mesh, Object3D } from 'three';
import { CITY_MODEL_URLS } from '../assets/AssetRegistry';
import { cityAssetCache } from '../assets/GlbModelCache';

/**
 * Real Downtown City MegaKit sidewalk/curb tiles flanking the approved road
 * network (mission-road-south, commercial-road, and the 4-way intersection
 * built in CityRoads.ts). Roads have no collider of their own -- walkability
 * is governed purely by the player's own y<=0 ground clamp -- and sidewalks
 * follow the exact same convention: every tile is placed with its wrapper at
 * world y=0, matching the road tiles' own placement so the two surfaces line
 * up using the asset pack's own authored heights (sidewalk top flush at
 * y=0, road surface at its native y=-0.15), producing a natural curb rise
 * without any special-cased height logic.
 *
 * Measured native footprints (flat top at y=0, underside at y=-0.15):
 *  - Sidewalk_Straight_3m: 3 x 3
 *  - Sidewalk_Corner_Flat_3m: 3 x 3 (diagonal curb chamfer in one corner).
 *    The pack's Corner_Round_3m variant was tried first, but its curve
 *    sweeps across roughly half the tile and its solid mesh doesn't reach
 *    the two straight edges' full nominal 3m length, leaving a real gap
 *    against neighbouring straight tiles (confirmed by isolating single
 *    tiles and tile pairs in-scene). Corner_Flat's smaller chamfer meets
 *    neighbouring straight tiles with no gap.
 */

const ROAD_WIDTH = 10;
const ROAD_HALF = ROAD_WIDTH / 2;
const SIDEWALK_SIZE = 3;
const SIDEWALK_HALF = SIDEWALK_SIZE / 2;
const SIDEWALK_OFFSET = ROAD_HALF + SIDEWALK_HALF; // 6.5: sidewalk centreline

// Same authoring artifact found on the road tiles: MI_Trim_MetalConcrete
// (used by every sidewalk/curb piece in this kit) carries a per-vertex
// COLOR_0 gradient (R pinned at 1.0, G/B fading toward 0 at some vertices),
// which GLTFLoader auto-applies as a real colour multiply. Left alone this
// tints the sidewalk unevenly reddish on top of its already rust-toned
// BaseColor texture. Cloning the material and disabling vertexColors before
// use neutralises it without touching the source glTF file, matching the
// same fix already applied to the road asphalt.
const SIDEWALK_MATERIAL_NAME = 'MI_Trim_MetalConcrete';

function fixSidewalkVertexColorTint(model: Object3D): void {
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const next = materials.map((m) => {
      if (m.name !== SIDEWALK_MATERIAL_NAME) return m;
      const cloned = m.clone();
      cloned.vertexColors = false;
      cloned.needsUpdate = true;
      return cloned;
    });
    child.material = Array.isArray(child.material) ? next : next[0];
  });
}

function place(url: string, x: number, z: number, yaw: number, scaleX: number, scaleZ: number, root: Group): void {
  const model: Object3D | null = cityAssetCache.clone(url);
  if (!model) {
    console.warn(`[CitySidewalks] "${url}" not cached; leaving this sidewalk tile out`);
    return;
  }
  fixSidewalkVertexColorTint(model);
  const wrapper = new Group();
  wrapper.name = 'production-sidewalk-tile';
  wrapper.position.set(x, 0, z);
  wrapper.rotation.y = yaw;
  const quarterTurn = Math.abs(Math.cos(yaw)) < 0.5;
  wrapper.scale.set(quarterTurn ? scaleZ : scaleX, 1, quarterTurn ? scaleX : scaleZ);
  wrapper.add(model);
  root.add(wrapper);
}

/**
 * Places one straight run of sidewalk tiles along a single axis, anchored
 * flush against `anchorAt` (typically a corner tile's near edge) and
 * extending toward `farEnd`. Uses whole native-size tiles as far as they
 * fit, then one tile stretched to cover the remainder, so the run always
 * reaches exactly to `farEnd` with no gap and no overlap.
 */
function placeStraightRun(
  url: string,
  root: Group,
  axis: 'x' | 'z',
  fixedCoord: number,
  anchorAt: number,
  farEnd: number,
  yaw: number,
): void {
  const length = Math.abs(farEnd - anchorAt);
  const direction = farEnd > anchorAt ? 1 : -1;
  const wholeTiles = Math.floor(length / SIDEWALK_SIZE);
  const remainder = length - wholeTiles * SIDEWALK_SIZE;

  for (let i = 0; i < wholeTiles; i += 1) {
    const coord = anchorAt + direction * (i * SIDEWALK_SIZE + SIDEWALK_HALF);
    if (axis === 'x') place(url, coord, fixedCoord, yaw, 1, 1, root);
    else place(url, fixedCoord, coord, yaw, 1, 1, root);
  }
  if (remainder > 0.01) {
    const coord = anchorAt + direction * (wholeTiles * SIDEWALK_SIZE + remainder / 2);
    const scale = remainder / SIDEWALK_SIZE;
    if (axis === 'x') place(url, coord, fixedCoord, yaw, scale, 1, root);
    else place(url, fixedCoord, coord, yaw, 1, scale, root);
  }
}

export function buildMissionSidewalks(root: Group): void {
  const straight = CITY_MODEL_URLS.sidewalks.straight3m;
  const corner = CITY_MODEL_URLS.sidewalks.cornerFlat3m;
  const noCurb = CITY_MODEL_URLS.sidewalks.noCurb3m;

  // mission-road-south sidewalks: flank x=0 road at x=-6.5/+6.5, spanning
  // z=[4.5,24]. The northern SIDEWALK_SIZE (z=[21,24]) at each side is the
  // corner tile placed further below; the straight run covers z=[4.5,21].
  placeStraightRun(straight, root, 'z', -SIDEWALK_OFFSET, 21, 4.5, 0);
  placeStraightRun(straight, root, 'z', SIDEWALK_OFFSET, 21, 4.5, 0);

  // commercial-road sidewalks: flank z=29 road at z=22.5/35.5, spanning
  // x=[-54,54]. The SIDEWALK_SIZE nearest each corner (x=[-8,-5]/[5,8]) is
  // the corner tile; the straight runs cover the rest on both sides.
  for (const rowZ of [22.5, 35.5]) {
    placeStraightRun(straight, root, 'x', rowZ, -8, -54, Math.PI / 2);
    placeStraightRun(straight, root, 'x', rowZ, 8, 54, Math.PI / 2);
  }

  // Four corner tiles wrapping the intersection, one per quadrant. Each
  // diagonal curb chamfer faces outward, away from the intersection centre,
  // so the sidewalk's inner edges butt flush against the road at x=+-5/z=24
  // and z=+-5-from-29 with no gap and no overlap.
  place(corner, -SIDEWALK_OFFSET, 22.5, -Math.PI / 2, 1, 1, root); // SW
  place(corner, SIDEWALK_OFFSET, 22.5, Math.PI, 1, 1, root); // SE
  place(corner, SIDEWALK_OFFSET, 35.5, Math.PI / 2, 1, 1, root); // NE
  place(corner, -SIDEWALK_OFFSET, 35.5, 0, 1, 1, root); // NW

  // mission-road-north (x=[-5,5], z=[34,38]) is 1m longer than the NE/NW
  // corner tiles reach (they stop at z=37), and garage-floor (a flat plane
  // at y=0) meets the road tile (y=-0.15) at the same z=38 boundary with no
  // connecting curb face -- so at some viewing angles a ray passes under
  // the floor's paper-thin edge and past the road's edge without hitting
  // either, exposing the sky. Confirmed by raycasting: nothing hit at
  // x=[-6,6], z~[37.9,38]. Closed with real sidewalk tiles across the full
  // garage-entrance width, not a code-drawn plane:
  //  - x=[-6,-5] and [5,6] (pedestrian sides, flanking the corner tiles):
  //    Sidewalk_Straight_3m, which carries the same curb profile used
  //    everywhere else the sidewalk meets a road.
  //  - x=[-5,5] (the vehicle/pedestrian path straight into the garage):
  //    Sidewalk_NoCurb_3m, the pack's flush no-step variant, matching a
  //    real driveway apron rather than a pedestrian curb.
  const gapFillScale = 1 / SIDEWALK_SIZE;
  place(straight, 5.5, 37.5, 0, gapFillScale, gapFillScale, root);
  place(straight, -5.5, 37.5, 0, gapFillScale, gapFillScale, root);
  // x=[-5,5] at a compressed 1m depth (scaleZ=1/3): 3 native-width tiles
  // (9m) plus one remainder tile (1m) to reach exactly 10m, same anchored
  // tiling approach used for every other run in this file.
  const depthScale = 1 / SIDEWALK_SIZE;
  place(noCurb, -3.5, 37.5, 0, 1, depthScale, root);
  place(noCurb, -0.5, 37.5, 0, 1, depthScale, root);
  place(noCurb, 2.5, 37.5, 0, 1, depthScale, root);
  place(noCurb, 4.5, 37.5, 0, depthScale, depthScale, root);
}
