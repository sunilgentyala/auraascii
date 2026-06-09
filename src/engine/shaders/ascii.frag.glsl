// Pass 2 — Character mapping and glyph atlas compositing.
//
// Every pixel in a character cell renders the same chosen character,
// but reads the correct sub-texel from the glyph atlas for its
// position within the cell.  No CPU text rendering occurs.
//
// Character selection logic:
//   intensity = mix(cellLuminance, edgeMagnitude, uEdgeWeight)
//   charIndex = floor(intensity * uContrast * (charCount - 1))
//
// High-intensity / high-edge cells get dense characters (@, #, W …).
// Low-intensity / flat cells get sparse characters (., ' ', …).
// The charset in GlyphAtlas is pre-sorted dense-to-sparse so index 0
// is always the densest character.
precision highp float;

uniform sampler2D uSource;     // original media (unused here, reserved for future colour mode)
uniform sampler2D uEdge;       // Pass 1 FBO: .r=magnitude, .g=angle, .b=luminance
uniform sampler2D uAtlas;      // pre-rendered glyph atlas texture
uniform vec2      uCellCount;  // (numCols, numRows) of the character grid
uniform vec2      uAtlasDims;  // (atlasCols, atlasRows) of the glyph atlas grid
uniform float     uEdgeWeight; // [0,1] — 0 = pure luminance, 1 = pure edge
uniform float     uContrast;   // luminance contrast multiplier
uniform vec3      uFgColor;    // foreground character colour
uniform vec3      uBgColor;    // background colour
uniform float     uCharCount;  // total characters in the atlas

in  vec2 vUv;
out vec4 fragColor;

void main() {
  // Determine which cell this pixel lives in and its position within that cell
  vec2 cellIndex = floor(vUv * uCellCount);
  vec2 cellUv    = (cellIndex + 0.5) / uCellCount; // centre of the cell
  vec2 inCellUv  = fract(vUv * uCellCount);         // [0,1] offset within cell

  // Read edge data sampled at the cell centre (one value per cell, not per pixel)
  vec4  edgeData = texture(uEdge, cellUv);
  float edgeMag  = edgeData.r; // already clamped in Pass 1
  float cellLum  = edgeData.b;

  // Blend luminance and edge magnitude, then apply contrast
  float intensity = mix(cellLum, edgeMag, uEdgeWeight);
  intensity = clamp(intensity * uContrast, 0.0, 1.0);

  // Map intensity to a character index (dense chars at high intensity)
  float charIndex = floor(intensity * (uCharCount - 1.0));

  // Locate the glyph cell in the atlas grid
  vec2 atlasCell = vec2(
    mod(charIndex, uAtlasDims.x),
    floor(charIndex / uAtlasDims.x)
  );

  // UV into the atlas at the sub-glyph position for this pixel
  vec2 atlasUv = (atlasCell + inCellUv) / uAtlasDims;

  // Atlas is white-on-black; the red channel gives the glyph mask
  float glyphMask = texture(uAtlas, atlasUv).r;

  // Composite foreground over background using glyph mask as alpha
  vec3 color = mix(uBgColor, uFgColor, glyphMask);
  fragColor  = vec4(color, 1.0);
}
