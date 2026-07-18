import { Vector3 } from 'three';
import { InteractionSystem, type InteractableDefinition } from '../../interactions/InteractionSystem';
import { MissionOneWorld, type MissionWorldEvent } from '../../world/MissionOneWorld';
import { MissionRuntime, type MissionEventResult, type MissionProgress } from './MissionRuntime';

export interface MissionFeedback {
  changed: boolean;
  completed: boolean;
  message: string | null;
}

const noFeedback: MissionFeedback = { changed: false, completed: false, message: null };

export class MissionOneDirector {
  private activeInteraction: InteractableDefinition | null = null;

  constructor(
    readonly runtime: MissionRuntime,
    private readonly world: MissionOneWorld,
    private readonly interactionSystem: InteractionSystem,
  ) {}

  startNew(): MissionProgress {
    const progress = this.runtime.startNew();
    this.world.reset();
    this.refreshMarker();
    return progress;
  }

  resume(): MissionProgress {
    const progress = this.runtime.resume();
    this.world.applyProgress(progress);
    this.refreshMarker();
    return progress;
  }

  reset(): MissionProgress {
    const progress = this.runtime.reset();
    this.world.reset();
    this.refreshMarker();
    this.activeInteraction = null;
    return progress;
  }

  updateInteraction(playerPosition: Vector3, playerYaw: number): InteractableDefinition | null {
    this.activeInteraction = this.interactionSystem.findBest(
      playerPosition,
      playerYaw,
      this.availableInteractables(),
    );
    return this.activeInteraction;
  }

  interact(): MissionFeedback {
    const interaction = this.activeInteraction;
    const objective = this.runtime.getCurrentObjective();
    if (!interaction || !objective) return noFeedback;

    if (objective.id === 'discover-panel' && interaction.id === 'power-panel') {
      return this.fromResult(this.runtime.applyEvent('panel-discovered'), 'لقيت لوحة الكهرباء');
    }

    if (objective.id === 'power-sequence' && interaction.id.startsWith('breaker-')) {
      const result = this.runtime.applyEvent(interaction.id);
      if (result.status === 'sequence-reset') {
        this.world.setBreakerProgress(0);
        this.refreshMarker();
        return { changed: true, completed: false, message: 'الترتيب غلط — ابدأ بالأزرق من جديد' };
      }
      if (result.status === 'progress') {
        this.world.setBreakerProgress(result.progress.sequenceIndex);
        this.refreshMarker();
        return { changed: true, completed: false, message: 'صح، كمل القاطع اللي بعده' };
      }
      if (result.status === 'advanced') {
        this.world.setBreakerProgress(3);
        return this.fromResult(result, 'اشتغلت القواطع — باقي المولد');
      }
      return noFeedback;
    }

    if (objective.id === 'start-generator' && interaction.id === 'generator') {
      return this.world.startGenerator()
        ? { changed: true, completed: false, message: 'المولد قاعد يشتغل…' }
        : noFeedback;
    }

    if (objective.id === 'open-main-door' && interaction.id === 'door-control') {
      return this.world.requestDoorOpen()
        ? { changed: true, completed: false, message: 'الباب قاعد يرتفع…' }
        : noFeedback;
    }
    return noFeedback;
  }

  handleWorldEvent(event: MissionWorldEvent): MissionFeedback {
    return this.fromResult(this.runtime.applyEvent(event), event === 'generator-started'
      ? 'اشتغل المولد'
      : 'انفتح الباب — اطلع للشارع');
  }

  updateZones(position: Vector3, inVehicle: boolean): MissionFeedback {
    const objective = this.runtime.getCurrentObjective();
    if (!objective) return noFeedback;
    if (objective.id === 'exit-warehouse' && this.world.isOutsideWarehouse(position)) {
      return this.fromResult(this.runtime.applyEvent('warehouse-exited'), 'السيارة قدامك — اركبها');
    }
    if (objective.id === 'reach-garage' && inVehicle && this.world.isInsideGarage(position)) {
      return this.fromResult(this.runtime.applyEvent('garage-reached'), 'وصلت الكراج');
    }
    return noFeedback;
  }

  vehicleEntered(): MissionFeedback {
    if (this.runtime.getCurrentObjective()?.id !== 'enter-car') return noFeedback;
    return this.fromResult(this.runtime.applyEvent('vehicle-entered'), 'قد السيارة إلى الكراج');
  }

  canUseVehicle(): boolean {
    const id = this.runtime.getCurrentObjective()?.id;
    return id === 'enter-car' || id === 'reach-garage';
  }

  getObjectiveText(): string {
    const objective = this.runtime.getCurrentObjective();
    if (!objective) return 'اكتملت المهمة';
    if (!objective.sequence) return objective.title;
    const progress = this.runtime.getProgress();
    return `${objective.title} (${progress.sequenceIndex}/${objective.sequence.length})`;
  }

  getCurrentInteraction(): InteractableDefinition | null {
    return this.activeInteraction;
  }

  private availableInteractables(): InteractableDefinition[] {
    const objective = this.runtime.getCurrentObjective();
    if (!objective) return [];
    if (objective.id === 'discover-panel') return [this.world.interactables['power-panel']];
    if (objective.id === 'power-sequence') {
      return ['breaker-blue', 'breaker-red', 'breaker-yellow'].map((id) => this.world.interactables[id]);
    }
    if (objective.id === 'start-generator' && !this.world.isGeneratorOn()) {
      return [this.world.interactables.generator];
    }
    if (objective.id === 'open-main-door' && !this.world.isDoorOpen()) {
      return [this.world.interactables['door-control']];
    }
    return [];
  }

  private fromResult(result: MissionEventResult, message: string): MissionFeedback {
    if (result.status === 'rejected') return noFeedback;
    this.refreshMarker();
    return {
      changed: true,
      completed: result.status === 'completed',
      message,
    };
  }

  private refreshMarker(): void {
    const objective = this.runtime.getCurrentObjective();
    if (!objective) {
      this.world.setActiveMarker(null);
      return;
    }
    if (objective.sequence) {
      const progress = this.runtime.getProgress();
      this.world.setActiveMarker(objective.sequence[progress.sequenceIndex] ?? objective.markerId);
      return;
    }
    this.world.setActiveMarker(objective.markerId);
  }
}
