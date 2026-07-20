import { Group, Mesh } from 'three';
import type {
  CharacterGestureName,
  CharacterPoseName,
  CharacterRenderMetrics,
  CharacterVisual,
} from './CharacterVisual';
import { ProceduralChildCharacter } from './ProceduralChildCharacter';

export const PLAYER_VISUAL_WRAPPER_SCALE = 0.96;

/**
 * Stable gameplay-facing wrapper around the active character visual. Replacing
 * the default procedural visual with a GLB-backed CharacterVisual does not
 * require any PlayerController changes.
 */
export class PlayerView {
  readonly root = new Group();
  readonly visualRoot = new Group();
  private character: CharacterVisual;

  constructor(character: CharacterVisual = new ProceduralChildCharacter()) {
    this.character = character;
    this.root.name = 'mohammed-character-anchor';
    this.visualRoot.name = 'mohammed-character-visual-adapter';
    this.visualRoot.scale.setScalar(PLAYER_VISUAL_WRAPPER_SCALE);
    this.visualRoot.add(character.root);
    this.root.add(this.visualRoot);
  }

  /**
   * Hot-swaps the active visual (procedural placeholder -> loaded GLB) and
   * disposes the replaced visual's geometries. Shared materials stay alive so
   * a fallback instance can still be constructed if ever needed.
   */
  setCharacter(character: CharacterVisual): void {
    if (character === this.character) return;
    const previous = this.character;
    this.visualRoot.remove(previous.root);
    previous.root.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    this.character = character;
    this.visualRoot.add(character.root);
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

  playGesture(name: CharacterGestureName): boolean {
    return this.character.playGesture?.(name) ?? false;
  }

  getPoseName(): CharacterPoseName | CharacterGestureName {
    return this.character.getPoseName();
  }

  getRenderMetrics(): CharacterRenderMetrics {
    return this.character.getRenderMetrics();
  }
}
