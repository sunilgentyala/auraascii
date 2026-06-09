import type { RendererConfig } from '@engine/types';
import { DEFAULT_CHARSET } from '@engine/types';

export interface Preset {
  id:     string;
  name:   string;
  /** Dot color shown in the preset card — matches fgColor for most presets. */
  dot:    string;
  config: Partial<RendererConfig>;
}

export const PRESETS: readonly Preset[] = [
  {
    id:   'matrix',
    name: 'Matrix',
    dot:  '#00ff41',
    config: {
      fgColor:    '#00ff41',
      bgColor:    '#000000',
      edgeWeight: 0.60,
      contrast:   1.30,
      cellSize:   8,
      charset:    DEFAULT_CHARSET,
    },
  },
  {
    id:   'amber',
    name: 'Amber',
    dot:  '#ffb000',
    config: {
      fgColor:    '#ffb000',
      bgColor:    '#080400',
      edgeWeight: 0.40,
      contrast:   1.20,
      cellSize:   8,
      charset:    DEFAULT_CHARSET,
    },
  },
  {
    id:   'cyan',
    name: 'Cyan',
    dot:  '#00ffff',
    config: {
      fgColor:    '#00ffff',
      bgColor:    '#000808',
      edgeWeight: 0.50,
      contrast:   1.20,
      cellSize:   8,
      charset:    DEFAULT_CHARSET,
    },
  },
  {
    id:   'classic',
    name: 'Classic',
    dot:  '#d4d4d8',
    config: {
      fgColor:    '#d4d4d8',
      bgColor:    '#000000',
      edgeWeight: 0.30,
      contrast:   1.00,
      cellSize:   8,
      charset:    '@#S%?*+;:,. ',
    },
  },
  {
    id:   'blueprint',
    name: 'Blueprint',
    dot:  '#4d9fff',
    config: {
      fgColor:    '#4d9fff',
      bgColor:    '#00091a',
      edgeWeight: 0.70,
      contrast:   1.40,
      cellSize:   6,
      charset:    DEFAULT_CHARSET,
    },
  },
  {
    id:   'binary',
    name: 'Binary',
    dot:  '#ff3131',
    config: {
      fgColor:    '#ff3131',
      bgColor:    '#060000',
      edgeWeight: 0.80,
      contrast:   1.60,
      cellSize:   8,
      charset:    '01 ',
    },
  },
  {
    id:   'plasma',
    name: 'Plasma',
    dot:  '#b44fff',
    config: {
      fgColor:    '#b44fff',
      bgColor:    '#06000a',
      edgeWeight: 0.55,
      contrast:   1.30,
      cellSize:   8,
      charset:    DEFAULT_CHARSET,
    },
  },
  {
    id:   'ghost',
    name: 'Ghost',
    dot:  '#94a3b8',
    config: {
      fgColor:    '#94a3b8',
      bgColor:    '#020617',
      edgeWeight: 0.45,
      contrast:   0.90,
      cellSize:   10,
      charset:    '░▒▓█▄▀■□▪▫',
    },
  },
] as const;
