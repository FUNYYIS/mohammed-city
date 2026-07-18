import { describe, expect, it } from 'vitest';
import { MISSION_ONE } from '../../src/missions/definitions/missionOne';
import { MissionRuntime, type MissionStorage } from '../../src/missions/runtime/MissionRuntime';

class MemoryStorage implements MissionStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('MissionRuntime', () => {
  it('rejects objective skipping and premature mission success', () => {
    const runtime = new MissionRuntime(MISSION_ONE);
    runtime.startNew();

    expect(runtime.applyEvent('garage-reached').status).toBe('rejected');
    expect(runtime.getCurrentObjective()?.id).toBe('discover-panel');
    expect(runtime.getProgress().completed).toBe(false);
  });

  it('enforces and resets the breaker sequence', () => {
    const runtime = new MissionRuntime(MISSION_ONE);
    runtime.startNew();
    expect(runtime.applyEvent('panel-discovered').status).toBe('advanced');
    expect(runtime.applyEvent('breaker-blue').status).toBe('progress');
    expect(runtime.getProgress().sequenceIndex).toBe(1);

    expect(runtime.applyEvent('breaker-yellow').status).toBe('sequence-reset');
    expect(runtime.getProgress().sequenceIndex).toBe(0);
    expect(runtime.getCurrentObjective()?.id).toBe('power-sequence');

    expect(runtime.applyEvent('breaker-blue').status).toBe('progress');
    expect(runtime.applyEvent('breaker-red').status).toBe('progress');
    expect(runtime.applyEvent('breaker-yellow').status).toBe('advanced');
    expect(runtime.getCurrentObjective()?.id).toBe('start-generator');
  });

  it('completes exactly once after every ordered objective', () => {
    const runtime = new MissionRuntime(MISSION_ONE);
    runtime.startNew();
    const events = [
      'panel-discovered',
      'breaker-blue', 'breaker-red', 'breaker-yellow',
      'generator-started', 'door-opened', 'warehouse-exited',
      'vehicle-entered', 'garage-reached',
    ];
    events.forEach((event) => runtime.applyEvent(event));

    expect(runtime.getProgress().completed).toBe(true);
    expect(runtime.applyEvent('garage-reached').status).toBe('rejected');
  });

  it('persists progress and reset returns to the first objective', () => {
    const storage = new MemoryStorage();
    const runtime = new MissionRuntime(MISSION_ONE, storage);
    runtime.startNew();
    runtime.applyEvent('panel-discovered');
    runtime.applyEvent('breaker-blue');

    const restored = new MissionRuntime(MISSION_ONE, storage);
    expect(restored.getCurrentObjective()?.id).toBe('power-sequence');
    expect(restored.getProgress().sequenceIndex).toBe(1);

    restored.reset();
    expect(restored.getCurrentObjective()?.id).toBe('discover-panel');
    expect(restored.getProgress().sequenceIndex).toBe(0);
  });

  it('keeps completed progress resumable so the unlocked city survives reload', () => {
    const storage = new MemoryStorage();
    const runtime = new MissionRuntime(MISSION_ONE, storage);
    runtime.startNew();
    [
      'panel-discovered',
      'breaker-blue', 'breaker-red', 'breaker-yellow',
      'generator-started', 'door-opened', 'warehouse-exited',
      'vehicle-entered', 'garage-reached',
    ].forEach((event) => runtime.applyEvent(event));

    const restored = new MissionRuntime(MISSION_ONE, storage);
    expect(restored.hasSavedProgress()).toBe(true);
    expect(restored.getProgress().completed).toBe(true);
  });
});
