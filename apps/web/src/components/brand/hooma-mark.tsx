type Tone = 'ink' | 'cream' | 'sage';

const TONE_COLOR: Record<Tone, string> = {
  ink: 'var(--color-ink)',
  cream: 'var(--color-cream)',
  sage: 'var(--color-sage-700)',
};

interface HoomaMarkProps {
  tone?: Tone;
  size?: number;
  className?: string;
  title?: string;
}

export function HoomaMark({
  tone = 'sage',
  size = 32,
  className = '',
  title = 'hooma',
}: HoomaMarkProps) {
  const color = TONE_COLOR[tone];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
    >
      <circle cx="50" cy="50" r="10" fill={color} />
      <circle cx="50" cy="50" r="24" fill="none" stroke={color} strokeWidth="6" />
      <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="4" />
    </svg>
  );
}
