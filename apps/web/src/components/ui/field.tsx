import { Eye, EyeSlash } from '@phosphor-icons/react';
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-[var(--text-mute)]">
        {label}
        {required && <span aria-hidden className="ml-1 text-[var(--color-state-danger)]">*</span>}
      </label>
      {children(id, describedBy)}
      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--text-soft)]">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-[var(--color-state-danger)]" role="alert">{error}</p>
      )}
    </div>
  );
}

const CONTROL =
  'min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--text-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:border-[var(--accent)] disabled:opacity-50';

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;
type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function TextInput({ className = '', ...rest }: TextInputProps) {
  return <input className={`${CONTROL} ${className}`} {...rest} />;
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function PasswordInput({ className = '', ...rest }: PasswordInputProps) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="relative">
      <input
        type={revealed ? 'text' : 'password'}
        className={`${CONTROL} w-full pr-11 ${className}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        aria-pressed={revealed}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[var(--text-soft)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {revealed ? <EyeSlash size={18} weight="bold" aria-hidden /> : <Eye size={18} weight="bold" aria-hidden />}
      </button>
    </div>
  );
}

export function Select({ className = '', ...rest }: SelectProps) {
  return <select className={`${CONTROL} ${className}`} {...rest} />;
}
