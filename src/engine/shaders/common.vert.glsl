// Shared full-screen quad vertex shader used by both render passes.
// Three.js RawShaderMaterial with glslVersion: THREE.GLSL3 prepends
// "#version 300 es" automatically — do not add it here.
precision highp float;

// Three.js built-in attribute names (provided by PlaneGeometry)
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
in vec3 position;
in vec2 uv;

out vec2 vUv;

void main() {
  vUv         = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
