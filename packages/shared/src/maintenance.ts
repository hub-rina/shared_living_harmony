import { z } from 'zod';

// Maintenance requests are the landlord's real job (boiler, mold, pests, noise).
// Tenants raise them; the landlord sees the request and status but never who reported it.
export const MaintenanceStatusSchema = z.enum(['open', 'acknowledged', 'resolved']);
export type MaintenanceStatus = z.infer<typeof MaintenanceStatusSchema>;

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
};

export const MAINTENANCE_CATEGORIES = [
  'Heating / boiler',
  'Mold / damp',
  'Pests',
  'Noise',
  'Plumbing',
  'Other',
] as const;

export const MaintenanceRequestSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: z.string().nullable(),
  status: MaintenanceStatusSchema,
  // Residents decide what the landlord sees: only escalated requests cross the
  // Privacy Line into the landlord portal. See §5.8.
  escalated: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MaintenanceRequest = z.infer<typeof MaintenanceRequestSchema>;

export const CreateMaintenanceInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().max(40).optional(),
});
export type CreateMaintenanceInput = z.infer<typeof CreateMaintenanceInputSchema>;

export const UpdateMaintenanceStatusInputSchema = z.object({
  status: MaintenanceStatusSchema,
});
export type UpdateMaintenanceStatusInput = z.infer<typeof UpdateMaintenanceStatusInputSchema>;

export const SetMaintenanceEscalationInputSchema = z.object({
  escalated: z.boolean(),
});
export type SetMaintenanceEscalationInput = z.infer<typeof SetMaintenanceEscalationInputSchema>;
