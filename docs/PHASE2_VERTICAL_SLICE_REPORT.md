# Phase 2 — Mission 1 vertical slice

Date: 2026-07-18

Status: **desktop production and automated acceptance passed; physical iPhone
Safari acceptance is pending**.

## Playable path

1. Start inside a closed warehouse.
2. Find the electrical panel.
3. Activate blue, red, then yellow breakers. A wrong breaker resets the sequence.
4. Start the generator and wait for its world state to complete.
5. Raise the physical main door; its collider moves with the visible door.
6. Exit to the street.
7. Enter the parked car.
8. Drive through the single street into the garage goal.
9. Show success once only. Reset restores the first objective and every world state.

## Implemented systems

- Data-defined sequential mission runtime with guarded local persistence.
- Distance, facing, priority, and collision line-of-sight interaction selection.
- Dedicated Pointer Events actions for interact and vehicle enter/exit.
- Complete warehouse shell with non-overlapping floor, ceiling, walls, real door
  opening, puzzle devices, lighting, props, and matched colliders.
- Animated generator and roll-up door events.
- One lightweight car with acceleration, reverse, steering, dynamic collision,
  safe exit placement, and a vehicle camera mode.
- Street, curbs, markings, lamps, open garage, mission markers, HUD, prompts,
  completion panel, save/continue, and Reset.

## Acceptance evidence

- `npm run build`: passed.
- Unit tests: 53/53 passed across 11 files.
- Project audit: 21/21 passed.
- Browser E2E: 2/2 passed.
- The second E2E runs the complete ordered mission, drives to the garage, checks
  success, then checks Reset, closed door, stopped generator, and empty vehicle.
- Production browser Console errors: 0 during manual warehouse inspection.
- Warehouse start sample: 81 draw calls, 22,888 triangles, 1 texture.
- A dedicated layout test rejects coplanar area overlap between the warehouse,
  street, garage, and grass surfaces.
- Screenshots: `artifacts/screenshots/phase2-warehouse.png` and
  `artifacts/screenshots/phase2-mission-complete.png`.

## Remaining device checks

- Full mission using only capacitive touch on physical iPhone Safari.
- Joystick plus interact/vehicle buttons and second-finger camera control.
- Door clearance and camera collision from all indoor angles.
- Driving, reverse, steering, safe vehicle exit, rotation, and background/resume.
- Sustained frame rate, thermals, memory, PWA update, and offline resume.

The systems are functional, but the current procedural warehouse, car, and
character are temporary integration art. They are not described as final or
professional visual assets.
