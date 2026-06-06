'use client';

import { ArrowDown, ArrowUp, Scales } from '@phosphor-icons/react';
import { formatEuros, type ExpenseBalance } from '@homebuddy/shared';
import { Card, SectionHeader } from '@/components/ui';

export function BalancesSummary({ balances }: { balances: ExpenseBalance[] }) {
  return (
    <Card>
      <SectionHeader
        eyebrow="Where you stand"
        title="Your balance"
        description="Across every shared bill in the house. Settling happens in real life — the app just keeps score."
      />
      {balances.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-[var(--accent-wash)] px-4 py-3">
          <Scales size={22} weight="duotone" aria-hidden className="text-[var(--accent-hover)]" />
          <p className="text-sm font-medium text-[var(--accent-hover)]">
            You&rsquo;re all settled up. Nothing owed either way.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {balances.map((balance) => {
            const theyOweYou = balance.netCents > 0;
            return (
              <li key={balance.userId} className="flex items-center gap-3 py-3">
                {theyOweYou ? (
                  <ArrowDown size={20} weight="bold" aria-hidden className="shrink-0 text-[color:var(--mood-stable-fg)]" />
                ) : (
                  <ArrowUp size={20} weight="bold" aria-hidden className="shrink-0 text-[color:var(--mood-tense-fg)]" />
                )}
                <p className="min-w-0 flex-1 text-sm">
                  {theyOweYou ? (
                    <>
                      <span className="font-semibold">{balance.name}</span> owes you
                    </>
                  ) : (
                    <>
                      You owe <span className="font-semibold">{balance.name}</span>
                    </>
                  )}
                </p>
                <span
                  className={`text-sm font-bold tracking-tight ${
                    theyOweYou ? 'text-[color:var(--mood-stable-fg)]' : 'text-[color:var(--mood-tense-fg)]'
                  }`}
                >
                  {formatEuros(Math.abs(balance.netCents))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
