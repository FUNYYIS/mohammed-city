# Phase 1 — iPhone input and ground rendering fix

Date: 2026-07-17

Status: **code and desktop production checks passed; physical iPhone Safari acceptance is still pending**.

## Confirmed input root causes

1. `pointerdown` on the joystick overwrote `joystickPointer` without rejecting a second pointer. A second finger could therefore steal ownership and make subsequent movement appear reversed or intermittent.
2. Buttons stored only booleans, not a dedicated pointer owner per action. Their release path could not prove that the releasing pointer was the one that pressed the button.
3. `lostpointercapture` was not handled for the joystick, camera, or buttons.
4. Touch state was not reset on `orientationchange`, `visibilitychange`, `pagehide`, or the complete `blur` path.
5. A document-level `touchmove.preventDefault()` mixed Touch Events into a Pointer Events controller and affected the whole page.

## Input changes

- Added one explicit pointer state machine with separate ownership for joystick, camera, jump, run, and crouch.
- A second pointer can no longer replace an active joystick or camera pointer.
- All controls use `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, and `lostpointercapture` only.
- Pointer capture is acquired per control and released defensively for Safari lifecycle changes.
- Joystick coordinates now use `clientX/clientY` and `getBoundingClientRect()` in the same CSS-pixel coordinate space.
- Added a 12% dead zone, radial clamping, and one explicit screen-Y-to-game-Y inversion.
- Camera input rejects targets inside joystick, buttons, or contextual interaction controls.
- `blur`, `visibilitychange`, `orientationchange`, and `pagehide` reset every pressed state immediately.
- Removed the global Touch Event prevention. `touch-action: none` remains limited to the game canvas and interactive touch controls.
- Added `?debugInput=1` overlay for pointer IDs, raw/processed axes, buttons, and active touch count.

## Confirmed ground rendering root cause

The plaza had three large overlapping surfaces:

- world ground at `y = 0`
- plaza at `y = 0.018`
- plaza inset at `y = 0.025`

The plaza/inset separation was only 7 mm in world units while all three planes covered the same pixels. The road also overlaid the world ground. This produced mobile depth competition consistent with the attached iPhone screenshot.

## Ground rendering changes

- Replaced the world-sized ground-under-everything approach with one non-overlapping top-surface layout.
- Road, grass, plaza border, and plaza interior now meet at shared edges but never overlap in area.
- Road markings are the only decal layer and use a dedicated material with `polygonOffset` plus a declared 4 mm paint separation.
- Sidewalks remain real raised curb geometry rather than coplanar planes.
- Camera depth range changed from `0.08–170` to `0.18–140`.
- Directional shadow `normalBias` was added to separate shadow acne from surface depth problems.
- A unit test rejects any future top-surface overlap.

## Verification completed

- `npm run build`: passed.
- Unit tests: 15/15 passed across 4 files.
- Direction mapping: forward/back/left/right passed mathematically.
- Dead zone and radial clamp tests: passed.
- Pointer ownership, multi-pointer separation, release, and full reset tests: passed.
- Surface overlap audit: zero overlapping top surfaces.
- Production build opened through the network address.
- Debug overlay loaded and returned all IDs/buttons/axes to zero.
- Portrait overlay and landscape restoration passed in responsive simulation.
- Ground inspected at multiple camera angles without visible interference.
- Production browser Console errors: 0.

## Not yet verified

The following acceptance items require a physical iPhone Safari run and are not claimed as passed:

- full joystick circles and rapid direction changes on capacitive touch
- simultaneous joystick + run/jump/crouch
- second-finger camera drag while moving
- lifting outside joystick bounds
- Safari background/resume with active touches
- physical orientation change with an active pointer
- ground stability while walking for an extended period on the iPhone GPU

Phase 2 remains blocked until these physical-device checks pass.

## Modified files

- `src/controls/InputManager.ts`
- `src/controls/PointerInputState.ts`
- `src/ui/GameUI.ts`
- `src/styles.css`
- `src/app/GameApp.ts`
- `src/world/TestWorld.ts`
- `src/world/SurfaceLayout.ts`
- `src/camera/ThirdPersonCamera.ts`
- `tests/unit/InputManager.test.ts`
- `tests/unit/SurfaceLayout.test.ts`
- `docs/IOS_TEST_CHECKLIST.md`
