import type { CSSProperties } from 'react';

type Scene =
  | 'relaxing-at-home'
  | 'checklist'
  | 'home-run'
  | 'eating-together'
  | 'house-searching'
  | 'profile-pic'
  | 'empty';

interface UndrawProps {
  scene: Scene;
  alt?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_ALT: Record<Scene, string> = {
  'relaxing-at-home':  'Person relaxing at home.',
  'checklist':         'A checklist.',
  'home-run':          'Someone celebrating a finish.',
  'eating-together':   'People sharing a meal at a table.',
  'house-searching':   'Looking for a home.',
  'profile-pic':       'A profile portrait placeholder.',
  'empty':             'An empty workspace.',
};

export function Undraw({ scene, alt, size = 200, className, style }: UndrawProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/illustrations/${scene}.svg`}
      alt={alt ?? DEFAULT_ALT[scene]}
      width={size}
      height={size}
      className={className}
      style={{ maxWidth: '100%', height: 'auto', ...style }}
      loading="lazy"
      decoding="async"
    />
  );
}

export function PeepChilling({ size, className }: { size?: number; className?: string }) {
  return <Undraw scene="relaxing-at-home" size={size} className={className} />;
}
export function BroomAtRest({ size, className }: { size?: number; className?: string }) {
  return <Undraw scene="checklist" size={size} className={className} />;
}
export function TableForTwo({ size, className }: { size?: number; className?: string }) {
  return <Undraw scene="eating-together" size={size} className={className} />;
}
export function LittleHouse({ size, className }: { size?: number; className?: string }) {
  return <Undraw scene="house-searching" size={size} className={className} />;
}
export function PaperPlane({ size, className }: { size?: number; className?: string }) {
  return <Undraw scene="home-run" size={size} className={className} />;
}
export function FlaggedDone({ size, className }: { size?: number; className?: string }) {
  return <Undraw scene="checklist" size={size} className={className} />;
}
