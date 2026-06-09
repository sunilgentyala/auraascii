/// <reference types="vite/client" />

// Typed GLSL module imports — handled by the inline glsl-loader plugin in vite.config.ts
declare module '*.glsl' {
  const src: string;
  export default src;
}
