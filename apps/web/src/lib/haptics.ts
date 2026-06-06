// Soft haptic feedback for PWA mobile. No-ops on unsupported devices/desktops.
type HapticPattern = 'tap' | 'success' | 'bloom';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 12,
  success: [10, 40, 18],
  // A collective "sigh / heartbeat" for shared wins.
  bloom: [14, 60, 14, 60, 26],
};

export function haptic(pattern: HapticPattern = 'tap'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Vibration can throw if the document isn't focused; ignore.
  }
}
