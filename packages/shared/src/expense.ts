import { z } from 'zod';

// Cost sharing. A resident pays for something for the house, photographs the
// receipt (self-hosted OCR reads a draft they then correct), and splits the
// corrected total equally among the included housemates. The creator is the
// payer/creditor; everyone else included gets a share they owe back. Money is
// its own zone: it never affects harmony and is never shown to the landlord.

export const ExpenseShareStatusSchema = z.enum(['open', 'paid', 'confirmed']);
export type ExpenseShareStatus = z.infer<typeof ExpenseShareStatusSchema>;

export const EXPENSE_SHARE_STATUS_LABELS: Record<ExpenseShareStatus, string> = {
  open: 'Unpaid',
  paid: 'Paid, awaiting confirmation',
  confirmed: 'Settled',
};

export const ExpenseItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  amountCents: z.number().int(),
  position: z.number().int(),
});
export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;

export const ExpenseShareSchema = z.object({
  id: z.string().uuid(),
  debtorId: z.string().uuid(),
  debtorName: z.string(),
  amountCents: z.number().int().nonnegative(),
  status: ExpenseShareStatusSchema,
  proofUrl: z.string().nullable(),
  paidAt: z.string().datetime().nullable(),
  confirmedAt: z.string().datetime().nullable(),
});
export type ExpenseShare = z.infer<typeof ExpenseShareSchema>;

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  creatorId: z.string().uuid(),
  creatorName: z.string(),
  title: z.string(),
  note: z.string().nullable(),
  totalCents: z.number().int().nonnegative(),
  receiptUrl: z.string().nullable(),
  items: z.array(ExpenseItemSchema),
  shares: z.array(ExpenseShareSchema),
  createdAt: z.string().datetime(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

// A single line on the editable draft. Sent back to the server on create so the
// corrected items are stored alongside the corrected total.
export const ExpenseDraftItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
  amountCents: z.number().int(),
});
export type ExpenseDraftItem = z.infer<typeof ExpenseDraftItemSchema>;

export const ScanReceiptInputSchema = z.object({
  imageDataUrl: z.string().min(1),
});
export type ScanReceiptInput = z.infer<typeof ScanReceiptInputSchema>;

export const ReceiptDraftSchema = z.object({
  items: z.array(ExpenseItemSchema.pick({ label: true, amountCents: true })),
  totalCents: z.number().int().nonnegative(),
  receiptUrl: z.string().nullable(),
});
export type ReceiptDraft = z.infer<typeof ReceiptDraftSchema>;

// includedMemberIds is everyone sharing the cost, including the creator. The
// total is split equally across all of them; the creator simply does not get a
// share row (they fronted the money), so each other person owes total / N.
export const CreateExpenseInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional(),
  totalCents: z.number().int().positive(),
  items: z.array(ExpenseDraftItemSchema).max(100).optional(),
  includedMemberIds: z.array(z.string().uuid()).min(1),
  receiptUrl: z.string().optional(),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseInputSchema>;

export const UpdateExpenseInputSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().max(500).nullable().optional(),
  totalCents: z.number().int().positive().optional(),
  items: z.array(ExpenseDraftItemSchema).max(100).optional(),
  includedMemberIds: z.array(z.string().uuid()).min(1).optional(),
});
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInputSchema>;

export const MarkSharePaidInputSchema = z.object({
  proofImageDataUrl: z.string().optional(),
});
export type MarkSharePaidInput = z.infer<typeof MarkSharePaidInputSchema>;

// One person's net standing toward the viewer across all unsettled bills.
// Positive netCents => this person owes the viewer that much; negative => the
// viewer owes them.
export const ExpenseBalanceSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  netCents: z.number().int(),
});
export type ExpenseBalance = z.infer<typeof ExpenseBalanceSchema>;

export const ExpenseListResponseSchema = z.object({
  expenses: z.array(ExpenseSchema),
  balances: z.array(ExpenseBalanceSchema),
});
export type ExpenseListResponse = z.infer<typeof ExpenseListResponseSchema>;

// --- Pure helpers (shared by API and web, unit-tested) ---

export function formatEuros(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}€${(abs / 100).toFixed(2)}`;
}

// Split a total equally across debtors, distributing the leftover cents one by
// one to the first shares so the parts always sum back to exactly the total.
export function splitEqually(
  totalCents: number,
  debtorIds: readonly string[],
): Array<{ debtorId: string; amountCents: number }> {
  if (debtorIds.length === 0) return [];
  const base = Math.floor(totalCents / debtorIds.length);
  let remainder = totalCents - base * debtorIds.length;
  return debtorIds.map((debtorId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { debtorId, amountCents: base + extra };
  });
}

// Turn a set of sharers (including the payer) into the shares each debtor owes.
// The total is divided equally across every sharer; the creator's own portion is
// then dropped because they already paid it. Each remaining person owes total/N.
export function splitBill(
  totalCents: number,
  sharerIds: readonly string[],
  creatorId: string,
): Array<{ debtorId: string; amountCents: number }> {
  return splitEqually(totalCents, sharerIds).filter((share) => share.debtorId !== creatorId);
}

type BalanceExpense = {
  creatorId: string;
  creatorName: string;
  shares: Array<{
    debtorId: string;
    debtorName: string;
    amountCents: number;
    status: ExpenseShareStatus;
  }>;
};

// Net every other person's position toward the viewer across unsettled shares.
// A confirmed share is fully settled and contributes nothing. A share where the
// viewer is the creditor (creator) counts positive; one where the viewer is the
// debtor counts negative.
export function netBalances(
  expenses: readonly BalanceExpense[],
  viewerId: string,
): ExpenseBalance[] {
  const net = new Map<string, { name: string; cents: number }>();
  const bump = (userId: string, name: string, delta: number) => {
    const entry = net.get(userId) ?? { name, cents: 0 };
    entry.cents += delta;
    entry.name = name;
    net.set(userId, entry);
  };

  for (const expense of expenses) {
    for (const share of expense.shares) {
      if (share.status === 'confirmed') continue;
      if (expense.creatorId === viewerId && share.debtorId !== viewerId) {
        bump(share.debtorId, share.debtorName, share.amountCents);
      } else if (share.debtorId === viewerId && expense.creatorId !== viewerId) {
        bump(expense.creatorId, expense.creatorName, -share.amountCents);
      }
    }
  }

  return [...net.entries()]
    .filter(([, v]) => v.cents !== 0)
    .map(([userId, v]) => ({ userId, name: v.name, netCents: v.cents }))
    .sort((a, b) => b.netCents - a.netCents);
}

// Heuristic parse of raw OCR text into an editable draft. Never throws: the
// resident corrects whatever it gets wrong. A line is read as an item when it
// ends in a price-like token; the total is taken from a line mentioning a total
// keyword, else the largest price seen, else the summed items.
const PRICE_RE = /(\d+[.,]\d{2})(?!.*\d)/;
const TOTAL_KEYWORDS = /\b(total|totaal|te betalen|bedrag|amount due|balance)\b/i;
const SKIP_KEYWORDS = /\b(subtotal|subtotaal|btw|vat|tax|change|teruggave|cash|card)\b/i;

function toCents(token: string): number {
  return Math.round(parseFloat(token.replace(',', '.')) * 100);
}

export function parseReceiptText(rawOcrText: string): {
  items: ExpenseDraftItem[];
  totalCents: number;
} {
  const items: ExpenseDraftItem[] = [];
  let totalFromKeyword = 0;
  let largestPrice = 0;

  for (const rawLine of rawOcrText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = PRICE_RE.exec(line);
    if (!match) continue;
    const cents = toCents(match[1]!);
    if (cents <= 0) continue;
    largestPrice = Math.max(largestPrice, cents);

    if (TOTAL_KEYWORDS.test(line)) {
      totalFromKeyword = Math.max(totalFromKeyword, cents);
      continue;
    }
    if (SKIP_KEYWORDS.test(line)) continue;

    const label = line.slice(0, match.index).replace(/[.\s…-]+$/, '').trim();
    if (label) items.push({ label: label.slice(0, 120), amountCents: cents });
  }

  const summed = items.reduce((acc, it) => acc + it.amountCents, 0);
  const totalCents = totalFromKeyword || largestPrice || summed;
  return { items, totalCents };
}
