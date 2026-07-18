import { describe, expect, it } from 'vitest';
import { PHASE_FOUR_MISSIONS } from '../../src/missions/definitions/phaseFourMissions';
import type { MissionStorage } from '../../src/missions/runtime/MissionRuntime';
import { StoryMissionRuntime } from '../../src/missions/runtime/StoryMissionRuntime';

class MemoryStorage implements MissionStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function completeCurrentObjective(runtime: StoryMissionRuntime): void {
  const objective = runtime.getCurrentObjective();
  if (!objective) return;
  const events = objective.sequence
    ? [...objective.sequence]
    : [objective.targetId ?? objective.requiredVehicleId!];
  events.forEach((event) => runtime.applyEvent(event));
}

describe('StoryMissionRuntime', () => {
  it('starts at Mission 2 and rejects objective skipping', () => {
    const runtime = new StoryMissionRuntime(PHASE_FOUR_MISSIONS);
    runtime.start();

    expect(runtime.getCurrentMission()?.number).toBe(2);
    expect(runtime.getCurrentObjective()?.id).toBe('friend-report');
    expect(runtime.applyEvent('recover-bicycle').status).toBe('rejected');
  });

  it('resets an incorrect interaction sequence without advancing', () => {
    const runtime = new StoryMissionRuntime(PHASE_FOUR_MISSIONS);
    runtime.start();
    while (runtime.getCurrentObjective()?.id !== 'symbol-puzzle') completeCurrentObjective(runtime);

    expect(runtime.applyEvent('symbol-sun').status).toBe('progress');
    expect(runtime.applyEvent('symbol-star').status).toBe('sequence-reset');
    expect(runtime.getProgress().sequenceIndex).toBe(0);
    expect(runtime.getCurrentObjective()?.id).toBe('symbol-puzzle');
  });

  it('completes Missions 2–5 in order and unlocks all three reward vehicles', () => {
    const runtime = new StoryMissionRuntime(PHASE_FOUR_MISSIONS);
    runtime.start();
    while (!runtime.getProgress().completed) completeCurrentObjective(runtime);

    expect(runtime.getProgress().completedMissionIds).toEqual([
      'stolen-bicycle', 'street-races', 'abandoned-house', 'secret-garage',
    ]);
    expect(runtime.getProgress().unlockedVehicleIds).toEqual([
      'bicycle', 'sport-car', 'classic-car',
    ]);
    expect(runtime.getCurrentMission()).toBeNull();
  });

  it('restores the active story objective and vehicle rewards after reload', () => {
    const storage = new MemoryStorage();
    const runtime = new StoryMissionRuntime(PHASE_FOUR_MISSIONS, storage);
    runtime.start();
    while (runtime.getCurrentMission()?.id === 'stolen-bicycle') completeCurrentObjective(runtime);
    completeCurrentObjective(runtime);

    const restored = new StoryMissionRuntime(PHASE_FOUR_MISSIONS, storage);
    expect(restored.getCurrentMission()?.id).toBe('street-races');
    expect(restored.getCurrentObjective()?.id).toBe('enter-sport-car');
    expect(restored.hasUnlockedVehicle('bicycle')).toBe(true);
  });
});
