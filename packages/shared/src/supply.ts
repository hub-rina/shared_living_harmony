import { z } from 'zod';

// Shared supplies tracker. Opt-in per household: a house only tracks what it adds.
// Marking a supply low creates a fairly-assigned purchase task via Smart Rotation.
export const SupplySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isLow: z.boolean(),
  updatedAt: z.string().datetime(),
});
export type Supply = z.infer<typeof SupplySchema>;

export const AddSupplyInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
});
export type AddSupplyInput = z.infer<typeof AddSupplyInputSchema>;

// The "Holy Trinity" the survey kept surfacing.
export const DEFAULT_SUPPLIES = ['Toilet paper', 'Dish soap', 'Trash bags'] as const;

export function purchaseTaskTitle(supplyName: string): string {
  return `Buy ${supplyName.toLowerCase()}`;
}
