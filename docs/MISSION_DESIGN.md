# Mission design

The ten missions are defined by the supplied design brief. Missions 1–5 are
implemented. Phase 4 starts the city story only after Mission 1 succeeds and
persists its progress separately from the warehouse mission.

Phase 2 starts with Mission 1, **الهروب من المستودع**, as the only vertical slice. Its required ordered state is:

1. Search the closed warehouse.
2. Discover the power panel.
3. Activate three breakers in the correct sequence.
4. Start the generator.
5. Open the synchronized physical door.
6. Walk outside.
7. Reach the garage.
8. Complete the mission once, and only once.

The runtime stores sequential objectives as data and rejects out-of-order
completion. The three breakers are one sequence objective with independent
sub-progress; a wrong breaker resets that sub-progress. Generator and door
objectives advance from completed world animations, not from the initial button
press. Completion is possible only inside the garage while occupying the car.

Progress is stored in guarded browser local storage. Resume rebuilds the world
devices for the saved objective, and Reset clears the mission, generator, door,
vehicle, markers, and player checkpoint.

## Phase 4 story missions

1. **Mission 2 — الدراجة المسروقة:** talk to Mohammed's friend, follow three
   tracks, question two witnesses, inspect the shop camera, follow an alley
   route, recover the bicycle, and return it to unlock it.
2. **Mission 3 — سباق الشوارع:** meet the garage owner, enter the sport car,
   finish a training route, and complete three ordered timed races to unlock it.
3. **Mission 4 — المنزل المهجور:** collect the old key, enter through the side
   door, solve the sun/wave/star sequence, open the hidden room, and take the
   first map fragment.
4. **Mission 5 — الكراج السري:** collect three parts across the districts,
   install them in order, start and test the classic car, then inspect the
   hidden drawer clue to finish Phase 4 and unlock the car.

`StoryMissionRuntime` rejects skipped targets, resets an incorrect sequence,
stores completed mission and vehicle reward IDs, and resumes the exact current
objective. Timed race expiry resets only the active checkpoint sequence.
