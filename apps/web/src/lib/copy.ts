import type { HarmonyMoodLabel } from '@homebuddy/shared';

/**
 * Centralized product copy for the resident-facing app surfaces.
 *
 * Tone (PRODUCT.md): a calm flatmate, not a productivity coach. Encourages
 * without nagging. Status words are relational, not accusatory — an unfinished
 * chore "needs a hand", it has not "failed".
 */

export const taskStatusCopy = {
  needsHand: 'Needs a hand',
  done: 'Sorted',
} as const;

export function dueLabel(formattedDate: string, isOverdue: boolean): string {
  return isOverdue ? `Due ${formattedDate} · needs a hand` : `Due ${formattedDate}`;
}

export const choresVsRituals =
  'Chores are the everyday upkeep that rotates fairly between you. Rituals are the slower, shared moments — a meal, a check-in, a challenge — that turn a household into a home.';

/**
 * One-tap prompts for the flag-a-mess flow. Framed as the space needing care,
 * never a person being at fault — flagging should feel like a nudge, not a
 * call-out.
 */
export const flagPrompts = [
  'Kitchen needs a reset',
  'Dishes piling up',
  'Bathroom could use a clean',
  'Bins need taking out',
  'Living room could use a tidy',
  'Floor needs a sweep',
] as const;

/**
 * Plain-English explainer for Smart Rotation, mirroring the scoring in
 * apps/api/src/tasks/smart-rotation.service.ts. Tone stays a calm flatmate:
 * the point is fairness and easing people in, never scorekeeping or blame.
 */
export const smartRotation = {
  title: 'How Smart Rotation works',
  intro:
    'Smart Rotation shares chores fairly, so the same person never quietly ends up doing everything.',
  points: [
    'Every chore is worth points — a heavy one counts for more than a light one.',
    'Over the last 30 days we tally what each housemate has done, plus what they are already on the hook for.',
    'A new chore goes to whoever has carried the least lately.',
    'If two people are even, it goes to whoever has waited longest for a turn — and a brand-new housemate is eased in first.',
    'Heavy chores skip whoever did that exact one last time, so no one is stuck with the worst job twice in a row.',
  ],
  outro: 'No scorekeeping to manage. Just keep showing up and it stays even on its own.',
} as const;

/**
 * Copy for the Energy Core readout. The orb is abstract, so these two lines do
 * the explaining the sphere itself cannot: the heading names what the orb IS,
 * and the cause turns its colour and motion into one plain sentence the house
 * can act on. Tone stays a calm flatmate — chores "wait" or "need a hand",
 * never a person who is "late" or "behind".
 */
export function harmonyHeading(householdName: string): string {
  return `${householdName}'s mood`;
}

interface HarmonyContext {
  mood: HarmonyMoodLabel;
  overdueCount: number;
  hasHeavyOverdue: boolean;
  bloomActive: boolean;
}

export function harmonyCause({
  mood,
  overdueCount,
  hasHeavyOverdue,
  bloomActive,
}: HarmonyContext): string {
  if (bloomActive) return 'Everyone showed up. That is what makes it glow.';
  if (hasHeavyOverdue) {
    return 'A chore has been waiting a while, and the house feels it. A hand there lifts the orb.';
  }
  if (overdueCount === 1) return 'One chore needs a hand. Sorting it brightens the orb.';
  if (overdueCount > 1) {
    return `${overdueCount} chores need a hand. Sorting them brightens the orb.`;
  }
  if (mood === 'Tense' || mood === 'Unstable') {
    return 'Nothing is waiting right now. A few finished chores will warm it up.';
  }
  return 'Everyone is keeping up, and nothing is waiting.';
}
