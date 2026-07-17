# iOS Safari test checklist

Status: **not yet tested on a physical iPhone or Safari**.

- [ ] iPhone 13 Pro Max or comparable physical device.
- [ ] Safari first load over HTTPS.
- [ ] Add to Home Screen and standalone launch.
- [ ] Landscape pause/resume and portrait overlay.
- [ ] Safe areas around notch and Home indicator.
- [ ] Multi-touch: joystick + run + camera simultaneously.
- [ ] Jump, crouch, and button pressed states.
- [ ] Audio starts only after user gesture.
- [ ] Page bounce, pinch, context menu, and accidental scroll.
- [ ] Background/resume and screen lock.
- [ ] WebGL context recovery.
- [ ] Offline shell after first successful load.
- [ ] 15-minute thermal/performance run.
- [ ] FPS, 1% low, draw calls, and long tasks recorded.

Desktop browser and responsive viewport checks are simulation only and must not be reported as iPhone Safari testing.

## Input and ground regression gate

- [ ] Forward, backward, left, and right never invert.
- [ ] Full joystick circles are stable.
- [ ] Rapid direction changes do not stall.
- [ ] Run while moving.
- [ ] Jump while moving.
- [ ] Crouch while moving.
- [ ] Camera drag with a second finger while moving.
- [ ] Releasing outside the joystick returns movement to zero.
- [ ] No stuck state after `pointercancel` or lost capture.
- [ ] Rotate the device while controls are pressed; all states return to zero.
- [ ] Background Safari while controls are pressed, then return; all states return to zero.
- [ ] Walk and rotate the camera across the plaza; no floor flicker or broken lines.
- [ ] Repeat the ground test with dynamic shadows enabled and disabled to confirm no shadow artifact.

## Jump and camera regression gate

- [ ] Stationary jump: Mohammed and his shadow visibly separate while the camera follows once.
- [ ] Jump while walking without losing horizontal motion.
- [ ] Jump while running without losing horizontal motion.
- [ ] Jump near a wall without entering or snagging on the collider.
- [ ] Jump under a low ceiling; the capsule stops at the ceiling and falls naturally.
- [ ] Ground detection becomes false during ascent and returns only on landing.
- [ ] Repeated jump presses while airborne do not start another jump.
- [ ] Landing is visible without camera shake or exaggerated vertical movement.
- [ ] Rotate the device during/after a jump and confirm world/root Y return together.
- [ ] Background Safari during/after a jump, return, and confirm no airborne or pressed state remains stuck.
