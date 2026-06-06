import { z } from 'zod';

export const HouseholdRoleSchema = z.enum(['admin', 'member']);
export type HouseholdRole = z.infer<typeof HouseholdRoleSchema>;

export const SystemRoleSchema = z.enum(['user', 'support']);
export type SystemRole = z.infer<typeof SystemRoleSchema>;

// 'invited' = the admin added this person but they have not yet activated by
// entering the join code. Invited members are excluded from rotation, harmony,
// and admin counts until they activate. See §5.11 (participation threshold).
export const MembershipStatusSchema = z.enum(['active', 'inactive', 'invited']);
export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;

export const INACTIVE_MAX_DAYS = 90;

export const SetInactiveInputSchema = z.object({
  from: z.string().datetime(),
  until: z.string().datetime(),
  reason: z.string().max(500).optional(),
});
export type SetInactiveInput = z.infer<typeof SetInactiveInputSchema>;
