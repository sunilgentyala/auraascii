import { cn } from '@lib/utils';

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn('text-xs font-mono text-zinc-400 select-none', className)}
      {...props}
    />
  );
}
