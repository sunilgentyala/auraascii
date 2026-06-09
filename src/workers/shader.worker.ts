// Null-origin sandboxed validation worker (Vite ?worker&inline creates a blob-URL worker).
// Has no access to document, window, localStorage, sessionStorage, or cookies.
// Receives a GLSL expression string, validates it, and returns a complete fragment shader source.

const MAX_EXPR_LEN = 256;

// Rejects preprocessor injection, early-return, output-variable writes,
// and texture sampling (no samplers are available in the math template).
const BLOCK_RE = /[#]|\b(discard|return|fragColor|gl_FragDepth|gl_SampleMask|texture)\b/i;

type InMsg  = { type: 'validate'; id: string; expr: string };
type OutMsg =
  | { type: 'result'; id: string; ok: true;  source: string }
  | { type: 'result'; id: string; ok: false; error: string };

function buildSource(expr: string): string {
  return [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'out vec4 fragColor;',
    'uniform float uTime;',
    'void main() {',
    '  vec2 uv = vUv;',
    `  float v = clamp(float(${expr}), 0.0, 1.0);`,
    '  fragColor = vec4(v, v, v, 1.0);',
    '}',
  ].join('\n');
}

self.addEventListener('message', (e: MessageEvent<InMsg>) => {
  const { type, id, expr } = e.data;
  if (type !== 'validate') return;

  const send = (msg: OutMsg) =>
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

  if (typeof expr !== 'string' || expr.trim().length === 0) {
    send({ type: 'result', id, ok: false, error: 'Expression cannot be empty.' });
    return;
  }
  if (expr.length > MAX_EXPR_LEN) {
    send({ type: 'result', id, ok: false, error: `Exceeds ${MAX_EXPR_LEN}-character limit.` });
    return;
  }
  if (BLOCK_RE.test(expr)) {
    send({ type: 'result', id, ok: false, error: 'Expression contains a blocked keyword.' });
    return;
  }

  send({ type: 'result', id, ok: true, source: buildSource(expr) });
});
