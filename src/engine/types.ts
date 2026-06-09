// Central type definitions for the AuraASCII rendering engine.
// All engine classes and React components import from here to keep
// the configuration shape as a single source of truth.

export interface RendererConfig {
  /** Character cell size in CSS pixels (controls grid density). */
  cellSize: number;
  /** Characters sorted dense-to-sparse, e.g. "@#S%?*+;:,. " */
  charset: string;
  /** [0,1] — 0 = luminance-only mapping, 1 = edge-only mapping */
  edgeWeight: number;
  /** Luminance contrast multiplier applied before character selection. */
  contrast: number;
  /** CSS hex colour for foreground (character) pixels. */
  fgColor: string;
  /** CSS hex colour for background pixels. */
  bgColor: string;
  /** Font family used to render the glyph atlas. */
  fontFamily: string;
  /** Font size in px used to render the glyph atlas. */
  fontSize: number;
}

export interface GlyphMetrics {
  glyphW: number;
  glyphH: number;
  /** Number of glyph columns in the atlas grid. */
  cols: number;
  /** Number of glyph rows in the atlas grid. */
  rows: number;
  /** Side length of the square power-of-two atlas canvas. */
  atlasSize: number;
  /** Total number of unique characters in the atlas. */
  charCount: number;
}

// Characters ordered from most dense/bright to least (standard ASCII density ramp).
// Edge-heavy regions map to the left end; flat/dark regions to the right.
export const DEFAULT_CHARSET = '@#MW&8B%$XoahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`. ';

export const DEFAULT_RENDERER_CONFIG: Readonly<RendererConfig> = {
  cellSize:   8,
  charset:    DEFAULT_CHARSET,
  edgeWeight: 0.5,
  contrast:   1.2,
  fgColor:    '#00ff41', // terminal green
  bgColor:    '#000000',
  fontFamily: 'monospace',
  fontSize:   12,
};
