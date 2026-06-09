// ColorInput — a styled colour swatch that opens the native OS colour picker
// on click.  The actual <input type="color"> is invisible (opacity-0) but
// sits on top of the visible swatch so it intercepts pointer events.
// This avoids CSP issues with custom colour-picker libraries while keeping
// the terminal aesthetic intact.

interface ColorInputProps {
  value:    string;
  onChange: (value: string) => void;
}

export function ColorInput({ value, onChange }: ColorInputProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 select-none">
      {/* Visible swatch */}
      <span
        className="relative h-5 w-5 shrink-0 overflow-hidden rounded border border-zinc-600"
        style={{ backgroundColor: value }}
      >
        {/* Transparent native picker overlaid on the swatch */}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Pick colour"
        />
      </span>
      <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
        {value}
      </span>
    </label>
  );
}
