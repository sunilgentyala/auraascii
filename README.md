# AuraASCII

> High-performance, edge-aware ASCII and generative typographic media tool powered by WebGL shaders.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.168-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff.svg)](https://vitejs.dev/)

AuraASCII converts images, GIFs, live video streams, and math shaders into edge-aware, high-performance ASCII and generative typographic art. Unlike DOM-based ASCII converters, AuraASCII runs entirely on the GPU via a two-pass GLSL pipeline, achieving a stable 60 FPS even at high character densities.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Security Design](#security-design)
- [Installation](#installation)
- [Development](#development)
- [Build for Production](#build-for-production)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [Credits](#credits)
- [License](#license)

---

## Features

- **Real-time media processing** -- Images (PNG, JPG, WebP), animated GIFs, MP4 video, and live webcam streams
- **Edge-aware character mapping** -- Sobel filter runs as a GPU fragment shader; character selection follows the actual contour geometry of subjects
- **Math shader mode** -- Write custom GLSL distance functions and see them rendered live in typographic form, executed in a null-origin sandboxed Worker
- **60 FPS rendering** -- Two-pass WebGL pipeline with instanced quad rendering; no Canvas 2D text fallback
- **Configurable glyph sets** -- ASCII printable range, Braille, custom Unicode blocks, or user-supplied character palettes
- **Export** -- Download rendered frames as PNG or copy the raw ASCII string grid to the clipboard
- **Fully client-side** -- Zero server calls; all processing happens in your browser

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React UI Layer                        │
│   MediaUploader   ControlPanel   CanvasHost   PresetPicker  │
└────────────────────────┬────────────────────────────────────┘
                         │ media texture + config
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    AsciiRenderer (WebGL)                     │
│                                                             │
│  ┌──────────────────────┐   ┌──────────────────────────┐   │
│  │   Pass 1: EdgeFBO    │   │   Pass 2: CharacterFBO   │   │
│  │                      │   │                          │   │
│  │  Sobel / Canny       │──▶│  Glyph Atlas Sampler     │   │
│  │  fragment shader     │   │  Luminance + Edge weight │   │
│  │  outputs: gradient   │   │  outputs: final frame    │   │
│  │  magnitude + angle   │   │                          │   │
│  └──────────────────────┘   └──────────────────────────┘   │
│                                                             │
│  GlyphAtlas (OffscreenCanvas pre-render, single texture)    │
│  MediaSourceManager  (Image | GIF | Video | Webcam)         │
└─────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │   null-origin Sandboxed     │
          │   Web Worker (math shaders) │
          │   -- no DOM/window access   │
          └─────────────────────────────┘
```

### Two-Pass GPU Pipeline

**Pass 1 -- Edge Detection FBO**
The source media texture is sampled by a Sobel convolution fragment shader. The 3x3 horizontal and vertical kernels produce a gradient magnitude map and a gradient direction angle, both stored as a floating-point FBO texture. This runs entirely on the GPU with no CPU readback.

**Pass 2 -- Character Selection**
A full-screen quad fragment shader reads the FBO from Pass 1 alongside the original luminance. Each character cell (e.g., 8x12 px) maps to one texel of a virtual grid. The shader blends edge intensity with luminance to select an index into the **Glyph Atlas**, a single 2D texture pre-rendered with all characters in a fixed grid. The chosen glyph texel is composited using additive alpha blending.

**Glyph Atlas**
Built at startup using an OffscreenCanvas: all printable characters are rendered into a power-of-two texture (e.g., 512x512 for 128 glyphs at 8x12 px each). Uploaded once as a `WebGLTexture`. No per-frame CPU text rendering.

---

## Security Design

AuraASCII is built Secure by Design. The threat model addresses both malicious media files and arbitrary user-supplied GLSL code.

| Threat | Mitigation |
|---|---|
| Malicious metadata in uploaded media (EXIF, ID3) | `dompurify` strips all parsed string fields before any DOM/string evaluation |
| XSS via filename or alt text | All user-facing strings are set via `textContent`, never `innerHTML` |
| Malicious GLSL in math shader mode | Shader source runs inside a null-origin `Worker` with `{ type: 'module' }`, isolated from `window`, `document`, `localStorage`, and `cookie` |
| Prototype pollution from JSON config | Config objects are validated with strict schema checks; `Object.create(null)` pattern used for accumulator objects |
| Supply chain compromise | All dependencies are pinned to exact versions in `package.json`; `npm audit` is a required CI step |
| Leaking media content cross-origin | All blob URLs are created with `URL.createObjectURL` and immediately revoked after texture upload |

### Content Security Policy

The production Vite build ships with the following CSP response header (configured in `vite.config.ts`):

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self';
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  media-src 'self' blob:;
  connect-src 'none';
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'none';
  upgrade-insecure-requests;
```

`'unsafe-eval'` is intentionally absent. WebGL shader compilation (`gl.compileShader`) does not use `eval` and is unaffected by this restriction.

---

## Installation

**Prerequisites:** Node.js >= 20, npm >= 10

```bash
# 1. Clone the repository
git clone https://github.com/sunilgentyala/auraascii.git
cd auraascii

# 2. Install dependencies (exact pinned versions)
npm ci

# 3. Run a security audit before first use
npm audit --audit-level=moderate
```

> **Note:** `npm ci` (not `npm install`) is recommended. It installs from the lockfile exactly, preventing silent dependency drift.

---

## Development

```bash
npm run dev
```

Opens the Vite dev server at `http://localhost:5173` with HMR. The WebGL canvas will render a default test card on startup.

```bash
npm run typecheck   # TypeScript type checking (no emit)
npm run lint        # ESLint with TypeScript rules
```

---

## Build for Production

```bash
npm run build
npm run preview     # Serves the dist/ folder locally to verify
```

The production build outputs to `dist/`. It is a fully static bundle with no server-side runtime requirement. Deploy to any static host (GitHub Pages, Netlify, Vercel, S3+CloudFront).

---

## Contributing

Contributions are welcome. Please follow these guidelines to keep the codebase healthy:

1. **Open an issue first** for non-trivial features or refactors so the approach can be discussed before implementation.
2. **Fork and branch** -- create a feature branch from `main` (`feature/your-feature-name`).
3. **Code standards:**
   - All new code must be TypeScript with strict mode enabled.
   - GLSL shaders live in `src/engine/shaders/` with a `.glsl` extension and a matching `.d.ts` type declaration.
   - No `any` types without a documented justification comment.
4. **Security:** Any change that touches media parsing, string evaluation, Worker creation, or CSP must include an updated threat-model note in the PR description.
5. **Tests:** Add unit tests for any new utility functions in `src/utils/`.
6. **Commit style:** Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, `chore:`).
7. **Pull request:** Target `main`. Describe what changed and why. Link to the related issue.

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

---

## Roadmap

| Phase | Milestone | Status |
|---|---|---|
| 1 | Repository scaffolding, license, docs | Complete |
| 2 | WebGL engine: GlyphAtlas, EdgeFBO, CharacterFBO | In Progress |
| 3 | Media sources: Image, GIF, MP4, Webcam | Planned |
| 4 | React UI: ControlPanel, MediaUploader, PresetSelector | Planned |
| 5 | Math shader mode with sandboxed Worker | Planned |
| 6 | Export (PNG, raw text), performance overlay | Planned |
| 7 | Visual node-graph editor for shader composition | Future |

---

## Credits

**Author:** Sunil Gentyala  
**GitHub:** [github.com/sunilgentyala](https://github.com/sunilgentyala)  
**IEEE:** sunil.gentyala@ieee.org

AuraASCII was designed and implemented by Sunil Gentyala as an open-source contribution to the generative art and creative coding community.

Inspired by the landscape of ASCII art tools including Oxide's Mitos, with a focus on GPU-accelerated rendering and a security-first architecture.

---

## License

[MIT](LICENSE) -- Copyright (c) 2026 Sunil Gentyala
