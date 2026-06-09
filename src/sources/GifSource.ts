import * as THREE from 'three';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { BaseSource } from './BaseSource';
import {
  validateMediaFile,
  ALLOWED_GIF_TYPES,
  MAX_GIF_BYTES,
  clampDimension,
} from '@utils/sanitize';

// Minimal subset of the gifuct-js frame shape we consume
interface GifFrame {
  dims:         { width: number; height: number; top: number; left: number };
  patch:        Uint8ClampedArray;
  delay:        number;        // centiseconds (1/100 s); 0 means "use default"
  disposalType: number;        // 0|1 = leave, 2 = restore bg, 3 = restore prev
}

// gifuct-js Logical Screen Descriptor shape
interface ParsedGif {
  lsd: { width: number; height: number };
}

/**
 * Animated GIF source.
 *
 * Decodes all frames at construction time using gifuct-js (a pure-JS LZW
 * decoder — no eval, no WASM, no native code).  Each tick() call advances
 * the frame state based on performance.now() so timing is not affected by
 * rAF throttling in background tabs.
 *
 * Compositing strategy — scratch canvas + drawImage:
 *   A persistent off-DOM scratch canvas holds each raw frame patch via
 *   putImageData().  drawImage() then composites the scratch into the main
 *   canvas using 'source-over', which correctly handles GIF 1-bit alpha:
 *   transparent pixels in the patch leave the main canvas pixels intact,
 *   reproducing the standard GIF onion-skin effect.
 *
 * Disposal method support:
 *   0 / 1  — leave (draw next frame on top of current)
 *   2      — restore-to-background (clear region before drawing next frame)
 *   3      — treated as leave (restore-previous is rarely used in practice)
 *
 * Security notes:
 * - MIME type and byte size validated before ArrayBuffer allocation.
 * - Neither canvas is appended to the DOM.
 * - All data originates from the gifuct-js binary parser — no innerHTML path.
 * - Dimensions clamped to MAX_DIMENSION to prevent GPU memory exhaustion.
 */
export class GifSource extends BaseSource {
  private readonly frames:       GifFrame[];
  private readonly canvas:       HTMLCanvasElement;
  private readonly ctx:          CanvasRenderingContext2D;
  private readonly scratch:      HTMLCanvasElement;
  private readonly scratchCtx:   CanvasRenderingContext2D;
  private frameIndex:            number  = 0;
  private frameDeadline:         number  = 0; // performance.now() ms target for next advance
  private playing:               boolean = false;

  private constructor(
    frames: GifFrame[],
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    scratch: HTMLCanvasElement,
    scratchCtx: CanvasRenderingContext2D,
    texture: THREE.CanvasTexture,
  ) {
    super(texture);
    this.frames     = frames;
    this.canvas     = canvas;
    this.ctx        = ctx;
    this.scratch    = scratch;
    this.scratchCtx = scratchCtx;
  }

  static async fromFile(file: File): Promise<GifSource> {
    const check = validateMediaFile(file, ALLOWED_GIF_TYPES, MAX_GIF_BYTES);
    if (!check.ok) throw new Error(check.error);

    const buffer    = await file.arrayBuffer();
    const parsed    = parseGIF(buffer) as ParsedGif;
    const rawFrames = decompressFrames(parsed as never, false) as GifFrame[];

    // Filter out zero-size or malformed frames
    const frames = rawFrames.filter(
      (f) =>
        f.patch &&
        f.dims.width  > 0 &&
        f.dims.height > 0 &&
        f.patch.length === f.dims.width * f.dims.height * 4,
    );

    if (frames.length === 0) throw new Error('GIF contains no decodable frames.');

    const gifW = clampDimension(parsed.lsd.width);
    const gifH = clampDimension(parsed.lsd.height);

    // Main compositing canvas — backs the THREE.CanvasTexture
    const canvas = document.createElement('canvas');
    canvas.width  = gifW;
    canvas.height = gifH;
    const ctx     = canvas.getContext('2d');
    if (!ctx) throw new Error('[GifSource] 2D context unavailable.');
    ctx.clearRect(0, 0, gifW, gifH);

    // Scratch canvas: sized to the largest frame sub-rect for zero-alloc blits
    const maxFW = frames.reduce((m, f) => Math.max(m, f.dims.width),  1);
    const maxFH = frames.reduce((m, f) => Math.max(m, f.dims.height), 1);
    const scratch = document.createElement('canvas');
    scratch.width  = maxFW;
    scratch.height = maxFH;
    const scratchCtx = scratch.getContext('2d');
    if (!scratchCtx) throw new Error('[GifSource] scratch 2D context unavailable.');

    // Blit frame 0 so the texture is non-black before start() is called
    GifSource.blitFrame(ctx, scratchCtx, frames[0]);

    const texture       = new THREE.CanvasTexture(canvas);
    texture.minFilter   = THREE.LinearFilter;
    texture.magFilter   = THREE.LinearFilter;
    texture.colorSpace  = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return new GifSource(frames, canvas, ctx, scratch, scratchCtx, texture);
  }

  start(): Promise<void> {
    this.playing       = true;
    this.frameDeadline = performance.now() + this.frameDuration(this.frameIndex);
    return Promise.resolve();
  }

  stop(): void {
    this.playing = false;
  }

  tick(): void {
    if (!this.playing || this.frames.length <= 1) return;

    const now = performance.now();
    if (now < this.frameDeadline) return;

    // Apply the departing frame's disposal before advancing
    this.applyDisposal(this.frames[this.frameIndex]);

    this.frameIndex    = (this.frameIndex + 1) % this.frames.length;
    this.frameDeadline = now + this.frameDuration(this.frameIndex);

    GifSource.blitFrame(this.ctx, this.scratchCtx, this.frames[this.frameIndex]);
    (this._texture as THREE.CanvasTexture).needsUpdate = true;
  }

  dispose(): void {
    this.stop();
    this._texture.dispose();
  }

  // -------------------------------------------------------------------------

  private frameDuration(index: number): number {
    // GIF delay in centiseconds; clamp to [20, 5000] ms to avoid runaway loops
    const cs = this.frames[index].delay;
    return Math.min(5000, Math.max(20, cs > 0 ? cs * 10 : 100));
  }

  private applyDisposal(frame: GifFrame): void {
    if (frame.disposalType === 2) {
      this.ctx.clearRect(
        frame.dims.left, frame.dims.top,
        frame.dims.width, frame.dims.height,
      );
    }
    // Types 0, 1: leave in place.  Type 3: treated as leave.
  }

  // Static so it can be called before the instance is constructed (frame 0)
  private static blitFrame(
    dst: CanvasRenderingContext2D,
    scratch: CanvasRenderingContext2D,
    frame: GifFrame,
  ): void {
    const { dims, patch } = frame;
    // Write raw RGBA into the scratch canvas — putImageData ignores compositing
    scratch.putImageData(new ImageData(patch, dims.width, dims.height), 0, 0);
    // drawImage respects 'source-over': transparent pixels don't erase dst
    dst.drawImage(
      scratch.canvas,
      0, 0, dims.width, dims.height,    // src region (scratch)
      dims.left, dims.top, dims.width, dims.height, // dst position (main canvas)
    );
  }
}
