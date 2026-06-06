import { z } from 'zod';

export const ChurnRiskSchema = z.enum(['low', 'medium', 'high']);
export type ChurnRisk = z.infer<typeof ChurnRiskSchema>;

// A landlord relationship is optional and tenant-consented. Mode describes the landlord's
// involvement; data is shared only while consent is granted. See docs/research/survey-findings.md.
export const LandlordModeSchema = z.enum(['observer', 'caretaker']);
export type LandlordMode = z.infer<typeof LandlordModeSchema>;

export const LANDLORD_MODE_LABELS: Record<LandlordMode, string> = {
  observer: 'Observer',
  caretaker: 'Caretaker',
};

export const UpdateLandlordLinkInputSchema = z
  .object({
    mode: LandlordModeSchema.optional(),
    consentGranted: z.boolean().optional(),
  })
  .refine((value) => value.mode !== undefined || value.consentGranted !== undefined, {
    message: 'Provide mode or consentGranted',
  });
export type UpdateLandlordLinkInput = z.infer<typeof UpdateLandlordLinkInputSchema>;

export const CHURN_RISK_LABELS: Record<ChurnRisk, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
};

export function computeChurnRisk(harmonyScore: number, overdueCount: number): ChurnRisk {
  if (harmonyScore < 40 || overdueCount >= 5) return 'high';
  if (harmonyScore < 65 || overdueCount >= 2) return 'medium';
  return 'low';
}

export const PropertyMetricsSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string(),
  healthScore: z.number().int().min(0).max(100),
  churnRisk: ChurnRiskSchema,
  overdueCount: z.number().int().min(0),
  memberCount: z.number().int().min(0),
  mode: LandlordModeSchema,
  linkedAt: z.string().datetime(),
});
export type PropertyMetrics = z.infer<typeof PropertyMetricsSchema>;

export interface ChurnRiskReason {
  level: ChurnRisk;
  factors: string[];
}

export function explainChurnRisk(
  harmonyScore: number,
  overdueCount: number,
): ChurnRiskReason {
  const factors: string[] = [];
  if (harmonyScore < 40) factors.push(`Harmony score is critically low (${harmonyScore}).`);
  else if (harmonyScore < 65) factors.push(`Harmony score is below comfort range (${harmonyScore}).`);
  if (overdueCount >= 5) factors.push(`${overdueCount} chores are overdue.`);
  else if (overdueCount >= 2) factors.push(`${overdueCount} chores are overdue.`);
  return {
    level: computeChurnRisk(harmonyScore, overdueCount),
    factors,
  };
}

// Privacy Line: landlord insights are aggregate-only. No tenant names, no per-person
// fault metrics. See docs/PRIVACY.md. Chore titles are household-authored operational
// labels and are kept; anything that identifies a person is dropped or reduced to a count.
// Illustrative retention ROI for the landlord pitch. Turnover of a student tenant
// (vacancy + cleaning + re-letting) is modelled at a flat cost; healthier houses churn less.
export const TURN_COST_PER_TENANT_EUR = 650;

const DEPARTURE_PROBABILITY: Record<ChurnRisk, number> = {
  low: 0.02,
  medium: 0.08,
  high: 0.2,
};

export interface RetentionValue {
  annualEur: number;
  monthlyEur: number;
  departureProbability: number;
}

export function estimateRetentionValue(churnRisk: ChurnRisk, memberCount: number): RetentionValue {
  const probability = DEPARTURE_PROBABILITY[churnRisk];
  const annualEur = Math.round(probability * memberCount * TURN_COST_PER_TENANT_EUR);
  return { annualEur, monthlyEur: Math.round(annualEur / 12), departureProbability: probability };
}

// Actionable, non-intrusive interventions the landlord can offer when wear shows.
export const RETENTION_PERK: Record<ChurnRisk, string | null> = {
  low: null,
  medium: 'Mood is dipping. A subsidised house dinner is a cheap way to reset the vibe.',
  high: 'High relational wear. A complimentary deep-clean voucher tends to ease friction fast.',
};

export const OverdueTaskInsightSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  dueAt: z.string().datetime(),
  daysOverdue: z.number().int().min(0),
});
export type OverdueTaskInsight = z.infer<typeof OverdueTaskInsightSchema>;

export const ContributionSpreadSchema = z.enum(['even', 'uneven']);
export type ContributionSpread = z.infer<typeof ContributionSpreadSchema>;

export const ContributionBalanceSchema = z.object({
  spread: ContributionSpreadSchema,
  activeContributors: z.number().int().min(0),
  totalMembers: z.number().int().min(0),
});
export type ContributionBalance = z.infer<typeof ContributionBalanceSchema>;

export const PropertyInsightsSchema = z.object({
  propertyId: z.string().uuid(),
  householdId: z.string().uuid(),
  churnRisk: ChurnRiskSchema,
  churnRiskFactors: z.array(z.string()),
  overdueTasks: z.array(OverdueTaskInsightSchema),
  contributionBalance: ContributionBalanceSchema,
  recentMessFlagCount: z.number().int().min(0),
});
export type PropertyInsights = z.infer<typeof PropertyInsightsSchema>;
