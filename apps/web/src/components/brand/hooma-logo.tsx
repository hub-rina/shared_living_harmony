type Tone = 'ink' | 'cream' | 'sage';

const TONE_COLOR: Record<Tone, string> = {
  ink: 'var(--color-ink)',
  cream: 'var(--color-cream)',
  sage: 'var(--color-sage-700)',
};

interface HoomaLogoProps {
  tone?: Tone;
  className?: string;
}

export function HoomaLogo({ tone = 'ink', className = '' }: HoomaLogoProps) {
  return (
    <span
      className={`inline-block leading-none ${className}`}
      style={{
        fontFamily: 'var(--font-fraunces), Georgia, serif',
        fontWeight: 600,
        letterSpacing: '-0.02em',
        color: TONE_COLOR[tone],
      }}
    >
      hooma
    </span>
  );
}
