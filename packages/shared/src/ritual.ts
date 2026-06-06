import { z } from 'zod';

export const RitualTypeSchema = z.enum(['meal', 'event', 'checkin', 'challenge']);
export type RitualType = z.infer<typeof RitualTypeSchema>;

export const RitualStatusSchema = z.enum(['proposed', 'completed']);
export type RitualStatus = z.infer<typeof RitualStatusSchema>;

export const RitualCadenceSchema = z.enum(['once', 'daily', 'weekly']);
export type RitualCadence = z.infer<typeof RitualCadenceSchema>;

export const RITUAL_CADENCE_LABELS: Record<RitualCadence, string> = {
  once: 'One-off',
  daily: 'Daily',
  weekly: 'Weekly',
};

export const RITUAL_TYPE_LABELS: Record<RitualType, string> = {
  meal:      'Shared Meal',
  event:     'House Event',
  checkin:   'Mood Check-in',
  challenge: 'Collective Challenge',
};

export const RITUAL_BASE_HARMONY_BONUS = 15;

export function computeRitualBonus(participantCount: number, memberCount: number): number {
  if (memberCount === 0) return 0;
  const rate = Math.min(1, participantCount / memberCount);
  return Math.round(RITUAL_BASE_HARMONY_BONUS * rate);
}

export const BLOOM_PARTICIPATION_THRESHOLD = 0.6;

export function shouldBloom(participantCount: number, memberCount: number): boolean {
  if (memberCount === 0) return false;
  return participantCount / memberCount >= BLOOM_PARTICIPATION_THRESHOLD;
}

export const RitualParticipantSchema = z.object({
  id:   z.string().uuid(),
  name: z.string(),
});
export type RitualParticipant = z.infer<typeof RitualParticipantSchema>;

export const RitualSchema = z.object({
  id:          z.string().uuid(),
  householdId: z.string().uuid(),
  type:        RitualTypeSchema,
  title:       z.string().min(1).max(120),
  proposedAt:  z.string().datetime(),
  status:      RitualStatusSchema,
  cadence:     RitualCadenceSchema,
  proposerId:  z.string().uuid(),
  completedAt: z.string().datetime().nullable(),
  participants: z.array(RitualParticipantSchema),
  createdAt:   z.string().datetime(),
});
export type Ritual = z.infer<typeof RitualSchema>;

export const CreateRitualInputSchema = z.object({
  type:        RitualTypeSchema,
  title:       z.string().min(1).max(120),
  proposedAt:  z.string().datetime(),
  cadence:     RitualCadenceSchema.optional(),
});
export type CreateRitualInput = z.infer<typeof CreateRitualInputSchema>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function ritualCadenceOffsetMs(cadence: RitualCadence): number {
  switch (cadence) {
    case 'daily': return MS_PER_DAY;
    case 'weekly': return 7 * MS_PER_DAY;
    case 'once': return 0;
  }
}

export const CompleteRitualResponseSchema = z.object({
  ritual:         RitualSchema,
  bloomTriggered: z.boolean(),
  harmonyBonus:   z.number().int(),
});
export type CompleteRitualResponse = z.infer<typeof CompleteRitualResponseSchema>;
