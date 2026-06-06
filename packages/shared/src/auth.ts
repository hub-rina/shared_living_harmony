import { z } from 'zod';
import { PublicUserSchema } from './user';
import { HouseholdRoleSchema, MembershipStatusSchema, SystemRoleSchema } from './membership';

export const PASSWORD_MIN_LENGTH = 8;

export const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  name: z.string().min(1).max(80),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RefreshInputSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshInputSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const AuthResponseSchema = z.object({
  user: PublicUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const MeResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  systemRole: SystemRoleSchema,
  createdAt: z.string().datetime(),
  memberships: z.array(
    z.object({
      householdId: z.string().uuid(),
      householdName: z.string(),
      role: HouseholdRoleSchema,
      status: MembershipStatusSchema,
    }),
  ),
  properties: z.array(
    z.object({
      propertyId: z.string().uuid(),
      householdId: z.string().uuid(),
      householdName: z.string(),
    }),
  ),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
