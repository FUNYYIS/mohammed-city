# Phase 1 report — Foundation

Date: 2026-07-17

## Implemented and verified

- Independent TypeScript + Vite + direct Three.js project.
- WebGL 2 renderer with capped DPR, one shadow light, tone mapping, resize handling, and context-loss handlers.
- PWA manifest, generated versioned service worker, offline shell configuration, 192/512 icons, Apple touch icon, standalone and landscape metadata.
- Start screen, gameplay HUD, pause screen, portrait blocking overlay, safe-area-aware layout, and contextual mobile controls.
- Keyboard and multi-pointer input normalization.
- Independent player controller and temporary boy-shaped procedural visual.
- Smooth walking/running acceleration, crouch, grounded jump, gravity, no double jump, and static capsule collision.
- Third-person orbit camera with pitch limits, smoothing, and wall ray collision.
- A small styled test plaza with visible ground, road, sidewalks, buildings, street furniture, trees, and matching gameplay colliders.
- Asset Registry and Character Asset Adapter contracts for replacing temporary content later.
- Debug-only performance HUD.

## Not implemented

- Warehouse vertical slice and Mission 1.
- Doors, interactions, mission runtime, dialogue, save database, streaming, vehicles, NPCs, map, and audio.
- Final Mohammed model, rig, or requested animation set.
- Final city art, interiors, textures, and licensed sound library.
- WebGPU optional path (WebGL 2 is the active renderer).

## Asset truth

All visual content in Phase 1 is project-authored procedural prototype content. It is replaceable and is not claimed as final art.

الأنظمة قابلة للتنفيذ، لكن الجودة البصرية النهائية غير ممكنة بالأصول الحالية، ولن أصف النسخة بأنها احترافية.

## Tests actually run

- Production build: passed.
- Unit/functional simulation: 7/7 passed across 2 files.
- Project/PWA/static asset audit: 21/21 passed.
- Production browser opened and visually inspected.
- Start button: passed.
- Pause and resume: passed.
- Portrait overlay blocks HUD and controls: passed.
- Return to landscape restores HUD: passed.
- Keyboard jump event: exercised.
- Browser console errors after production interactions: 0.
- HTTP checks: index, manifest, service worker, 192 icon, 512 icon, and Apple icon all returned 200.

## Simulated or not tested

- Portrait/landscape was tested by responsive viewport simulation, not a physical device.
- No physical iPhone or iPad Safari test was run.
- PWA standalone installation and a true offline reload were not tested.
- Touch multi-input was implemented but not tested on physical capacitive hardware.
- Automated browser journey spec exists, but the recorded acceptance evidence for this report comes from the controlled browser session and unit tests.

## Desktop performance sample

Sampled in the local browser after scene stabilization; this is not iPhone evidence.

- FPS: 60
- Estimated 1% low: 53 FPS
- Draw calls: 64
- Triangles: 15,486
- Textures: 1
- Geometries: 71
- Long tasks observed since page load: 1
- Active NPCs: 0
- Active zones: 1 test zone

## Remaining known risks

- Physical Safari memory, thermals, safe areas, multi-touch, PWA installation, and offline behavior remain unknown.
- Camera collision uses a center ray in Phase 1; a wider sphere approximation is required before dense interiors.
- The temporary character has procedural motion, not a humanoid rig or authored clips.
- The test environment proves composition and systems only; it does not satisfy final visual quality.

## Gate decision

The desktop foundation is stable enough for a physical-device Phase 1 check. Phase 2 should **not** begin until the iPhone Safari checklist passes, because the supplied acceptance rules explicitly forbid treating desktop simulation as iPhone evidence.
