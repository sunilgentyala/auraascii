import { PRESETS } from '@data/presets';
import type { Preset } from '@data/presets';
import { cn } from '@lib/utils';

interface PresetSelectorProps {
  activeId:  string | null;
  onSelect:  (preset: Preset) => void;
}

export function PresetSelector({ activeId, onSelect }: PresetSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {PRESETS.map((preset) => {
        const isActive = activeId === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className={cn(
              'flex items-center gap-1.5 rounded border px-2 py-1.5',
              'text-left font-mono text-xs transition-colors',
              isActive
                ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
            )}
          >
            {/* Colour dot */}
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: preset.dot }}
              aria-hidden="true"
            />
            {preset.name}
          </button>
        );
      })}
    </div>
  );
}
