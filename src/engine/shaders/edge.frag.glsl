// Pass 1 — Sobel edge detection.
// Samples a 3x3 neighbourhood around each texel and applies the Sobel kernels
// to the perceptual luminance of the source texture.
//
// Output layout (RGBA):
//   r = gradient magnitude  (0..1, boosted x2 to emphasise subtle edges)
//   g = gradient angle      (0..1, mapped from atan2 range [-PI, PI])
//   b = centre luminance    (0..1, passed through for character selection)
//   a = 1.0
//
// The angle channel is reserved for future directional-character selection
// (e.g. choosing '/' vs '\' vs '|' vs '-' based on edge orientation).
precision highp float;

uniform sampler2D uSource;
uniform vec2      uTexelSize; // (1/width, 1/height)

in  vec2 vUv;
out vec4 fragColor;

// Perceptual luminance — ITU-R BT.709 coefficients
float lum(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  // Sample 3x3 neighbourhood (centre omitted from kernel — no direct Sobel weight)
  float tl = lum(texture(uSource, vUv + uTexelSize * vec2(-1.0, -1.0)).rgb);
  float tc = lum(texture(uSource, vUv + uTexelSize * vec2( 0.0, -1.0)).rgb);
  float tr = lum(texture(uSource, vUv + uTexelSize * vec2( 1.0, -1.0)).rgb);
  float ml = lum(texture(uSource, vUv + uTexelSize * vec2(-1.0,  0.0)).rgb);
  float mr = lum(texture(uSource, vUv + uTexelSize * vec2( 1.0,  0.0)).rgb);
  float bl = lum(texture(uSource, vUv + uTexelSize * vec2(-1.0,  1.0)).rgb);
  float bc = lum(texture(uSource, vUv + uTexelSize * vec2( 0.0,  1.0)).rgb);
  float br = lum(texture(uSource, vUv + uTexelSize * vec2( 1.0,  1.0)).rgb);

  // Sobel kernels
  // Gx: [[-1,0,+1],[-2,0,+2],[-1,0,+1]]  — detects vertical edges
  // Gy: [[-1,-2,-1],[0,0,0],[+1,+2,+1]]   — detects horizontal edges
  float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
  float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;

  float magnitude = clamp(sqrt(gx*gx + gy*gy) * 2.0, 0.0, 1.0);

  // Normalise atan2 output [-PI, PI] to [0, 1]
  // 1/(2*PI) = 0.15915494309
  float angle = atan(gy, gx) * 0.15915494309 + 0.5;

  float centerLum = lum(texture(uSource, vUv).rgb);

  fragColor = vec4(magnitude, angle, centerLum, 1.0);
}
