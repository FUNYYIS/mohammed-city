import { Vector3 } from 'three';
import { InteractionSystem, type InteractableDefinition } from '../../interactions/InteractionSystem';
import type { StoryDialogue, StoryObjectiveDefinition } from '../definitions/phaseFourMissions';
import { StoryWorld } from '../../world/StoryWorld';
import { StoryMissionRuntime, type StoryEventResult, type StoryProgress } from './StoryMissionRuntime';

export interface StoryFeedback {
  changed: boolean;
  message: string | null;
  dialogue: StoryDialogue | null;
  completedMissionTitle: string | null;
  storyCompleted: boolean;
}

const noFeedback: StoryFeedback = {
  changed: false,
  message: null,
  dialogue: null,
  completedMissionTitle: null,
  storyCompleted: false,
};

export class StoryMissionDirector {
  private activeInteraction: InteractableDefinition | null = null;
  private timedObjectiveId: string | null = null;
  private timedElapsed = 0;

  constructor(
    readonly runtime: StoryMissionRuntime,
    private readonly world: StoryWorld,
    private readonly interactions: InteractionSystem,
  ) {}

  startOrResume(): StoryProgress {
    const progress = this.runtime.start();
    this.world.applyProgress(progress);
    this.refreshTarget();
    return progress;
  }

  reset(): StoryProgress {
    const progress = this.runtime.reset();
    this.activeInteraction = null;
    this.timedObjectiveId = null;
    this.timedElapsed = 0;
    this.world.applyProgress(progress);
    this.world.setActiveTarget(null);
    return progress;
  }

  updateInteraction(playerPosition: Vector3, playerYaw: number): InteractableDefinition | null {
    const objective = this.runtime.getCurrentObjective();
    if (!objective || objective.kind !== 'interaction') {
      this.activeInteraction = null;
      return null;
    }
    const candidates = objective.sequence
      ? objective.sequence.map((id) => this.world.interactables[id]).filter(Boolean)
      : [this.world.interactables[objective.targetId ?? '']].filter(Boolean);
    this.activeInteraction = this.interactions.findBest(playerPosition, playerYaw, candidates);
    return this.activeInteraction;
  }

  interact(): StoryFeedback {
    const interaction = this.activeInteraction;
    const objective = this.runtime.getCurrentObjective();
    if (!interaction || !objective || objective.kind !== 'interaction') return noFeedback;
    const result = this.runtime.applyEvent(interaction.id);
    if (result.status === 'rejected') return noFeedback;
    if (result.status === 'sequence-reset') {
      this.world.applyProgress(result.progress);
      this.refreshTarget();
      return { ...noFeedback, changed: true, message: 'الترتيب غلط — ابدأ من أول رمز' };
    }
    return this.fromResult(result, objective.dialogue ?? null, interaction.id);
  }

  updateZones(
    delta: number,
    position: Vector3,
    inVehicle: boolean,
    vehicleId: string | null,
  ): StoryFeedback {
    const objective = this.runtime.getCurrentObjective();
    if (!objective || objective.kind !== 'zone') {
      this.resetTimerFor(objective);
      return noFeedback;
    }

    if (objective.timeLimitSeconds) {
      this.resetTimerFor(objective);
      this.timedElapsed += delta;
      if (this.timedElapsed > objective.timeLimitSeconds) {
        this.runtime.resetCurrentSequence();
        this.timedElapsed = 0;
        this.world.applyProgress(this.runtime.getProgress());
        this.refreshTarget();
        return { ...noFeedback, changed: true, message: 'انتهى الوقت — ارجع لأول نقطة في السباق' };
      }
    } else {
      this.resetTimerFor(null);
    }

    if (objective.onFootOnly && inVehicle) return noFeedback;
    if (objective.requiredVehicleId && vehicleId !== objective.requiredVehicleId) return noFeedback;
    const targetId = this.runtime.getExpectedTargetId();
    const target = this.world.getTargetPosition(targetId);
    if (!target) return noFeedback;
    const distance = Math.hypot(position.x - target.x, position.z - target.z);
    if (distance > (objective.radius ?? 2.7)) return noFeedback;
    return this.fromResult(this.runtime.applyEvent(targetId!), null, targetId!);
  }

  vehicleEntered(vehicleId: string): StoryFeedback {
    const objective = this.runtime.getCurrentObjective();
    if (!objective || objective.kind !== 'vehicle-enter' || objective.requiredVehicleId !== vehicleId) {
      return noFeedback;
    }
    return this.fromResult(this.runtime.applyEvent(vehicleId), null, vehicleId);
  }

  canUseVehicle(vehicleId: string): boolean {
    if (vehicleId === 'mission-car') return true;
    if (this.runtime.hasUnlockedVehicle(vehicleId)) return true;
    const mission = this.runtime.getCurrentMission();
    const objectiveIndex = this.runtime.getProgress().objectiveIndex;
    if (vehicleId === 'bicycle' && mission?.id === 'stolen-bicycle') return objectiveIndex >= 7;
    if (vehicleId === 'sport-car' && mission?.id === 'street-races') return objectiveIndex >= 1;
    if (vehicleId === 'classic-car' && mission?.id === 'secret-garage') return objectiveIndex >= 4;
    return false;
  }

  getObjectiveText(): string {
    const objective = this.runtime.getCurrentObjective();
    if (!objective) return 'اكتملت مهمات المرحلة الرابعة';
    const progress = this.runtime.getProgress();
    const sequence = objective.sequence
      ? ` (${progress.sequenceIndex}/${objective.sequence.length})`
      : '';
    if (!objective.timeLimitSeconds) return `${objective.title}${sequence}`;
    const remaining = Math.max(0, Math.ceil(objective.timeLimitSeconds - this.timedElapsed));
    return `${objective.title}${sequence} — ${remaining}ث`;
  }

  getTargetPosition(): Vector3 | null {
    return this.world.getTargetPosition(this.runtime.getExpectedTargetId());
  }

  private fromResult(
    result: StoryEventResult,
    dialogue: StoryDialogue | null,
    eventId: string,
  ): StoryFeedback {
    if (result.status === 'rejected') return noFeedback;
    this.world.handleInteraction(eventId);
    this.world.applyProgress(result.progress);
    this.timedObjectiveId = null;
    this.timedElapsed = 0;
    this.refreshTarget();
    const completedTitle = result.completedMission?.title ?? null;
    return {
      changed: true,
      message: completedTitle ? `اكتملت: ${completedTitle}` : 'تم تحديث الهدف',
      dialogue,
      completedMissionTitle: completedTitle,
      storyCompleted: result.status === 'story-completed',
    };
  }

  private refreshTarget(): void {
    this.world.setActiveTarget(this.runtime.getExpectedTargetId());
  }

  private resetTimerFor(objective: StoryObjectiveDefinition | null): void {
    const id = objective?.timeLimitSeconds ? objective.id : null;
    if (id === this.timedObjectiveId) return;
    this.timedObjectiveId = id;
    this.timedElapsed = 0;
  }
}
