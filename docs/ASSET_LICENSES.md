# Asset licenses

## Included in the Phase 5 city overhaul (exterior-first pass)

All packs below are Creative Commons Zero (CC0 1.0, public-domain dedication) except the
one CC-BY item noted separately. CC0 requires no attribution, but Kenney's own
request to credit "Kenney" or "www.kenney.nl" is honored here anyway.

| Asset id prefix | Pack | Source | License | Status |
|---|---|---|---|---|
| `building.kenney.a/b/e/h/j/n/skyscraperA/skyscraperC/lowDetailA/awning/overhang` | City Kit (Commercial) 2.1 | https://kenney.nl/assets/city-kit-commercial | CC0 | **Approved, in use** |
| `building.kenney.industrialA/industrialK/industrialR` | City Kit (Industrial) 1.0 | https://kenney.nl/assets/city-kit-industrial | CC0 | **Approved, in use** |
| `vehicle.kenney-car-kit.*` | Car Kit 3.1 | https://kenney.nl/assets/car-kit | CC0 | **Approved, in use** |
| `prop.kenney.streetLamp/streetLampCurved/roadSign` | City Kit (Roads) | https://kenney.nl/assets/city-kit-roads | CC0 | **Approved, in use** |
| `prop.kenney.treeDefault/treeDetailed/treeCone/bush` | Nature Kit 2.1 | https://kenney.nl/assets/nature-kit | CC0 | **Approved, in use** |
| `prop.kenney.crate` | Car Kit 3.1 (`box.glb` debris model, repurposed as a warehouse yard crate) | https://kenney.nl/assets/car-kit | CC0 | **Approved, in use** |
| `npc.kenney-mini-characters.maleA/maleC/femaleA/femaleD` | Mini Characters | https://kenney.nl/assets/mini-characters | CC0 | **Approved, in use** |

Every file above is used exactly as downloaded: no remeshing, no re-export, no
texture edits, no skin-weight changes. Uniform scale-to-target-height and
axis-aligned placement are applied at runtime only (see `src/world/CityProps.ts`),
never by modifying the source `.glb` files.

**Not sourced this phase (documented gap, not silently skipped):** no CC0/CC-BY
bicycle GLB with a reliable direct-download link was found within this pass's
search effort; the bicycle keeps its original procedural visual. A
CC-BY-3.0 "Bicycle" model by Poly (via Google Poly, mirrored on Poly Pizza) was
located and would need "Poly by Google" attribution if used later.

## Included in the character integration

| Asset | Id | Source | License | Status |
|---|---|---|---|---|
| Mohammed boy-in-thobe rigged character + 12 merged animation clips (`public/assets/characters/mohammed/`) | `meshy-mohammed-2026` | Generated with Meshy AI from a project-owned character design | Meshy-generated asset owned by the project owner per Meshy's terms of service | **Approved, in use** |

The merged-animations GLB is the runtime player visual. The character-only GLB
in the same folder is kept as an inspection/fallback reference and is not
loaded by the game.

## Included through Phase 3

No third-party visual or audio assets are included. The approximate child character, environment, icon source, materials, and geometry are project-authored procedural assets. The character is an improved temporary visual and is **not** represented as a final likeness or final art.

The Phase 2 warehouse, road, garage, electrical devices, mission markers, and
car are also project-authored procedural geometry. The car has no third-party
brand, texture, or audio and is a temporary game-ready integration asset.

The Phase 3 house, supermarket, storefronts, district props, doors, and five
limited NPC visuals are also project-authored procedural geometry. They are
lightweight integration art, not final city or character assets.

## Researched but not downloaded

| Pack | Source | License | Status |
|---|---|---|---|
| City Kit (Commercial) | https://kenney.nl/assets/city-kit-commercial | CC0 | Candidate only |
| City Kit (Industrial) | https://kenney.nl/assets/city-kit-industrial | CC0 | Candidate only |
| Car Kit | https://kenney.nl/assets/car-kit | CC0 | Candidate only |
| City Builder Bits | https://kaylousberg.com/game-assets/city-builder-bits | CC0 | Candidate only |

Candidate packs must be visually reviewed as a coherent set before download. Their current low-poly direction may not meet the requested final visual bar.

## Missing final assets

- ~~Final art-directed GLB boy character and authored animation clips.~~ Delivered by the Meshy character above; the procedural child remains only as a load-failure fallback. Still missing: crouch, fall, and neutral seated-idle clips.
- ~~Coherent city exterior kit (buildings, street furniture, trees, vehicles).~~ Delivered this phase by the Kenney packs above for every *exterior* surface. Still procedural/temporary: Mohammed's house and the supermarket's walls/door/interior (enterable, deliberately deferred), the garage tool chest prop, and the bicycle.
- Furnished interiors for any enterable building (house, supermarket, and the still-unbuilt mosque/cafe/library/toy store/bakery/workshop/power station/public park) — no interior furniture kit was integrated this phase.
- Dedicated child, vendor, and cashier NPC models; this phase only restyled the 5 existing adult pedestrians.
- Traffic lights, crosswalks/sidewalk tiles, and parking-space markings — no suitable dedicated CC0 traffic-light model was found this pass.
- A CC0/CC-BY bicycle GLB (see note above).
- Vehicles with interiors and mobile-ready LODs.
- Licensed environmental, UI, footsteps, doors, and engine audio.
- Texture atlas and KTX2 variants.

الأنظمة قابلة للتنفيذ، لكن الجودة البصرية النهائية غير ممكنة بالأصول الحالية، ولن أصف النسخة بأنها احترافية.
