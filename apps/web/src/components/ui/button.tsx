import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold tracking-tight transition-[transform,background-color,opacity] duration-200 [transition-timing-function:var(--ease-spring)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:ring-[var(--focus-ring)]';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-cream hover:bg-[var(--accent-hover)] active:bg-[var(--accent-hover)]',
  secondary:
    'border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--foreground)] hover:bg-[var(--surface-deep)]',
  ghost:
    'text-[var(--foreground)] hover:bg-[var(--surface-raised)]',
  danger:
    'bg-[var(--color-state-danger)] text-cream hover:opacity-90',
  warning:
    'bg-[var(--color-mood-unstable)] text-cream hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  );
});
