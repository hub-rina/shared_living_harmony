import { HoomaLogo } from './hooma-logo';
import { HoomaMark } from './hooma-mark';

type Tone = 'ink' | 'cream' | 'sage';

interface HoomaLockupProps {
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MARK_PX: Record<NonNullable<HoomaLockupProps['size']>, number> = {
  sm: 22,
  md: 28,
  lg: 36,
};

const WORDMARK_CLS: Record<NonNullable<HoomaLockupProps['size']>, string> = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
};

export function HoomaLockup({
  tone = 'sage',
  size = 'md',
  className = '',
}: HoomaLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <HoomaMark tone={tone} size={MARK_PX[size]} />
      <HoomaLogo tone={tone} className={WORDMARK_CLS[size]} />
    </span>
  );
}
