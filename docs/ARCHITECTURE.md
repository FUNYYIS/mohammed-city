# Architecture

## Current scope

Phase 1 establishes a direct Three.js runtime with no gameplay framework layered above it. `GameApp` owns lifecycle and rendering, while player motion, visual representation, camera, input, collision, world construction, and UI remain separate modules.

## Boundaries

- `controls/`: normalizes keyboard, pointer, and multi-touch controls into one snapshot.
- `entities/player/`: controller state is independent of the temporary visual character.
- `physics/`: deterministic capsule-versus-static-box movement and anti-tunneling substeps.
- `camera/`: third-person orbit, smoothing, pitch limits, and obstacle shortening.
- `world/`: phase-one test environment only. Future zone content must not be placed in `GameApp`.
- `ui/`: menus, HUD, touch controls, pause, and orientation state.

## Character replacement contract

The future file `public/assets/characters/mohammed/mohammed.glb` will be loaded through a `CharacterAssetAdapter`. The controller must continue to expose position, yaw, speed ratio, grounded, and crouch state; animation names and bones will be mapped in the adapter rather than in the controller.

## Next architecture gate

Phase 2 may add interaction, doors, mission runtime, audio, and one vehicle only after Phase 1 passes on physical iPhone Safari. No old project was used as a reference.
