// CanvasHost — wraps the WebGL canvas in a ResizeObserver so AsciiRenderer
// always knows the exact CSS pixel dimensions of its container.
// The canvas element ref is forwarded to the parent (App.tsx) so the
// renderer can be constructed against it directly.

import { forwardRef, useEffect, useRef } from 'react';

interface CanvasHostProps {
  /** Called whenever the container's CSS pixel dimensions change. */
  onResize: (width: number, height: number) => void;
}

export const CanvasHost = forwardRef<HTMLCanvasElement, CanvasHostProps>(
  ({ onResize }, canvasRef) => {
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;

      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) onResize(Math.floor(width), Math.floor(height));
      });

      observer.observe(el);
      // Fire once immediately so the renderer is sized on mount
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) onResize(Math.floor(width), Math.floor(height));

      return () => observer.disconnect();
    }, [onResize]);

    return (
      <div ref={wrapperRef} className="w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          aria-label="AuraASCII WebGL rendering canvas"
        />
      </div>
    );
  },
);
CanvasHost.displayName = 'CanvasHost';
