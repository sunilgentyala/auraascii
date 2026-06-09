import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@lib/utils';

interface SliderProps {
  value:      number;
  min:        number;
  max:        number;
  step:       number;
  onChange:   (value: number) => void;
  label?:     string;
  className?: string;
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  className,
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(vals) => onChange(vals[0])}
      className={cn(
        'relative flex w-full touch-none select-none items-center py-1',
        className,
      )}
    >
      <SliderPrimitive.Track className="relative h-[2px] w-full grow overflow-hidden rounded-full bg-zinc-700">
        <SliderPrimitive.Range className="absolute h-full bg-terminal-green" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className={cn(
          'block h-3 w-3 rounded-full border border-terminal-green bg-zinc-900 shadow',
          'transition-colors focus-visible:outline-none focus-visible:ring-1',
          'focus-visible:ring-terminal-green focus-visible:ring-offset-1',
          'focus-visible:ring-offset-zinc-950',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        )}
      />
    </SliderPrimitive.Root>
  );
}
