# Phase 3 — Core city

Date: 2026-07-18

Status: **desktop production and automated acceptance passed; physical iPhone
Safari acceptance is pending**.

## Playable result

- Mission 1 remains the required opening and is unchanged in order.
- Its success screen now offers `ادخل المدينة` instead of starting a fake
  Mission 2.
- Free roam opens four readable districts: Mohammed neighborhood, commercial
  street, warehouse district, and garage district.
- Mohammed home and the supermarket add two new complete shells with visible
  floors, roofs, wall openings, interactive doors, synchronized door
  colliders, logical interior props, and indoor camera distance. The existing
  warehouse and garage remain accessible, giving four enterable buildings.
- Five lightweight NPCs are distributed across streamed zones. Only nearby
  zone NPCs update.
- The Mission 1 car remains usable in free roam.

## Streaming and ground integrity

- The zone state machine implements `unloaded`, `preloading`, `readyHidden`,
  `active`, `cooling`, and `unloading` with preload distance and hysteresis.
- Hidden zones disable their static and door colliders. Unloaded zones remove
  colliders, camera obstacles, geometry, and materials before later rebuild.
- The camera refreshes collision bounds when streamed obstacles change.
- The expanded city uses one authoritative top surface at each X/Z coordinate.
  The commercial intersection is cut into the base layout, not placed as a
  coplanar road above grass. Road markings alone use polygon offset.

## Acceptance evidence

- `npm run build`: passed.
- Unit tests: 59/59 passed across 13 files.
- Project audit: 21/21 passed.
- Browser E2E: 2/2 passed.
- The long E2E completes Mission 1, enters free roam, opens Mohammed home,
  walks through its doorway, opens the supermarket, walks through its doorway,
  checks the interior/NPC state, reloads directly into the unlocked city, and
  then resets cleanly.
- Production browser errors are checked during both E2E paths.
- Screenshots:
  `artifacts/screenshots/phase3-city-intersection.png`,
  `artifacts/screenshots/phase3-mohammed-home.png`,
  `artifacts/screenshots/phase3-supermarket.png`, and
  `artifacts/screenshots/phase3-supermarket-interior.png`.

## Not included yet

- Mission 2, dialogue, map, activities, additional vehicles, and larger save
  schema belong to Phase 4.
- Physical iPhone Safari touch, thermal, memory, PWA update, and sustained FPS
  still require a real-device pass.
- The current city, interiors, and NPCs are temporary procedural integration
  art. They are not final professional assets.

الأنظمة قابلة للتنفيذ، لكن الجودة البصرية النهائية غير ممكنة بالأصول الحالية، ولن أصف النسخة بأنها احترافية.
