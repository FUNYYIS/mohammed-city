# Architecture

## Current scope

The Phase 2 vertical slice remains a direct Three.js runtime. `GameApp` owns
lifecycle and rendering, while player, vehicle, mission, interaction, camera,
collision, world construction, save, and UI state remain separate modules.

## Boundaries

- `controls/`: normalizes keyboard, pointer, and multi-touch controls into one snapshot.
- `entities/player/`: controller state is independent of the approximate procedural child visual.
- `physics/`: deterministic capsule-versus-static-box movement and anti-tunneling substeps.
- `camera/`: third-person orbit, smoothing, pitch limits, and obstacle shortening.
- `world/`: owns scene geometry, devices, zones, markers, and matching colliders;
  zone content is never placed in `GameApp`.
- `ui/`: menus, HUD, touch controls, pause, and orientation state.
- `interactions/`: distance, facing, priority, and line-of-sight target selection.
- `missions/definitions/`: mission data only; Mission 1 is not hard-coded into the UI.
- `missions/runtime/`: ordered objective state, breaker sequence, director, and success gate.
- `entities/vehicles/`: the one-car driving controller and dynamic collider.
- `save/`: guarded browser persistence adapters.
- `world/MissionOneWorld.ts`: warehouse, street, garage, mission markers, and
  synchronized world devices. Later zones must be split rather than growing
  this file indefinitely.

## Character replacement contract

`PlayerView` accepts the `CharacterVisual` contract and currently hosts `ProceduralChildCharacter`. A future file at `public/assets/characters/mohammed/mohammed.glb` can be loaded through `CharacterAssetAdapter` and a GLB-backed `CharacterVisual` without changing `PlayerController`. Position, yaw, speed ratio, vertical velocity, grounded, and crouch state stay controller-owned; animation names and bones remain adapter-owned.

## Phase 2 runtime flow

`InputManager` emits one normalized snapshot. On foot, `PlayerController` consumes
movement and `InteractionSystem` selects the current target. In a car,
`SimpleVehicleController` consumes the same axes with driving semantics.
`MissionOneDirector` is the only layer allowed to advance Mission 1 and it
delegates persistence to `MissionRuntime`. World animation events advance the
generator and door objectives only after their visual state finishes.

## Next architecture gate

Do not add Missions 2–10 yet. First validate the complete Mission 1 path,
multi-touch interaction buttons, door clearance, driving, exit placement,
background/resume, and sustained performance on physical iPhone Safari.
