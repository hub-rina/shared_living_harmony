'use client';

import { Plus, Receipt } from '@phosphor-icons/react';
import type { ExpenseListResponse } from '@homebuddy/shared';
import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useHousehold } from '@/lib/household-context';
import { useCan } from '@/lib/use-can';
import { BalancesSummary } from './balances-summary';
import { BillCard } from './bill-card';
import { NewBillSheet, type SplitMember } from './new-bill-sheet';

type MemberRow = { user: { id: string; name: string }; status?: string };

export function MoneyView() {
  const { householdId, household } = useHousehold();
  const { scope, isActive } = useCan();
  const [data, setData] = useState<ExpenseListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    const result = await apiClient.expenses.list(householdId).catch(() => null);
    setData(result ?? { expenses: [], balances: [] });
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const members: SplitMember[] = (
    (household as (typeof household & { members?: MemberRow[] }) | null)?.members ?? []
  ).map((member) => ({
    userId: member.user.id,
    name: member.user.name,
    status: member.status ?? 'active',
  }));

  const markPaid = (expenseId: string) => (shareId: string, proofImageDataUrl?: string) =>
    apiClient.expenses.markPaid(householdId, expenseId, shareId, proofImageDataUrl).then(() => load());
  const confirm = (expenseId: string) => (shareId: string) =>
    apiClient.expenses.confirm(householdId, expenseId, shareId).then(() => load());
  const remove = (expenseId: string) => () =>
    apiClient.expenses.remove(householdId, expenseId).then(() => load());

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Money</p>
          <h1 className="text-3xl font-bold tracking-tight">Shared costs</h1>
          <p className="max-w-prose text-sm text-[var(--text-mute)]">
            Split what you buy for the house. Snap a receipt, fix anything we misread, and pick who chips in.
          </p>
        </div>
        {isActive && (
          <Button onClick={() => setSheetOpen(true)}>
            <Plus size={18} weight="bold" aria-hidden /> Add a bill
          </Button>
        )}
      </header>

      <BalancesSummary balances={data?.balances ?? []} />

      {data && data.expenses.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.expenses.map((expense) => (
            <BillCard
              key={expense.id}
              expense={expense}
              currentUserId={scope.userId}
              canManage={isActive && (expense.creatorId === scope.userId || scope.membership?.role === 'admin')}
              onPaid={markPaid(expense.id)}
              onConfirm={confirm(expense.id)}
              onDelete={remove(expense.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          art={<Receipt size={72} weight="duotone" aria-hidden className="text-[var(--accent-hover)]" />}
          title="No shared bills yet"
          description="When someone buys something for the house, add it here and split it with the others."
          action={
            isActive ? (
              <Button size="sm" onClick={() => setSheetOpen(true)}>
                Add the first bill
              </Button>
            ) : undefined
          }
        />
      )}

      {isActive && (
        <NewBillSheet
          householdId={householdId}
          members={members}
          currentUserId={scope.userId}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
