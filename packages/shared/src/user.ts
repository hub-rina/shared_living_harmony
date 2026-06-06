import { z } from 'zod';
import { SystemRoleSchema } from './membership';

export const PublicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  systemRole: SystemRoleSchema,
  createdAt: z.string().datetime(),
});

export type PublicUser = z.infer<typeof PublicUserSchema>;
