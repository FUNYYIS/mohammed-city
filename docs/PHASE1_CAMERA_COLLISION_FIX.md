# Phase 1 camera collision hardening

## Root cause

The third-person camera previously tested only a single ray from the smoothed
player target to the desired camera position. That ray could miss the edge of a
wall or ceiling even while the camera near plane intersected the same geometry.
The final camera position was also interpolated after a hit, which allowed a
brief frame where it could remain behind the obstruction.

## Fix

- Retained exact mesh ray hits for broad surfaces.
- Added a 0.28 m camera collision envelope by expanding the static obstacle
  bounds and ray-testing those bounds. This is a lightweight swept-sphere
  approximation suitable for the Phase 1 web scene.
- Camera distance contracts immediately when blocked, preventing interpolation
  through a wall.
- Camera distance restores with damping after the obstruction clears, avoiding
  a sudden pop.
- Added the resolved distance to the debug HUD and `window.__MC_TEST__` bridge.

## Automated coverage

The camera tests cover:

- a wall directly behind the player;
- a side edge missed by the old center ray;
- an overhead edge missed by the old center ray;
- smooth distance recovery after rotating away from a wall;
- the existing single-source jump follow behavior.

## Device gate

Desktop production and automated browser checks do not replace a physical
iPhone Safari run. Phase 2 stays blocked until the camera is walked around wall
and ceiling edges on the device together with the existing touch, jump, and
ground-rendering checklist.
