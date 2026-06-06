import { z } from 'zod';

export const TaskWeightSchema = z.enum(['light', 'heavy']);
export type TaskWeight = z.infer<typeof TaskWeightSchema>;

export const TaskStatusSchema = z.enum(['pending', 'completed', 'overdue']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskKindSchema = z.enum(['routine', 'reactive']);
export type TaskKind = z.infer<typeof TaskKindSchema>;

export const TaskCadenceSchema = z.enum(['once', 'weekly', 'monthly']);
export type TaskCadence = z.infer<typeof TaskCadenceSchema>;

export const TASK_CADENCE_LABELS: Record<TaskCadence, string> = {
  once: 'One-off',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfMonth));
  return result;
}

function stepDueAt(dueAt: Date, cadence: Exclude<TaskCadence, 'once'>): Date {
  return cadence === 'weekly'
    ? new Date(dueAt.getTime() + 7 * MS_PER_DAY)
    : addMonthsUtc(dueAt, 1);
}

// The next occurrence is anchored to the schedule (dueAt), not to when the chore was
// actually completed. Completing early keeps the rhythm; completing late advances past
// `now` so the next occurrence is never born overdue. Always returns a date after `now`.
export function nextRecurrenceDueAt(dueAt: Date, cadence: TaskCadence, now: Date): Date {
  if (cadence === 'once') return dueAt;
  let next = stepDueAt(dueAt, cadence);
  while (next.getTime() <= now.getTime()) {
    next = stepDueAt(next, cadence);
  }
  return next;
}

export const REACTIVE_DEFAULT_TITLE = 'Mess flagged';
export const REACTIVE_DEFAULT_DUE_HOURS = 24;

export const TASK_WEIGHT_POINTS: Record<TaskWeight, number> = {
  light: 1,
  heavy: 3,
};

export const TaskAssigneeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type TaskAssignee = z.infer<typeof TaskAssigneeSchema>;

const PhotoDataUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: 'Photo must be a base64 image data URL (png, jpeg or webp)',
  })
  .min(2_000, {
    message: 'Photo looks too small to be a real image — try again',
  })
  .max(5_000_000, { message: 'Photo too large — keep it under ~5MB' });

export const TaskSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  title: z.string().min(1).max(120),
  weight: TaskWeightSchema,
  kind: TaskKindSchema,
  cadence: TaskCadenceSchema,
  status: TaskStatusSchema,
  dueAt: z.string().datetime(),
  assigneeId: z.string().uuid(),
  assignee: TaskAssigneeSchema,
  rotationReason: z.string().nullable(),
  flaggedById: z.string().uuid().nullable(),
  flaggedBy: TaskAssigneeSchema.nullable(),
  completedById: z.string().uuid().nullable(),
  completedBy: TaskAssigneeSchema.nullable(),
  completedAt: z.string().datetime().nullable(),
  beforePhotoUrl: z.string().nullable(),
  proofPhotoUrl: z.string().nullable(),
  snoozeUsed: z.boolean(),
  caretakerOwned: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1).max(120),
  weight: TaskWeightSchema,
  cadence: TaskCadenceSchema.optional(),
  dueAt: z.string().datetime(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const CreateCaretakerTaskInputSchema = z.object({
  title: z.string().min(1).max(120),
  weight: TaskWeightSchema,
  dueAt: z.string().datetime(),
});
export type CreateCaretakerTaskInput = z.infer<typeof CreateCaretakerTaskInputSchema>;

export const CompleteTaskInputSchema = z.object({
  photoDataUrl: PhotoDataUrlSchema.optional(),
});
export type CompleteTaskInput = z.infer<typeof CompleteTaskInputSchema>;

export const UpdateTaskInputSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    weight: TaskWeightSchema.optional(),
    dueAt: z.string().datetime().optional(),
    assigneeId: z.string().uuid().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const FlagMessInputSchema = z.object({
  photoDataUrl: PhotoDataUrlSchema,
  title: z.string().min(1).max(120).optional(),
});
export type FlagMessInput = z.infer<typeof FlagMessInputSchema>;

export function requiresPhotoEvidence(weight: TaskWeight): boolean {
  return weight === 'heavy';
}

const CHORE_STOPWORDS = new Set([
  'a', 'an', 'and', 'the',
  'do', 'doing', 'done', 'does',
  'my', 'our', 'your',
  'please', 'today', 'tonight', 'tomorrow',
  'this', 'that', 'these', 'those',
  'up', 'down', 'in', 'on', 'of', 'for', 'to', 'with', 'at', 'by',
  'it', 'its', 'out', 'off',
  'just', 'some', 'all',
]);

// Order-invariant normalization for chore titles so "dishes",
// "do the dishes" and "wash up dishes" hit the same rotation bucket.
// Tokens are lowercased, punctuation stripped, stopwords removed, and
// the remaining tokens sorted alphabetically.
export function normalizeChoreTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !CHORE_STOPWORDS.has(t))
    .sort()
    .join(' ');
}
