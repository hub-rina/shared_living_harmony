'use client';

import { Plus, ShoppingCart, Trash } from '@phosphor-icons/react';
import type { Supply } from '@homebuddy/shared';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, SectionHeader, Tag } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useHousehold } from '@/lib/household-context';
import { useCan } from '@/lib/use-can';

export function SuppliesSection({ householdId }: { householdId: string }) {
  const { isActive } = useCan();
  const { refresh } = useHousehold();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await apiClient.supplies.list(householdId).catch(() => []);
    setSupplies(list);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addDefaults = async () => {
    setBusyId('defaults');
    try {
      setSupplies(await apiClient.supplies.addDefaults(householdId));
    } finally {
      setBusyId(null);
    }
  };

  const addCustom = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusyId('add');
    try {
      await apiClient.supplies.add(householdId, { name: trimmed });
      setName('');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (supply: Supply) => {
    setBusyId(supply.id);
    try {
      if (supply.isLow) {
        await apiClient.supplies.restock(householdId, supply.id);
      } else {
        await apiClient.supplies.markLow(householdId, supply.id);
        await refresh();
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (supply: Supply) => {
    setBusyId(supply.id);
    try {
      await apiClient.supplies.remove(householdId, supply.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <SectionHeader
        eyebrow="Shared supplies"
        title="The basics"
        description="Optional. Tap Low and we hand the shopping run to whoever owes the house most."
      />

      {supplies.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-[var(--text-mute)]">
            Nothing tracked yet. Most kots only share a few things.
          </p>
          {isActive && (
            <Button size="sm" onClick={addDefaults} disabled={busyId === 'defaults'}>
              <ShoppingCart size={16} weight="bold" aria-hidden />
              Add toilet paper, dish soap, trash bags
            </Button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {supplies.map((supply) => (
            <li key={supply.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{supply.name}</p>
              </div>
              <Tag tone={supply.isLow ? 'overdue' : 'completed'} size="sm">
                {supply.isLow ? 'Low' : 'Stocked'}
              </Tag>
              {isActive && (
                <>
                  <Button
                    size="sm"
                    variant={supply.isLow ? 'secondary' : 'ghost'}
                    onClick={() => toggle(supply)}
                    disabled={busyId === supply.id}
                  >
                    {supply.isLow ? 'Restocked' : 'Mark low'}
                  </Button>
                  <button
                    type="button"
                    aria-label={`Remove ${supply.name}`}
                    onClick={() => remove(supply)}
                    disabled={busyId === supply.id}
                    className="text-[var(--text-soft)] transition-colors hover:text-[color:var(--color-state-danger)] disabled:opacity-50"
                  >
                    <Trash size={16} weight="bold" aria-hidden />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {isActive && supplies.length > 0 && (
        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addCustom();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a supply"
            maxLength={40}
            className="min-h-9 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
          <Button size="sm" type="submit" disabled={busyId === 'add' || !name.trim()}>
            <Plus size={16} weight="bold" aria-hidden />
            Add
          </Button>
        </form>
      )}
    </Card>
  );
}
