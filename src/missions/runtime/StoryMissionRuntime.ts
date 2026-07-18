import type {
  StoryMissionDefinition,
  StoryObjectiveDefinition,
} from '../definitions/phaseFourMissions';
import type { MissionStorage } from './MissionRuntime';

export interface StoryProgress {
  version: number;
  started: boolean;
  completed: boolean;
  missionIndex: number;
  objectiveIndex: number;
  sequenceIndex: number;
  completedMissionIds: string[];
  unlockedVehicleIds: string[];
}

export type StoryEventStatus = 'rejected' | 'sequence-reset' | 'progress' | 'advanced' | 'mission-completed' | 'story-completed';

export interface StoryEventResult {
  status: StoryEventStatus;
  progress: StoryProgress;
  completedMission: StoryMissionDefinition | null;
  objective: StoryObjectiveDefinition | null;
}

const STORY_VERSION = 1;
const STORAGE_KEY = `mohammed-city.phase-four-story.v${STORY_VERSION}`;

export class StoryMissionRuntime {
  private progress = this.freshProgress();

  constructor(
    readonly missions: readonly StoryMissionDefinition[],
    private readonly storage?: MissionStorage,
  ) {
    this.load();
  }

  start(): StoryProgress {
    if (!this.progress.started) {
      this.progress.started = true;
      this.persist();
    }
    return this.getProgress();
  }

  reset(): StoryProgress {
    this.storage?.removeItem(STORAGE_KEY);
    this.progress = this.freshProgress();
    return this.getProgress();
  }

  getProgress(): StoryProgress {
    return {
      ...this.progress,
      completedMissionIds: [...this.progress.completedMissionIds],
      unlockedVehicleIds: [...this.progress.unlockedVehicleIds],
    };
  }

  getCurrentMission(): StoryMissionDefinition | null {
    if (!this.progress.started || this.progress.completed) return null;
    return this.missions[this.progress.missionIndex] ?? null;
  }

  getCurrentObjective(): StoryObjectiveDefinition | null {
    return this.getCurrentMission()?.objectives[this.progress.objectiveIndex] ?? null;
  }

  getExpectedTargetId(): string | null {
    const objective = this.getCurrentObjective();
    if (!objective) return null;
    return objective.sequence?.[this.progress.sequenceIndex]
      ?? objective.targetId
      ?? objective.requiredVehicleId
      ?? null;
  }

  applyEvent(event: string): StoryEventResult {
    const objective = this.getCurrentObjective();
    if (!objective) return this.result('rejected', null);
    if (event !== this.getExpectedTargetId()) {
      if (objective.sequence?.includes(event)) {
        this.progress.sequenceIndex = 0;
        this.persist();
        return this.result('sequence-reset', null);
      }
      return this.result('rejected', null);
    }

    if (objective.sequence && this.progress.sequenceIndex < objective.sequence.length - 1) {
      this.progress.sequenceIndex += 1;
      this.persist();
      return this.result('progress', null);
    }

    this.progress.sequenceIndex = 0;
    this.progress.objectiveIndex += 1;
    const mission = this.getCurrentMission();
    if (mission && this.progress.objectiveIndex < mission.objectives.length) {
      this.persist();
      return this.result('advanced', null);
    }

    const completedMission = this.missions[this.progress.missionIndex] ?? null;
    if (completedMission) {
      this.progress.completedMissionIds.push(completedMission.id);
      if (completedMission.rewardVehicleId
        && !this.progress.unlockedVehicleIds.includes(completedMission.rewardVehicleId)) {
        this.progress.unlockedVehicleIds.push(completedMission.rewardVehicleId);
      }
    }
    this.progress.missionIndex += 1;
    this.progress.objectiveIndex = 0;
    if (this.progress.missionIndex >= this.missions.length) {
      this.progress.completed = true;
      this.persist();
      return this.result('story-completed', completedMission);
    }
    this.persist();
    return this.result('mission-completed', completedMission);
  }

  resetCurrentSequence(): void {
    if (this.progress.sequenceIndex === 0) return;
    this.progress.sequenceIndex = 0;
    this.persist();
  }

  hasUnlockedVehicle(id: string): boolean {
    return this.progress.unlockedVehicleIds.includes(id);
  }

  private result(status: StoryEventStatus, completedMission: StoryMissionDefinition | null): StoryEventResult {
    return {
      status,
      progress: this.getProgress(),
      completedMission,
      objective: this.getCurrentObjective(),
    };
  }

  private freshProgress(): StoryProgress {
    return {
      version: STORY_VERSION,
      started: false,
      completed: false,
      missionIndex: 0,
      objectiveIndex: 0,
      sequenceIndex: 0,
      completedMissionIds: [],
      unlockedVehicleIds: [],
    };
  }

  private load(): void {
    const serialized = this.storage?.getItem(STORAGE_KEY);
    if (!serialized) return;
    try {
      const candidate = JSON.parse(serialized) as Partial<StoryProgress>;
      if (candidate.version !== STORY_VERSION
        || typeof candidate.missionIndex !== 'number'
        || typeof candidate.objectiveIndex !== 'number'
        || typeof candidate.sequenceIndex !== 'number'
        || !Array.isArray(candidate.completedMissionIds)
        || !Array.isArray(candidate.unlockedVehicleIds)) return;
      this.progress = {
        ...this.freshProgress(),
        ...candidate,
        missionIndex: Math.min(Math.max(0, candidate.missionIndex), this.missions.length),
        objectiveIndex: Math.max(0, candidate.objectiveIndex),
        sequenceIndex: Math.max(0, candidate.sequenceIndex),
        completedMissionIds: candidate.completedMissionIds.filter((id): id is string => typeof id === 'string'),
        unlockedVehicleIds: candidate.unlockedVehicleIds.filter((id): id is string => typeof id === 'string'),
      };
    } catch {
      this.storage?.removeItem(STORAGE_KEY);
    }
  }

  private persist(): void {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.progress));
  }
}
