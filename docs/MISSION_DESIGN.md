# Mission design

The ten missions are defined by the supplied design brief. They are intentionally not implemented in Phase 1.

Phase 2 starts with Mission 1, **الهروب من المستودع**, as the only vertical slice. Its required ordered state is:

1. Search the closed warehouse.
2. Discover the power panel.
3. Activate three breakers in the correct sequence.
4. Start the generator.
5. Open the synchronized physical door.
6. Walk outside.
7. Reach the garage.
8. Complete the mission once, and only once.

The runtime must store sequential objectives as data and reject out-of-order completion. Phase 1 contains no fake mission-success path.
