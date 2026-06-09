import { useCallback, useEffect, useRef, useState } from 'react';

// ?worker&inline makes Vite embed the worker script as a blob URL (null origin).
// The worker cannot reach document, window, localStorage, or cookies.
import ShaderWorkerCtor from '../workers/shader.worker.ts?worker&inline';

const MAX_LEN = 256;

const EXAMPLES: { label: string; expr: string }[] = [
  { label: 'Ripple',    expr: 'sin(length(uv - 0.5) * 30.0 - uTime * 4.0) * 0.5 + 0.5' },
  { label: 'Plasma',    expr: 'sin(uv.x * 10.0 + uTime) * cos(uv.y * 10.0 + uTime) * 0.5 + 0.5' },
  { label: 'Checks',   expr: 'mod(floor(uv.x * 8.0) + floor(uv.y * 8.0), 2.0)' },
  { label: 'Noise',     expr: 'fract(sin(dot(uv, vec2(127.1, 311.7))) * 43758.5)' },
  { label: 'Gradient',  expr: 'uv.x' },
];

type Status = 'idle' | 'pending' | 'valid' | 'invalid';

type WorkerMsg =
  | { type: 'result'; id: string; ok: true;  source: string }
  | { type: 'result'; id: string; ok: false; error: string };

interface ShaderEditorProps {
  onApply:    (source: string) => void;
  mathActive: boolean;
}

export function ShaderEditor({ onApply, mathActive }: ShaderEditorProps) {
  const workerRef    = useRef<Worker | null>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestIdRef  = useRef('');
  const pendingRef   = useRef('');

  const [expr,   setExpr]   = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error,  setError]  = useState('');

  useEffect(() => {
    const w = new ShaderWorkerCtor();
    w.addEventListener('message', (e: MessageEvent<WorkerMsg>) => {
      const d = e.data;
      if (d.id !== latestIdRef.current) return; // stale response
      if (d.ok) {
        pendingRef.current = d.source;
        setStatus('valid');
        setError('');
      } else {
        pendingRef.current = '';
        setStatus('invalid');
        setError(d.error);
      }
    });
    workerRef.current = w;
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const scheduleValidation = useCallback((value: string) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (value.trim().length === 0) { setStatus('idle'); return; }
    setStatus('pending');
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const id = String(Date.now());
      latestIdRef.current = id;
      workerRef.current?.postMessage({ type: 'validate', id, expr: value });
    }, 300);
  }, []);

  const handleChange = useCallback(
    (value: string) => { setExpr(value); scheduleValidation(value); },
    [scheduleValidation],
  );

  const handleApply = useCallback(() => {
    if (pendingRef.current) onApply(pendingRef.current);
  }, [onApply]);

  const statusLabel =
    status === 'valid'   ? '// valid' :
    status === 'invalid' ? '// error' :
    status === 'pending' ? '// ...'   : '';

  const statusCls =
    status === 'valid'   ? 'text-terminal-green' :
    status === 'invalid' ? 'text-terminal-red'   :
    status === 'pending' ? 'text-terminal-amber'  : 'text-zinc-600';

  return (
    <div className="space-y-3">
      {/* Example chips */}
      <div className="flex flex-wrap gap-1">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => handleChange(ex.expr)}
            className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Expression input */}
      <div className="relative">
        <textarea
          value={expr}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={MAX_LEN}
          rows={3}
          spellCheck={false}
          placeholder="sin(uv.x * 10.0 + uTime) * 0.5 + 0.5"
          className="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-200 placeholder-zinc-600 focus:border-terminal-green/60 focus:outline-none"
        />
        <span className={`absolute bottom-2 right-2 font-mono text-[9px] select-none ${statusCls}`}>
          {statusLabel || `${MAX_LEN - expr.length}`}
        </span>
      </div>

      {/* Validation error */}
      {status === 'invalid' && error && (
        <p className="font-mono text-[10px] leading-snug text-terminal-red">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleApply}
          disabled={status !== 'valid'}
          className="flex-1 rounded border border-terminal-green/40 px-2 py-1 font-mono text-xs text-terminal-green transition-colors hover:border-terminal-green hover:bg-terminal-green/5 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-600"
        >
          Apply
        </button>
        {mathActive && (
          <span className="shrink-0 font-mono text-[10px] text-terminal-green">
            &#9679; active
          </span>
        )}
      </div>

      {/* Template hint */}
      <p className="font-mono text-[9px] leading-snug text-zinc-700">
        float expression · vars: uv (vec2 0-1), uTime (float seconds)
      </p>
    </div>
  );
}
