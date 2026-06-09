import * as THREE from 'three';
import { BaseSource } from './BaseSource';

// layout(location=0) binds a_pos to attribute slot 0 without a separate bindAttribLocation call.
const VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 vUv;
void main() {
  vUv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('gl.createShader returned null.');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = (gl.getShaderInfoLog(sh) ?? '').trim();
    gl.deleteShader(sh);
    throw new Error(log || 'Shader compilation failed.');
  }
  return sh;
}

function buildProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
  fragSrc: string,
): WebGLProgram {
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram();
  if (!prog) { gl.deleteShader(frag); throw new Error('gl.createProgram returned null.'); }
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = (gl.getProgramInfoLog(prog) ?? '').trim();
    gl.deleteProgram(prog);
    throw new Error(log || 'Program linking failed.');
  }
  return prog;
}

/**
 * Procedural source driven by a user-supplied GLSL fragment expression.
 * Renders into its own WebGL2 canvas each tick; exposes the result as a
 * THREE.CanvasTexture that AsciiRenderer can consume like any other source.
 */
export class MathSource extends BaseSource {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _gl: WebGL2RenderingContext;
  private readonly _vert: WebGLShader;
  private readonly _vao: WebGLVertexArrayObject;
  private _program: WebGLProgram;
  private _uTime: WebGLUniformLocation | null;
  private readonly _t0 = performance.now();

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    vert: WebGLShader,
    vao: WebGLVertexArrayObject,
    program: WebGLProgram,
    uTime: WebGLUniformLocation | null,
  ) {
    super(new THREE.CanvasTexture(canvas));
    this._canvas  = canvas;
    this._gl      = gl;
    this._vert    = vert;
    this._vao     = vao;
    this._program = program;
    this._uTime   = uTime;
  }

  static create(glslSource: string, resolution = 512): MathSource {
    const canvas = document.createElement('canvas');
    canvas.width  = resolution;
    canvas.height = resolution;

    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');

    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('gl.createVertexArray returned null.');
    gl.bindVertexArray(vao);

    const buf = gl.createBuffer();
    if (!buf) throw new Error('gl.createBuffer returned null.');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // Two triangles covering clip space [-1,1]
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1,  1, -1,  -1,  1,  1, -1,  1,  1,  -1,  1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const prog  = buildProgram(gl, vert, glslSource);
    const uTime = gl.getUniformLocation(prog, 'uTime');

    return new MathSource(canvas, gl, vert, vao, prog, uTime);
  }

  /**
   * Hot-swap the fragment shader without recreating the source.
   * Returns an error string on GPU compilation failure (old shader stays active).
   */
  setShader(glslSource: string): string | null {
    try {
      const prog = buildProgram(this._gl, this._vert, glslSource);
      this._gl.deleteProgram(this._program);
      this._program = prog;
      this._uTime   = this._gl.getUniformLocation(prog, 'uTime');
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }

  tick(): void {
    const { _gl: gl, _canvas: cv } = this;
    gl.viewport(0, 0, cv.width, cv.height);
    gl.useProgram(this._program);
    if (this._uTime !== null) {
      gl.uniform1f(this._uTime, (performance.now() - this._t0) / 1000);
    }
    gl.bindVertexArray(this._vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    this._texture.needsUpdate = true;
  }

  start():   Promise<void> { return Promise.resolve(); }
  stop():    void {}

  dispose(): void {
    const { _gl: gl } = this;
    gl.deleteProgram(this._program);
    gl.deleteShader(this._vert);
    gl.deleteVertexArray(this._vao);
    this._texture.dispose();
  }
}
