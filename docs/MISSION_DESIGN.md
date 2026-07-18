# Mission design

The ten missions are defined by the supplied design brief. Only Mission 1 is
implemented. Phase 3 opens the core city as free roam after Mission 1; it does
not claim that Mission 2 has started.

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
