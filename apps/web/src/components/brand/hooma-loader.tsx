import { HoomaLogo } from './hooma-logo';

interface HoomaLoaderProps {
  label?: string;
  className?: string;
}

const RIPPLE_DELAYS = ['0ms', '900ms', '1800ms'];
const SPARK_ANGLES = [0, 120, 240];

export function HoomaLoader({ label = 'Settling in', className = '' }: HoomaLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex min-h-dvh flex-col items-center justify-center gap-9 bg-[var(--background)] px-6 ${className}`}
    >
      <div className="relative flex h-32 w-32 items-center justify-center">
        {RIPPLE_DELAYS.map((delay) => (
          <span
            key={delay}
            aria-hidden
            style={{ animationDelay: delay }}
            className="absolute h-20 w-20 rounded-full border border-[var(--accent)]/40 motion-safe:animate-[hb-ripple_2.7s_ease-out_infinite] motion-reduce:opacity-0"
          />
        ))}

        <span
          aria-hidden
          className="absolute h-20 w-20 rounded-full motion-safe:animate-[hb-orbit_6s_linear_infinite]"
        >
          {SPARK_ANGLES.map((angle) => (
            <span
              key={angle}
              style={{ transform: `rotate(${angle}deg) translateY(-2.6rem)` }}
              className="absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-[var(--accent)]/70"
            />
          ))}
        </span>

        <span
          aria-hidden
          className="relative h-16 w-16 rounded-full bg-[radial-gradient(circle_at_32%_28%,var(--color-sage-300),var(--color-sage-700)_72%)] motion-safe:animate-[hb-breathe_2.7s_ease-in-out_infinite,hb-glow_2.7s_ease-in-out_infinite]"
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <HoomaLogo className="text-3xl" tone="sage" />
        <p className="text-sm text-[var(--text-mute)] motion-safe:animate-[hb-text-pulse_2.2s_ease-in-out_infinite]">
          {label}
          <span aria-hidden>…</span>
        </p>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
