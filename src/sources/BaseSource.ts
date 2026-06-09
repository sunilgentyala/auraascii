import * as THREE from 'three';

/**
 * Abstract base for all media sources (Image, GIF, Video, Webcam).
 *
 * Lifecycle contract:
 *   factory() → start() → [tick() per animation frame] → stop() → dispose()
 *
 * `texture` is always GPU-ready immediately after the factory resolves.
 * Callers hand `texture` to AsciiRenderer.setSourceTexture() and then call
 * tick() inside the render loop via the onTick callback on startLoop().
 *
 * Sources are single-use: once dispose() is called the instance is invalid.
 */
export abstract class BaseSource {
  protected readonly _texture: THREE.Texture;

  protected constructor(texture: THREE.Texture) {
    this._texture = texture;
  }

  get texture(): THREE.Texture {
    return this._texture;
  }

  /** Begin or resume playback.  No-op for static sources. */
  abstract start(): Promise<void>;

  /** Pause playback without releasing GPU/CPU resources. */
  abstract stop(): void;

  /**
   * Called once per animation frame by the render loop.
   * Dynamic sources (GIF) advance their internal frame state here.
   * Static and VideoTexture-based sources are no-ops.
   */
  abstract tick(): void;

  /** Release all GPU and CPU resources.  Do not use the source after this. */
  abstract dispose(): void;
}
