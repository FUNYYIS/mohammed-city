# Architecture

## Current scope

The Phase 4 city-adventure build remains a direct Three.js runtime. `GameApp` owns
lifecycle and rendering, while player, vehicle, mission, interaction, camera,
collision, world construction, save, and UI state remain separate modules.

## Boundaries

- `controls/`: normalizes keyboard, pointer, and multi-touch controls into one snapshot.
- `entities/player/`: controller state is independent of the approximate procedural child visual.
- `physics/`: deterministic capsule-versus-static-box movement and anti-tunneling substeps.
- `camera/`: third-person orbit, smoothing, pitch limits, and obstacle shortening.
- `world/`: owns scene geometry, devices, zones, markers, and matching colliders;
  zone content is never placed in `GameApp`.
- `ui/`: menus, HUD, touch controls, dialogue, city map, pause, and orientation state.
- `interactions/`: distance, facing, priority, and line-of-sight target selection.
- `missions/definitions/`: mission data only; Mission 1 is not hard-coded into the UI.
- `missions/runtime/`: Mission 1 and Phase 4 story runtimes, strict ordered state,
  timers, rewards, persistence, directors, and success gates.
- `entities/vehicles/`: reusable compact, sport, bicycle, and classic controllers
  with independent availability and dynamic colliders.
- `entities/doors/`: reusable physical door leaves with synchronized dynamic colliders.
- `entities/npc/`: limited lightweight pedestrians with bounded waypoint updates.
- `streaming/`: zone lifecycle (`unloaded` through `unloading`), hysteresis,
  collision activation, camera-obstacle activation, and resource disposal.
- `save/`: guarded browser persistence adapters.
- `world/MissionOneWorld.ts`: warehouse, street, garage, mission markers, and
  synchronized world devices. Later zones must be split rather than growing
  this file indefinitely.

## Character replacement contract

`PlayerView` accepts the `CharacterVisual` contract. `GameApp` loads the Meshy
merged-animations GLB (URL owned by `AssetRegistry`) into `MohammedGlbCharacter`
and hot-swaps it in before gameplay becomes visible; `ProceduralChildCharacter`
remains only as the load-failure fallback. Position, yaw, speed ratio, vertical
velocity, grounded, and crouch state stay controller-owned; clip names, the
semantic action mapping, root-motion policies, and bones remain adapter/visual-owned.
Gestures flow one way through `PlayerView.playGesture` and never move the player.

## Phase 4 runtime flow

`InputManager` emits one normalized snapshot. On foot, `PlayerController` consumes
movement and `InteractionSystem` selects the current target. In a vehicle,
`SimpleVehicleController` consumes the same axes with driving semantics and a
per-vehicle configuration.
`MissionOneDirector` is the only layer allowed to advance Mission 1 and it
delegates persistence to `MissionRuntime`. World animation events advance the
generator and door objectives only after their visual state finishes.

After Mission 1 succeeds, `GameApp` opens city exploration and starts or resumes
`StoryMissionRuntime`. `StoryMissionDirector` is the single authority for
Missions 2–5: it selects the expected interaction or checkpoint, enforces
ordered sequences and vehicle requirements, resets timed races, grants vehicle
rewards, and asks `StoryWorld` to restore physical progress after a reload.

The always-ready road/floor layout keeps one authoritative coplanar surface per
coordinate. `CityDistricts` streams the warehouse district, Mohammed
neighborhood, commercial street, and garage district based on the current
player or vehicle position. `StoryWorld` owns the old house, puzzle, story
props, route checkpoints, and marker. Streamed doors and static colliders are
enabled only with their visible zone, and the camera rig refreshes its obstacle
cache when a zone loads or unloads.

## Next architecture gate

Do not start Phase 5 until Missions 2–5, the four vehicle configurations, the
map/dialogue overlays, save/resume, touch controls, and sustained performance
have been checked on physical iPhone Safari.
