import type { RendererConfig } from '@engine/types';
import { DEFAULT_CHARSET }     from '@engine/types';
import type { Preset }         from '@data/presets';
import { Slider }              from '@components/ui/Slider';
import { ColorInput }          from '@components/ui/ColorInput';
import { PresetSelector }      from '@components/PresetSelector';
import { ShaderEditor }        from '@components/ShaderEditor';

// ─────────────────────────────────────────────────────────────────────────────
// Internal layout helpers
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-800 py-4 last:border-0">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ControlRow({
  label,
  value,
  children,
}: {
  label:    string;
  value?:   string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-xs text-zinc-400">{label}</span>
        {value !== undefined && (
          <span className="font-mono text-xs tabular-nums text-zinc-600">{value}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ControlPanel
// ─────────────────────────────────────────────────────────────────────────────

interface ControlPanelProps {
  config:         RendererConfig;
  activePreset:   string | null;
  onConfigChange: (patch: Partial<RendererConfig>) => void;
  onPresetSelect: (preset: Preset) => void;
  onMathApply:    (source: string) => void;
  mathActive:     boolean;
}

export function ControlPanel({
  config,
  activePreset,
  onConfigChange,
  onPresetSelect,
  onMathApply,
  mathActive,
}: ControlPanelProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-hidden border-l border-zinc-800 bg-zinc-950">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 scrollbar-thin">

        {/* ── Presets ─────────────────────────────────────────────────── */}
        <Section title="Presets">
          <PresetSelector activeId={activePreset} onSelect={onPresetSelect} />
        </Section>

        {/* ── Edge Detection ──────────────────────────────────────────── */}
        <Section title="Edge Detection">
          <ControlRow
            label="Edge Weight"
            value={config.edgeWeight.toFixed(2)}
          >
            <Slider
              label="Edge weight"
              value={config.edgeWeight}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => onConfigChange({ edgeWeight: v })}
            />
          </ControlRow>

          <ControlRow
            label="Contrast"
            value={config.contrast.toFixed(2)}
          >
            <Slider
              label="Contrast"
              value={config.contrast}
              min={0.5}
              max={3}
              step={0.05}
              onChange={(v) => onConfigChange({ contrast: v })}
            />
          </ControlRow>
        </Section>

        {/* ── Grid ────────────────────────────────────────────────────── */}
        <Section title="Grid">
          <ControlRow label="Cell Size" value={`${config.cellSize}px`}>
            <Slider
              label="Cell size"
              value={config.cellSize}
              min={4}
              max={24}
              step={1}
              onChange={(v) => onConfigChange({ cellSize: v })}
            />
          </ControlRow>

          <ControlRow label="Font Size" value={`${config.fontSize}px`}>
            <Slider
              label="Font size"
              value={config.fontSize}
              min={6}
              max={24}
              step={1}
              onChange={(v) => onConfigChange({ fontSize: v })}
            />
          </ControlRow>
        </Section>

        {/* ── Colors ──────────────────────────────────────────────────── */}
        <Section title="Colors">
          <ControlRow label="Foreground">
            <ColorInput
              value={config.fgColor}
              onChange={(v) => onConfigChange({ fgColor: v })}
            />
          </ControlRow>
          <ControlRow label="Background">
            <ColorInput
              value={config.bgColor}
              onChange={(v) => onConfigChange({ bgColor: v })}
            />
          </ControlRow>
        </Section>

        {/* ── Charset ─────────────────────────────────────────────────── */}
        <Section title="Character Set">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-mono text-xs text-zinc-400">Dense → Sparse</span>
              <span className="font-mono text-xs text-zinc-600">
                {config.charset.length} chars
              </span>
            </div>
            <textarea
              value={config.charset}
              onChange={(e) => {
                const v = e.target.value;
                if (v.length > 0) onConfigChange({ charset: v });
              }}
              maxLength={255}
              rows={3}
              spellCheck={false}
              autoComplete="off"
              className={[
                'w-full resize-none rounded border border-zinc-700 bg-zinc-900',
                'px-2 py-1.5 font-mono text-xs leading-relaxed text-zinc-300',
                'placeholder-zinc-700 outline-none transition-colors',
                'focus:border-terminal-green/50',
              ].join(' ')}
              placeholder="@#%?*+;:,. "
            />
            <button
              onClick={() => onConfigChange({ charset: DEFAULT_CHARSET })}
              className="mt-1.5 font-mono text-[10px] text-zinc-700 transition-colors hover:text-zinc-400"
            >
              reset to default
            </button>
          </div>
        </Section>

        {/* ── Math Mode ───────────────────────────────────────────────── */}
        <Section title="Math Mode">
          <ShaderEditor onApply={onMathApply} mathActive={mathActive} />
        </Section>

      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-2.5">
        <p className="text-center font-mono text-[10px] text-zinc-700">
          AuraASCII v0.1.0 · Sunil Gentyala · MIT
        </p>
      </div>
    </aside>
  );
}
