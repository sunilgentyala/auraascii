// GlyphAtlas — renders all characters in a charset onto a single HTMLCanvasElement
// (white-on-black, power-of-two dimensions) so they can be uploaded once as a
// WebGL texture.  The canvas is not appended to the DOM.
//
// Atlas layout: glyphs are packed left-to-right, top-to-bottom in a square grid.
// Index 0 = charset[0] (densest character), index N-1 = charset[N-1] (sparest).

import type { GlyphMetrics } from './types';

export interface GlyphAtlasConfig {
  /** Characters sorted dense-to-sparse. */
  charset: string;
  fontSize: number;
  fontFamily: string;
}

export class GlyphAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly metrics: GlyphMetrics;

  constructor(config: GlyphAtlasConfig) {
    const { charset, fontSize, fontFamily } = config;

    // Deduplicate while preserving order
    const chars = [...new Set([...charset])];
    const charCount = chars.length;

    // Probe glyph dimensions using an off-screen measurement canvas
    const probe = document.createElement('canvas');
    probe.width  = 64;
    probe.height = 64;
    const probe2d = probe.getContext('2d');
    if (!probe2d) throw new Error('[GlyphAtlas] 2D canvas context unavailable');

    const fontSpec = `${fontSize}px ${fontFamily}`;
    probe2d.font = fontSpec;

    // Use 'M' as the reference character — it is the widest in most monospace fonts
    const glyphW = Math.ceil(probe2d.measureText('M').width);
    // Line height = 1.2× font size is the standard CSS default
    const glyphH = Math.ceil(fontSize * 1.2);

    // Pack into a grid and size the atlas to the next power of two
    const cols      = Math.ceil(Math.sqrt(charCount));
    const rows      = Math.ceil(charCount / cols);
    const atlasSize = nextPow2(Math.max(cols * glyphW, rows * glyphH));

    // Build the atlas canvas (not added to DOM)
    const canvas = document.createElement('canvas');
    canvas.width  = atlasSize;
    canvas.height = atlasSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('[GlyphAtlas] 2D canvas context unavailable');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, atlasSize, atlasSize);
    ctx.fillStyle    = '#ffffff';
    ctx.font         = fontSpec;
    ctx.textBaseline = 'top';

    chars.forEach((ch, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      ctx.fillText(ch, col * glyphW, row * glyphH);
    });

    this.canvas  = canvas;
    this.metrics = { glyphW, glyphH, cols, rows, atlasSize, charCount };
  }
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
