import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';

// Inline GLSL loader: imports of *.glsl files become ES module string exports.
// Using an inline plugin avoids an extra dependency (vite-plugin-glsl) while
// keeping .glsl imports typed and tree-shake-safe.
function glslLoader(): Plugin {
  return {
    name: 'glsl-loader',
    transform(code, id) {
      if (id.endsWith('.glsl')) {
        return { code: `export default ${JSON.stringify(code)};`, map: null };
      }
    },
  };
}

// Production-ready CSP.
// Intentionally omits 'unsafe-eval' — WebGL gl.compileShader() is a native
// GPU API call and is unaffected by the eval restriction.
// worker-src includes blob: for dynamically constructed null-origin Workers
// used in the sandboxed math-shader mode (Phase 5).
const CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "upgrade-insecure-requests",
].join('; ');

// Set base to the repo name when building for GitHub Pages; use / for local dev.
const base = process.env.GITHUB_ACTIONS === 'true' ? '/auraascii/' : '/';

export default defineConfig({
  base,
  plugins: [react(), glslLoader()],

  resolve: {
    alias: {
      '@engine':     path.resolve(__dirname, 'src/engine'),
      '@sources':    path.resolve(__dirname, 'src/sources'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@utils':      path.resolve(__dirname, 'src/utils'),
      '@workers':    path.resolve(__dirname, 'src/workers'),
      '@data':       path.resolve(__dirname, 'src/data'),
      '@lib':        path.resolve(__dirname, 'src/lib'),
    },
  },

  server: {
    headers: {
      'Content-Security-Policy': CSP_DIRECTIVES,
      'X-Content-Type-Options':  'nosniff',
      'X-Frame-Options':          'DENY',
      'Referrer-Policy':          'no-referrer',
    },
  },

  // Pre-bundle gifuct-js during dep optimisation to ensure CJS->ESM conversion
  // runs at startup rather than on first import during the GIF decode path.
  optimizeDeps: {
    include: ['gifuct-js'],
  },

  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
