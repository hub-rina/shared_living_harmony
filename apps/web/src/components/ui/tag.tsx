import type { HTMLAttributes } from 'react';
import type { HarmonyMoodLabel } from '@homebuddy/shared';

type Tone =
  | 'neutral'
  | 'sage'
  | 'completed'
  | 'overdue'
  | 'pending'
  | 'reactive'
  | 'light'
  | 'heavy';

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: 'sm' | 'md';
}

const TONES: Record<Tone, string> = {
  neutral:   'bg-[var(--surface-raised)] text-[var(--text-mute)]',
  sage:      'bg-[var(--accent-wash)] text-[var(--accent-hover)]',
  completed: 'bg-[color:var(--color-mood-stable-wash)] text-[color:var(--mood-stable-fg)]',
  overdue:   'bg-[color:var(--color-mood-tense-wash)] text-[color:var(--mood-tense-fg)]',
  pending:   'bg-[var(--surface-raised)] text-[var(--text-mute)]',
  reactive:  'bg-[color:var(--color-mood-unstable-wash)] text-[color:var(--mood-unstable-fg)]',
  light:     'bg-[color:var(--color-mood-stable-wash)] text-[color:var(--mood-stable-fg)]',
  heavy:     'bg-[color:var(--color-mood-calm-wash)] text-[color:var(--mood-calm-fg)]',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
} as const;

export function Tag({ tone = 'neutral', size = 'md', className = '', ...rest }: TagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium tracking-tight ${TONES[tone]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}

export function moodTone(mood: HarmonyMoodLabel): Tone {
  switch (mood) {
    case 'Tense':      return 'overdue';
    case 'Unstable':   return 'reactive';
    case 'Calm':       return 'heavy';
    case 'Stable':     return 'light';
    case 'Harmonized': return 'completed';
  }
}
