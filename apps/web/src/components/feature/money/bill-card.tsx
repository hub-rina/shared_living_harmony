'use client';

import { Camera, Check, Receipt } from '@phosphor-icons/react';
import {
  EXPENSE_SHARE_STATUS_LABELS,
  formatEuros,
  type Expense,
  type ExpenseShare,
} from '@homebuddy/shared';
import { useRef } from 'react';
import { Button, Card, InlineConfirm, Tag } from '@/components/ui';
import { fileToResizedDataUrl } from '@/lib/photo';
import { useInFlight } from '@/lib/use-in-flight';

const STATUS_TONE = {
  open: 'overdue',
  paid: 'reactive',
  confirmed: 'completed',
} as const;

function ShareRow({
  expense,
  share,
  currentUserId,
  onPaid,
  onConfirm,
}: {
  expense: Expense;
  share: ExpenseShare;
  currentUserId: string;
  onPaid: (shareId: string, proofImageDataUrl?: string) => Promise<void>;
  onConfirm: (shareId: string) => Promise<void>;
}) {
  const { pending, run } = useInFlight();
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  const viewerIsDebtor = share.debtorId === currentUserId;
  const viewerIsCreator = expense.creatorId === currentUserId;

  async function attachProof(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const dataUrl = await fileToResizedDataUrl(file);
    await run(() => onPaid(share.id, dataUrl));
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{share.debtorName}</span>
        {viewerIsDebtor && <span className="text-[var(--text-soft)]"> (you)</span>}
      </span>
      <span className="text-sm font-semibold tabular-nums">{formatEuros(share.amountCents)}</span>
      <Tag tone={STATUS_TONE[share.status]} size="sm">
        {EXPENSE_SHARE_STATUS_LABELS[share.status]}
      </Tag>

      {share.proofUrl && (
        <a
          href={share.proofUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--text-soft)] transition-colors hover:text-[var(--accent-hover)]"
          aria-label="View proof of payment"
        >
          <Receipt size={18} weight="duotone" aria-hidden />
        </a>
      )}

      {viewerIsDebtor && share.status === 'open' && (
        <span className="flex items-center gap-1">
          <input
            ref={proofInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={attachProof}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => proofInputRef.current?.click()}
            aria-label="Mark paid with a photo"
          >
            <Camera size={16} weight="bold" aria-hidden />
          </Button>
          <Button size="sm" disabled={pending} onClick={() => run(() => onPaid(share.id))}>
            I paid
          </Button>
        </span>
      )}

      {viewerIsCreator && share.status === 'paid' && (
        <Button size="sm" disabled={pending} onClick={() => run(() => onConfirm(share.id))}>
          <Check size={16} weight="bold" aria-hidden /> Confirm received
        </Button>
      )}
    </li>
  );
}

export function BillCard({
  expense,
  currentUserId,
  canManage,
  onPaid,
  onConfirm,
  onDelete,
}: {
  expense: Expense;
  currentUserId: string;
  canManage: boolean;
  onPaid: (shareId: string, proofImageDataUrl?: string) => Promise<void>;
  onConfirm: (shareId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { pending: deleting, run: runDelete } = useInFlight();
  const date = new Date(expense.createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

  return (
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <Receipt size={22} weight="duotone" aria-hidden className="mt-0.5 shrink-0 text-[var(--accent-hover)]" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-tight">{expense.title}</p>
          <p className="text-xs text-[var(--text-mute)]">
            {expense.creatorName} paid · {date}
          </p>
          {expense.note && <p className="mt-1 text-sm text-[var(--text-mute)]">{expense.note}</p>}
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-base font-bold tabular-nums">{formatEuros(expense.totalCents)}</span>
          {expense.receiptUrl && (
            <a
              href={expense.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--text-soft)] underline-offset-2 hover:underline"
            >
              receipt
            </a>
          )}
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {expense.shares.map((share) => (
          <ShareRow
            key={share.id}
            expense={expense}
            share={share}
            currentUserId={currentUserId}
            onPaid={onPaid}
            onConfirm={onConfirm}
          />
        ))}
      </ul>

      {canManage && (
        <div className="mt-3 flex justify-end">
          <InlineConfirm
            label="Delete bill"
            confirmLabel="Delete"
            question="Delete this bill for everyone?"
            busy={deleting}
            onConfirm={() => runDelete(onDelete)}
          />
        </div>
      )}
    </Card>
  );
}
