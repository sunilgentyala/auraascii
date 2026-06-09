import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Clipboard, Download, FolderOpen, SlidersHorizontal } from 'lucide-react';

import { AsciiRenderer }           from '@engine/AsciiRenderer';
import { createDebugTexture }      from '@engine/debugTexture';
import { DEFAULT_RENDERER_CONFIG } from '@engine/types';
import type { RendererConfig }     from '@engine/types';

import type { BaseSource }         from '@sources/BaseSource';
import { ImageSource }             from '@sources/ImageSource';
import { GifSource }               from '@sources/GifSource';
import { VideoSource }             from '@sources/VideoSource';
import { MathSource }              from '@sources/MathSource';

import { detectMediaCategory }     from '@utils/sanitize';
import { cn }                      from '@lib/utils';

import { CanvasHost }              from '@components/CanvasHost';
import { ControlPanel }            from '@components/ControlPanel';

import type { Preset }             from '@data/presets';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rendererRef  = useRef<AsciiRenderer | null>(null);
  const sourceRef    = useRef<BaseSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig]             = useState<RendererConfig>(DEFAULT_RENDERER_CONFIG);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [panelOpen, setPanelOpen]       = useState(true);
  const [loadState, setLoadState]       = useState<LoadState>('idle');
  const [statusMsg, setStatusMsg]       = useState<string>('');
  const [isDragOver, setIsDragOver]     = useState(false);
  const [mathActive, setMathActive]     = useState(false);
  const [fps, setFps]                   = useState<number | null>(null);

  // ── Renderer bootstrap ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const renderer = new AsciiRenderer(canvas, DEFAULT_RENDERER_CONFIG);
    const debugTex = createDebugTexture(512, 512);
    renderer.setSourceTexture(debugTex);
    renderer.startLoop(undefined, setFps);
    rendererRef.current = renderer;

    return () => {
      renderer.stopLoop();
      renderer.dispose();
      debugTex.dispose();
      sourceRef.current?.dispose();
    };
  }, []);

  // ── Config sync ────────────────────────────────────────────────────────
  const updateConfig = useCallback((patch: Partial<RendererConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setActivePreset(null); // manual tweak deselects preset highlight
    rendererRef.current?.updateConfig(patch);
  }, []);

  const applyPreset = useCallback((preset: Preset) => {
    setActivePreset(preset.id);
    setConfig((prev) => ({ ...prev, ...preset.config }));
    rendererRef.current?.updateConfig(preset.config);
  }, []);

  // ── Resize ─────────────────────────────────────────────────────────────
  const handleResize = useCallback((w: number, h: number) => {
    rendererRef.current?.resize(w, h);
  }, []);

  // ── Source lifecycle ───────────────────────────────────────────────────
  const loadSource = useCallback(
    async (factory: () => Promise<BaseSource>, label: string) => {
      setLoadState('loading');
      setStatusMsg('Loading…');
      try {
        const next = await factory();
        await next.start();

        // Tear down the previous source only after the new one is live
        const prev = sourceRef.current;
        prev?.stop();
        prev?.dispose();
        sourceRef.current = next;

        rendererRef.current?.setSourceTexture(next.texture);
        rendererRef.current?.stopLoop();
        rendererRef.current?.startLoop(() => sourceRef.current?.tick(), setFps);

        setLoadState('ready');
        setStatusMsg(label);
      } catch (err) {
        setLoadState('error');
        setStatusMsg(err instanceof Error ? err.message : 'Failed to load media.');
      }
    },
    [],
  );

  // ── File handling ──────────────────────────────────────────────────────
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const file     = files[0];
      const category = detectMediaCategory(file);

      if (!category) {
        setLoadState('error');
        setStatusMsg(`Unsupported format: ${file.type || 'unknown'}`);
        return;
      }

      setMathActive(false);
      void loadSource(async () => {
        switch (category) {
          case 'image': return ImageSource.fromFile(file);
          case 'gif':   return GifSource.fromFile(file);
          case 'video': return VideoSource.fromFile(file);
        }
      }, file.name);
    },
    [loadSource],
  );

  const handleWebcam = useCallback(
    () => {
      setMathActive(false);
      void loadSource(() => VideoSource.fromWebcam(), 'Live webcam');
    },
    [loadSource],
  );

  const handleMathApply = useCallback(
    (glslSource: string) => {
      // If a MathSource is already active, hot-swap its shader instead of creating a new one.
      const current = sourceRef.current;
      if (current instanceof MathSource) {
        const err = current.setShader(glslSource);
        if (err) {
          setLoadState('error');
          setStatusMsg(`Shader error: ${err.split('\n')[0]}`);
        } else {
          setLoadState('ready');
          setStatusMsg('Math shader updated');
        }
        return;
      }
      setMathActive(true);
      void loadSource(async () => MathSource.create(glslSource), 'Math shader');
    },
    [loadSource],
  );

  // ── Export / copy ─────────────────────────────────────────────────────
  const handleExportPng = useCallback(async () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render(); // ensure latest frame is in the preserved buffer
    const blob = await renderer.exportPng();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `auraascii-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleCopyText = useCallback(async () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render();
    const text = renderer.generateAsciiText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setLoadState('ready');
      setStatusMsg('ASCII copied to clipboard');
    } catch {
      setLoadState('error');
      setStatusMsg('Clipboard access denied');
    }
  }, []);

  // ── Drag-and-drop ──────────────────────────────────────────────────────
  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const onDragLeave = useCallback(() => setIsDragOver(false), []);
  const onDrop      = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files); },
    [handleFiles],
  );

  // ── Derived UI state ───────────────────────────────────────────────────
  const statusColor =
    loadState === 'error'   ? 'text-terminal-red'   :
    loadState === 'loading' ? 'text-terminal-amber'  :
    loadState === 'ready'   ? 'text-terminal-green'  :
                              'text-zinc-600';

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-zinc-950"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-800 px-4 select-none">
        <span className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-terminal-green">
          AuraASCII
        </span>

        {/* Status */}
        <span className={cn('flex-1 truncate font-mono text-xs', statusColor)}>
          {statusMsg || 'Drop a file or use the buttons to load media'}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Open image, GIF, or video (PNG · JPG · WebP · GIF · MP4 · WebM)"
            className="flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1 font-mono text-xs text-zinc-300 transition-colors hover:border-terminal-green hover:text-terminal-green"
          >
            <FolderOpen size={11} strokeWidth={1.8} />
            Open
          </button>

          <button
            onClick={handleWebcam}
            title="Stream live webcam (requires HTTPS)"
            className="flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1 font-mono text-xs text-zinc-300 transition-colors hover:border-terminal-cyan hover:text-terminal-cyan"
          >
            <Camera size={11} strokeWidth={1.8} />
            Webcam
          </button>

          <button
            onClick={() => void handleExportPng()}
            title="Export current frame as PNG"
            className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-200"
          >
            <Download size={11} strokeWidth={1.8} />
          </button>

          <button
            onClick={() => void handleCopyText()}
            title="Copy ASCII text to clipboard"
            className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-200"
          >
            <Clipboard size={11} strokeWidth={1.8} />
          </button>

          <button
            onClick={() => setPanelOpen((p) => !p)}
            title="Toggle control panel"
            className={cn(
              'flex items-center rounded border px-2.5 py-1 font-mono text-xs transition-colors',
              panelOpen
                ? 'border-terminal-green/40 text-terminal-green'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300',
            )}
          >
            <SlidersHorizontal size={11} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">

        {/* Canvas area */}
        <div className="relative min-w-0 flex-1">
          <CanvasHost ref={canvasRef} onResize={handleResize} />

          {/* Drag-over overlay */}
          {isDragOver && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-terminal-green bg-black/60">
              <span className="font-mono text-xl tracking-[0.4em] text-terminal-green">
                DROP TO LOAD
              </span>
            </div>
          )}

          {/* FPS overlay */}
          {fps !== null && (
            <div className="pointer-events-none absolute left-2 top-2 font-mono text-[10px] tabular-nums text-zinc-700 select-none">
              {fps} fps
            </div>
          )}

          {/* Decoding overlay */}
          {loadState === 'loading' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="animate-pulse font-mono text-sm tracking-widest text-terminal-amber">
                DECODING…
              </span>
            </div>
          )}
        </div>

        {/* Control panel — slides in/out via conditional render */}
        {panelOpen && (
          <ControlPanel
            config={config}
            activePreset={activePreset}
            onConfigChange={updateConfig}
            onPresetSelect={applyPreset}
            onMathApply={handleMathApply}
            mathActive={mathActive}
          />
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
