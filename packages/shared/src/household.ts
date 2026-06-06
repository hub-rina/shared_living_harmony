import { z } from 'zod';
import { HouseholdRoleSchema } from './membership';

// Single source of truth for the 5 harmony bands. Used by the
// HarmonyService, the Energy Core 3D state map, the dashboard mood card,
// and the landlord property health bar. Mood label, color, and Energy
// Core motion parameters all live here — change once, propagate everywhere.
// Labels follow the supportive Tense → Unstable → Calm → Stable →
// Harmonized progression — no shaming language for houses near the floor.
export const HARMONY_BANDS = [
  { max: 20,  mood: 'Tense',      color: '#c2362e', emissive: '#ff5a48', speed: 2.2,  noise: 0.55 },
  { max: 40,  mood: 'Unstable',   color: '#e07a2a', emissive: '#f59a3e', speed: 1.5,  noise: 0.35 },
  { max: 60,  mood: 'Calm',       color: '#d6a13f', emissive: '#f0c25a', speed: 0.9,  noise: 0.18 },
  { max: 85,  mood: 'Stable',     color: '#7fa888', emissive: '#9ec7a0', speed: 0.45, noise: 0.04 },
  { max: 100, mood: 'Harmonized', color: '#4d6e51', emissive: '#7faa72', speed: 0.22, noise: 0.0  },
] as const;

export type HarmonyBand = (typeof HARMONY_BANDS)[number];
export type HarmonyMoodLabel = HarmonyBand['mood'];

export function harmonyBand(score: number): HarmonyBand {
  for (const band of HARMONY_BANDS) {
    if (score <= band.max) return band;
  }
  // Unreachable for any score in [0, 100], but TS needs an explicit fallback.
  return HARMONY_BANDS[4];
}

export function harmonyMood(score: number): HarmonyMoodLabel {
  return harmonyBand(score).mood;
}

// Continuous numeric state for the Energy Core. Unlike harmonyBand which
// snaps to 5 discrete buckets, this lerps every numeric parameter between
// adjacent bands so score 65 and 79 produce visibly different spheres.
// Colors are returned as raw hex; the renderer converts to THREE.Color.
export interface HarmonyState {
  mood: HarmonyMoodLabel;
  color: string;
  emissive: string;
  speed: number;
  noise: number;
  t01: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpHex(a: string, b: string, t: number): string {
  const ai = parseInt(a.slice(1), 16);
  const bi = parseInt(b.slice(1), 16);
  const ar = (ai >> 16) & 0xff;
  const ag = (ai >> 8) & 0xff;
  const ab = ai & 0xff;
  const br = (bi >> 16) & 0xff;
  const bg = (bi >> 8) & 0xff;
  const bb = bi & 0xff;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

export function harmonyState(score: number): HarmonyState {
  const clamped = Math.max(0, Math.min(100, score));
  let lowMax = 0;
  let lowIdx = 0;
  for (let i = 0; i < HARMONY_BANDS.length; i++) {
    const band = HARMONY_BANDS[i]!;
    if (clamped <= band.max) {
      lowIdx = i;
      break;
    }
    lowMax = band.max;
  }
  const low = HARMONY_BANDS[lowIdx]!;
  const high = HARMONY_BANDS[Math.min(lowIdx + 1, HARMONY_BANDS.length - 1)]!;
  const span = low.max - lowMax || 1;
  const t = Math.max(0, Math.min(1, (clamped - lowMax) / span));
  // Blend within the current band toward the next so transitions are
  // smooth instead of stepping at band edges. Mood label stays discrete.
  return {
    mood: low.mood,
    color: lerpHex(low.color, high.color, t * 0.6),
    emissive: lerpHex(low.emissive, high.emissive, t * 0.6),
    speed: lerp(low.speed, high.speed, t),
    noise: lerp(low.noise, high.noise, t),
    t01: clamped / 100,
  };
}

export const HouseholdSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  harmonyScore: z.number().int().min(0).max(100),
  lastBloomedAt: z.string().datetime().nullable(),
  joinCode: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Household = z.infer<typeof HouseholdSchema>;

export const CreateHouseholdInputSchema = z.object({
  name: z.string().min(1).max(80),
});
export type CreateHouseholdInput = z.infer<typeof CreateHouseholdInputSchema>;

export const JoinHouseholdInputSchema = z.object({
  code: z.string().min(1).max(40),
});
export type JoinHouseholdInput = z.infer<typeof JoinHouseholdInputSchema>;

export const UpdateHouseholdInputSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});
export type UpdateHouseholdInput = z.infer<typeof UpdateHouseholdInputSchema>;

export const InviteMemberInputSchema = z.object({
  email: z.string().email(),
});
export type InviteMemberInput = z.infer<typeof InviteMemberInputSchema>;

export const LinkLandlordInputSchema = z.object({
  email: z.string().email(),
});
export type LinkLandlordInput = z.infer<typeof LinkLandlordInputSchema>;

export const ChangeMemberRoleInputSchema = z.object({
  role: HouseholdRoleSchema,
});
export type ChangeMemberRoleInput = z.infer<typeof ChangeMemberRoleInputSchema>;
