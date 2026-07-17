import { Group } from 'three';
import type { CharacterRenderMetrics, CharacterVisual } from './CharacterVisual';
import { ProceduralChildCharacter } from './ProceduralChildCharacter';

/**
 * Stable gameplay-facing wrapper around the active character visual. Replacing
 * the default procedural visual with a GLB-backed CharacterVisual does not
 * require any PlayerController changes.
 */
export class PlayerView {
  readonly root = new Group();
  readonly visualRoot = new Group();
  private readonly character: CharacterVisual;

  constructor(character: CharacterVisual = new ProceduralChildCharacter()) {
    this.character = character;
    this.root.name = 'mohammed-character-anchor';
    this.visualRoot.name = 'mohammed-character-visual-adapter';
    this.visualRoot.scale.setScalar(0.96);
    this.visualRoot.add(character.root);
    this.root.add(this.visualRoot);
  }

  update(
    delta: number,
    speedRatio: number,
    crouching: boolean,
    grounded: boolean,
    justLanded: boolean,
    verticalVelocity: number,
  ): void {
    this.character.update({ delta, speedRatio, crouching, grounded, justLanded, verticalVelocity });
  }

  getPoseName(): string {
    return this.character.getPoseName();
  }

  getRenderMetrics(): CharacterRenderMetrics {
    return this.character.getRenderMetrics();
  }
}
