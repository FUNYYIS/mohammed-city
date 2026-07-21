import { AnimationClip, Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeletal } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Loads each city-content GLB exactly once and caches the parsed scene and
 * its animation clips. `clone()` returns a fresh `SkeletonUtils` clone
 * (safe for both static props and rigged/animated models) so every zone or
 * NPC instance shares the same source geometries and materials instead of
 * re-fetching or re-parsing the file.
 */
export class GlbModelCache {
  private readonly scenes = new Map<string, Object3D>();
  private readonly clips = new Map<string, AnimationClip[]>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly loader = new GLTFLoader();

  async preload(urls: readonly string[]): Promise<void> {
    await Promise.all(urls.map((url) => this.load(url)));
  }

  clone(url: string): Object3D | null {
    const source = this.scenes.get(url);
    if (!source) return null;
    return cloneSkeletal(source);
  }

  getClips(url: string): AnimationClip[] {
    return this.clips.get(url) ?? [];
  }

  private async load(url: string): Promise<void> {
    if (this.scenes.has(url)) return;
    const existing = this.pending.get(url);
    if (existing) return existing;

    const request = this.loader.loadAsync(url).then((gltf) => {
      gltf.scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      this.scenes.set(url, gltf.scene);
      this.clips.set(url, gltf.animations);
    }).catch((error) => {
      console.warn(`[GlbModelCache] failed to load ${url}; a placeholder-free scene will omit it`, error);
    }).finally(() => {
      this.pending.delete(url);
    });
    this.pending.set(url, request);
    return request;
  }
}

export const cityAssetCache = new GlbModelCache();
