// AsciiRenderer — two-pass WebGL rendering pipeline.
//
// Pass 1 (EdgeFBO): runs edge.frag.glsl on the source texture; outputs gradient
//   magnitude, angle, and luminance to a half-float FBO.
//
// Pass 2 (Screen): runs ascii.frag.glsl; reads the EdgeFBO and the glyph atlas
//   to composite the final typographic frame directly to the canvas.
//
// Three.js is used for context management, FBO handling, and built-in WebGL2
// capability detection.  RawShaderMaterial keeps full control of the GLSL.

import * as THREE from 'three';
import { GlyphAtlas } from './GlyphAtlas';
import type { RendererConfig } from './types';

import commonVertSrc from './shaders/common.vert.glsl';
import edgeFragSrc   from './shaders/edge.frag.glsl';
import asciiFragSrc  from './shaders/ascii.frag.glsl';

export class AsciiRenderer {
  private readonly renderer:  THREE.WebGLRenderer;
  private readonly camera:    THREE.OrthographicCamera;
  private readonly geometry:  THREE.PlaneGeometry;

  // Pass 1
  private edgeFBO:      THREE.WebGLRenderTarget;
  private edgeMat:      THREE.RawShaderMaterial;
  private edgeScene:    THREE.Scene;

  // Pass 2
  private asciiMat:     THREE.RawShaderMaterial;
  private asciiScene:   THREE.Scene;

  // State
  private atlas:        GlyphAtlas;
  private atlasTex:     THREE.CanvasTexture;
  private config:       RendererConfig;
  private animId:       number | null = null;
  private sourceTex:    THREE.Texture | null = null;

  constructor(canvas: HTMLCanvasElement, config: RendererConfig) {
    this.config = { ...config };

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias:            false,
      alpha:                false,
      powerPreference:      'high-performance',
      preserveDrawingBuffer: true, // required for PNG export and ASCII text readback
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    // Orthographic camera looking straight at the quad — no perspective needed
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Full-screen quad: PlaneGeometry(2,2) spans NDC [-1,1] in both axes
    this.geometry = new THREE.PlaneGeometry(2, 2);

    // Glyph atlas — built once, uploaded as a texture
    this.atlas    = new GlyphAtlas({
      charset:    config.charset,
      fontSize:   config.fontSize,
      fontFamily: config.fontFamily,
    });
    this.atlasTex = this.buildAtlasTex();

    // Render targets + materials
    const size    = this.renderer.getSize(new THREE.Vector2());
    this.edgeFBO  = this.makeEdgeFBO(size.x, size.y);
    this.edgeMat  = this.makeEdgeMat(size.x, size.y);
    this.asciiMat = this.makeAsciiMat(size.x, size.y);

    // Scene graphs — one mesh per pass
    const edgeMesh  = new THREE.Mesh(this.geometry, this.edgeMat);
    this.edgeScene  = new THREE.Scene();
    this.edgeScene.add(edgeMesh);

    const asciiMesh  = new THREE.Mesh(this.geometry, this.asciiMat);
    this.asciiScene  = new THREE.Scene();
    this.asciiScene.add(asciiMesh);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  setSourceTexture(tex: THREE.Texture): void {
    this.sourceTex = tex;
    this.edgeMat.uniforms['uSource'].value  = tex;
    this.asciiMat.uniforms['uSource'].value = tex;
  }

  updateConfig(patch: Partial<RendererConfig>): void {
    Object.assign(this.config, patch);

    if (patch.edgeWeight !== undefined)
      this.asciiMat.uniforms['uEdgeWeight'].value = patch.edgeWeight;

    if (patch.contrast !== undefined)
      this.asciiMat.uniforms['uContrast'].value = patch.contrast;

    if (patch.fgColor !== undefined)
      (this.asciiMat.uniforms['uFgColor'].value as THREE.Color).set(patch.fgColor);

    if (patch.bgColor !== undefined)
      (this.asciiMat.uniforms['uBgColor'].value as THREE.Color).set(patch.bgColor);

    // Charset or font changes require a full atlas rebuild
    const needsAtlas = patch.charset !== undefined
      || patch.fontSize   !== undefined
      || patch.fontFamily !== undefined;

    if (needsAtlas) this.rebuildAtlas();
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.renderer.setSize(cssWidth, cssHeight, false);

    // Actual pixel dimensions after DPR scaling
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;

    this.edgeFBO.setSize(w, h);
    this.edgeMat.uniforms['uTexelSize'].value.set(1 / w, 1 / h);

    const cols = Math.max(1, Math.floor(cssWidth  / this.config.cellSize));
    const rows = Math.max(1, Math.floor(cssHeight / this.config.cellSize));
    this.asciiMat.uniforms['uCellCount'].value.set(cols, rows);
  }

  render(): void {
    if (!this.sourceTex) return;

    // Pass 1: edge detection to FBO
    this.renderer.setRenderTarget(this.edgeFBO);
    this.renderer.render(this.edgeScene, this.camera);

    // Pass 2: ASCII compositing to screen
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.asciiScene, this.camera);
  }

  /**
   * Start the animation loop.
   * @param onTick  Called every frame before rendering (for GIF/Math source tick).
   * @param onFps   Called once per second with the rolling FPS value.
   */
  startLoop(onTick?: () => void, onFps?: (fps: number) => void): void {
    let frames = 0;
    let t0 = performance.now();

    const loop = () => {
      onTick?.();
      this.render();
      frames++;
      const now = performance.now();
      if (now - t0 >= 1000) {
        onFps?.(Math.round(frames * 1000 / (now - t0)));
        frames = 0;
        t0 = now;
      }
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stopLoop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  /** Capture the current frame as a PNG Blob. Requires preserveDrawingBuffer: true. */
  exportPng(): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) =>
      this.renderer.domElement.toBlob(resolve, 'image/png'),
    );
  }

  /**
   * Convert the current rendered frame to plain ASCII text via a 2D canvas
   * pixel readback. High-luminance cells map to dense charset characters,
   * low-luminance cells map to sparse ones.
   */
  generateAsciiText(): string {
    const src = this.renderer.domElement;
    const w   = src.width;
    const h   = src.height;

    const tmp = document.createElement('canvas');
    tmp.width  = w;
    tmp.height = h;
    const ctx  = tmp.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(src, 0, 0);
    const { data: px } = ctx.getImageData(0, 0, w, h);

    const { cellSize, charset } = this.config;
    const n    = charset.length;
    const cols = Math.max(1, Math.floor(w / cellSize));
    const rows = Math.max(1, Math.floor(h / cellSize));
    const lines: string[] = [];

    for (let row = 0; row < rows; row++) {
      let line = '';
      for (let col = 0; col < cols; col++) {
        const x0 = Math.floor(col * w / cols);
        const x1 = Math.floor((col + 1) * w / cols);
        const y0 = Math.floor(row * h / rows);
        const y1 = Math.floor((row + 1) * h / rows);
        let sum = 0, cnt = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * w + x) * 4;
            sum += px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
            cnt++;
          }
        }
        const lum = cnt > 0 ? sum / (cnt * 255) : 0;
        // Dense charset chars are at index 0 (@), sparse/space at index n-1.
        // High luminance = more fg pixels = denser character = lower index.
        const idx = Math.min(n - 1, Math.floor((1 - lum) * n));
        line += charset[idx];
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  dispose(): void {
    this.stopLoop();
    this.edgeFBO.dispose();
    this.edgeMat.dispose();
    this.asciiMat.dispose();
    this.atlasTex.dispose();
    this.geometry.dispose();
    this.renderer.dispose();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildAtlasTex(): THREE.CanvasTexture {
    const tex       = new THREE.CanvasTexture(this.atlas.canvas);
    tex.minFilter   = THREE.NearestFilter;
    tex.magFilter   = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private makeEdgeFBO(w: number, h: number): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(w, h, {
      type:      THREE.HalfFloatType,
      format:    THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
  }

  private makeEdgeMat(w: number, h: number): THREE.RawShaderMaterial {
    return new THREE.RawShaderMaterial({
      glslVersion:    THREE.GLSL3,
      vertexShader:   commonVertSrc,
      fragmentShader: edgeFragSrc,
      uniforms: {
        uSource:    { value: null },
        uTexelSize: { value: new THREE.Vector2(1 / w, 1 / h) },
      },
    });
  }

  private makeAsciiMat(cssW: number, cssH: number): THREE.RawShaderMaterial {
    const { metrics } = this.atlas;
    const cols = Math.max(1, Math.floor(cssW / this.config.cellSize));
    const rows = Math.max(1, Math.floor(cssH / this.config.cellSize));

    return new THREE.RawShaderMaterial({
      glslVersion:    THREE.GLSL3,
      vertexShader:   commonVertSrc,
      fragmentShader: asciiFragSrc,
      uniforms: {
        uSource:     { value: null },
        uEdge:       { value: this.edgeFBO.texture },
        uAtlas:      { value: this.atlasTex },
        uCellCount:  { value: new THREE.Vector2(cols, rows) },
        uAtlasDims:  { value: new THREE.Vector2(metrics.cols, metrics.rows) },
        uEdgeWeight: { value: this.config.edgeWeight },
        uContrast:   { value: this.config.contrast },
        uFgColor:    { value: new THREE.Color(this.config.fgColor) },
        uBgColor:    { value: new THREE.Color(this.config.bgColor) },
        uCharCount:  { value: metrics.charCount },
      },
    });
  }

  private rebuildAtlas(): void {
    this.atlasTex.dispose();
    this.atlas    = new GlyphAtlas({
      charset:    this.config.charset,
      fontSize:   this.config.fontSize,
      fontFamily: this.config.fontFamily,
    });
    this.atlasTex = this.buildAtlasTex();

    const u = this.asciiMat.uniforms;
    u['uAtlas'].value     = this.atlasTex;
    u['uAtlasDims'].value.set(this.atlas.metrics.cols, this.atlas.metrics.rows);
    u['uCharCount'].value = this.atlas.metrics.charCount;
  }
}
