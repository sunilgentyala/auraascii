// Procedural test texture for Phase 2 pipeline validation.
// Combines a checkerboard (hard edges — exercises Pass 1) with a radial
// gradient (smooth luminance ramp — exercises the full character range in Pass 2).
// Removed once real media sources are wired up in Phase 3.

import * as THREE from 'three';

export function createDebugTexture(width = 256, height = 256): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4);
  const cx   = width  / 2;
  const cy   = height / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // Checkerboard with 16-px cells — creates sharp Sobel edges
      const checker = ((Math.floor(x / 16) + Math.floor(y / 16)) % 2) * 180;

      // Radial gradient — drives the full luminance range
      const dx       = x - cx;
      const dy       = y - cy;
      const radial   = Math.floor((1.0 - Math.sqrt(dx * dx + dy * dy) / maxR) * 255);

      // Diagonal sine wave — adds mid-frequency detail
      const wave = Math.floor(
        (Math.sin((x + y) * 0.08) * 0.5 + 0.5) * 140
      );

      const v = Math.min(255, Math.floor((checker + radial + wave) / 3));

      data[i]     = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  const texture          = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.minFilter      = THREE.LinearFilter;
  texture.magFilter      = THREE.LinearFilter;
  texture.needsUpdate    = true;
  return texture;
}
