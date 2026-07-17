# Phase 1 — player jump and third-person camera fix

Date: 2026-07-17

Status: **implementation, unit tests, and desktop production-browser verification passed; physical iPhone Safari acceptance is still pending**.

## Confirmed root cause

`PlayerController` already integrated jump velocity into `player.position.y` and copied that world position into `PlayerView.root`. Immediately afterward, `PlayerView.update()` assigned a walking/crouching bob value directly to `root.position.y`. That second assignment discarded Mohammed's visible world-space jump height every frame.

`ThirdPersonCamera` correctly targeted `player.position`, so the camera followed the real controller height while the visible character root was forced back near ground level. The resulting symptom was exactly a camera-only jump even though the controller and camera target were moving vertically.

## Fix

- `PlayerView.root` is now the world-space character/capsule transform and is never used for animation offsets.
- A child `visualRoot` owns only local bob, crouch scaling, and landing compression.
- The capsule feet position, character world root, and controller position now share the same Y value.
- The camera target derives from `player.position.y + CAMERA_TARGET_HEIGHT` exactly once. No jump offset is added to the camera.
- Horizontal and vertical camera follow rates are separated; vertical follow is intentionally softer so Mohammed remains visibly airborne without camera takeoff or landing jolts.
- Capsule movement now reports ground and ceiling contact.
- Upward motion is clamped against low ceilings and vertical velocity is cleared on ceiling impact.
- Downward motion lands on collider tops, restores grounding, and clears vertical velocity.
- Jump remains gated by `grounded && !crouching`, preventing repeated air jumps.
- The `?debug=1` overlay now shows player Y, world-root Y, local visual Y, camera-target Y, and grounded state every frame.

## Automated coverage

- Character world Y and the world-root Y rise together.
- Visual animation offset remains local and cannot replace world Y.
- A natural jump arc rises, falls under gravity, and lands.
- A second jump is rejected while airborne.
- Walking and running jumps retain horizontal movement.
- Jumping near a wall does not enter the wall collider.
- A low ceiling stops the capsule and the player falls back to ground.
- Camera vertical smoothing follows one player-height source without overshoot or a second jump offset.
- The browser gameplay test asserts that player Y becomes positive, world-root Y matches it, and visual local Y remains small.

## Verification completed

- `npm run build`: passed.
- `npm run test`: 24/24 tests passed across 5 files.
- `npm run audit`: 21/21 checks passed.
- Fresh production build opened from the network URL on a clean port.
- Production-browser airborne sample:
  - player Y: `0.776`
  - world-root Y: `0.776`
  - visual local Y: `0.000`
  - camera target Y: `2.030`
  - grounded: `false`
- Mohammed was visibly above the ground with his shadow separated beneath him.
- After landing, player/root Y returned to `0.000`, camera target returned to `1.280`, and grounded returned to `true`.

## Physical iPhone gate

The desktop production-browser check is not a physical iPhone Safari test. Phase 2 remains blocked until the physical device passes stationary, walking, running, near-wall, low-ceiling, landing, rotation, and Safari background/resume jump checks with Mohammed visibly airborne.

## Modified files

- `src/app/GameApp.ts`
- `src/camera/ThirdPersonCamera.ts`
- `src/entities/player/PlayerController.ts`
- `src/entities/player/PlayerView.ts`
- `src/physics/CollisionWorld.ts`
- `tests/unit/CollisionWorld.test.ts`
- `tests/unit/PlayerController.test.ts`
- `tests/unit/ThirdPersonCamera.test.ts`
- `tests/e2e/gameplay.spec.ts`
- `docs/IOS_TEST_CHECKLIST.md`

