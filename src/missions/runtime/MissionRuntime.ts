export interface MissionObjectiveDefinition {
  id: string;
  title: string;
  markerId: string;
  event?: string;
  sequence?: readonly string[];
}

export interface MissionDefinition {
  id: string;
  title: string;
  version: number;
  objectives: readonly MissionObjectiveDefinition[];
}

export interface MissionProgress {
  missionId: string;
  version: number;
  started: boolean;
  completed: boolean;
  objectiveIndex: number;
  sequenceIndex: number;
}

export interface MissionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type MissionEventStatus = 'rejected' | 'progress' | 'advanced' | 'sequence-reset' | 'completed';

export interface MissionEventResult {
  status: MissionEventStatus;
  objective: MissionObjectiveDefinition | null;
  progress: MissionProgress;
}

export class MissionRuntime {
  private progress: MissionProgress;
  private readonly storageKey: string;

  constructor(
    readonly definition: MissionDefinition,
    private readonly storage?: MissionStorage,
  ) {
    this.storageKey = `mohammed-city.${definition.id}.v${definition.version}`;
    this.progress = this.freshProgress();
    this.load();
  }

  hasSavedProgress(): boolean {
    return this.progress.started && !this.progress.completed;
  }

  startNew(): MissionProgress {
    this.progress = this.freshProgress();
    this.progress.started = true;
    this.persist();
    return this.getProgress();
  }

  resume(): MissionProgress {
    if (!this.progress.started) return this.startNew();
    return this.getProgress();
  }

  reset(): MissionProgress {
    this.storage?.removeItem(this.storageKey);
    return this.startNew();
  }

  getCurrentObjective(): MissionObjectiveDefinition | null {
    if (this.progress.completed) return null;
    return this.definition.objectives[this.progress.objectiveIndex] ?? null;
  }

  getProgress(): MissionProgress {
    return { ...this.progress };
  }

  applyEvent(event: string): MissionEventResult {
    const objective = this.getCurrentObjective();
    if (!this.progress.started || this.progress.completed || !objective) {
      return this.result('rejected');
    }

    if (objective.sequence) {
      const expected = objective.sequence[this.progress.sequenceIndex];
      if (event !== expected) {
        if (objective.sequence.includes(event)) {
          this.progress.sequenceIndex = 0;
          this.persist();
          return this.result('sequence-reset');
        }
        return this.result('rejected');
      }

      this.progress.sequenceIndex += 1;
      if (this.progress.sequenceIndex < objective.sequence.length) {
        this.persist();
        return this.result('progress');
      }
      this.progress.sequenceIndex = 0;
      return this.advance();
    }

    if (event !== objective.event) return this.result('rejected');
    return this.advance();
  }

  private advance(): MissionEventResult {
    this.progress.objectiveIndex += 1;
    if (this.progress.objectiveIndex >= this.definition.objectives.length) {
      this.progress.objectiveIndex = this.definition.objectives.length;
      this.progress.completed = true;
      this.persist();
      return this.result('completed');
    }
    this.persist();
    return this.result('advanced');
  }

  private result(status: MissionEventStatus): MissionEventResult {
    return { status, objective: this.getCurrentObjective(), progress: this.getProgress() };
  }

  private freshProgress(): MissionProgress {
    return {
      missionId: this.definition.id,
      version: this.definition.version,
      started: false,
      completed: false,
      objectiveIndex: 0,
      sequenceIndex: 0,
    };
  }

  private load(): void {
    const serialized = this.storage?.getItem(this.storageKey);
    if (!serialized) return;
    try {
      const candidate = JSON.parse(serialized) as Partial<MissionProgress>;
      if (
        candidate.missionId !== this.definition.id
        || candidate.version !== this.definition.version
        || typeof candidate.objectiveIndex !== 'number'
        || typeof candidate.sequenceIndex !== 'number'
      ) return;
      this.progress = {
        ...this.freshProgress(),
        ...candidate,
        objectiveIndex: Math.min(
          Math.max(0, candidate.objectiveIndex),
          this.definition.objectives.length,
        ),
        sequenceIndex: Math.max(0, candidate.sequenceIndex),
      };
    } catch {
      this.storage?.removeItem(this.storageKey);
    }
  }

  private persist(): void {
    this.storage?.setItem(this.storageKey, JSON.stringify(this.progress));
  }
}
