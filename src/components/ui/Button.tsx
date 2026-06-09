import { forwardRef } from 'react';
import { cn } from '@lib/utils';

type Variant = 'default' | 'ghost' | 'outline' | 'active';
type Size    = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?:    Size;
}

const variants: Record<Variant, string> = {
  default: 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100',
  ghost:   'border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
  outline: 'border-terminal-green text-terminal-green hover:bg-terminal-green/10',
  active:  'border-terminal-green/50 bg-terminal-green/10 text-terminal-green',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'sm', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded border font-mono transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terminal-green',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
