'use client';

import { Wrench } from '@phosphor-icons/react';
import {
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_STATUS_LABELS,
  type MaintenanceRequest,
} from '@homebuddy/shared';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, SectionHeader, Tag } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useCan } from '@/lib/use-can';

const STATUS_TONE = {
  open: 'overdue',
  acknowledged: 'heavy',
  resolved: 'completed',
} as const;

export function MaintenanceSection({ householdId }: { householdId: string }) {
  const { isActive } = useCan();
  const [items, setItems] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(MAINTENANCE_CATEGORIES[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(await apiClient.maintenance.list(householdId).catch(() => []));
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const raise = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await apiClient.maintenance.create(householdId, { title: trimmed, category });
      setTitle('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (item: MaintenanceRequest) => {
    setBusy(true);
    try {
      await apiClient.maintenance.setStatus(householdId, item.id, 'resolved');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleEscalation = async (item: MaintenanceRequest) => {
    setBusy(true);
    try {
      await apiClient.maintenance.setEscalation(householdId, item.id, !item.escalated);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <SectionHeader
        eyebrow="Maintenance"
        title="Things the landlord should fix"
        description="Boiler, damp, pests, noise. Raise it here, then choose what to send to your landlord — they only see issues you escalate, never who reported it."
      />

      {items.length > 0 && (
        <ul className="mb-4 flex flex-col divide-y divide-[var(--border)]">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <Wrench size={20} weight="duotone" aria-hidden className="shrink-0 text-[var(--accent-hover)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{item.title}</p>
                {item.category && (
                  <p className="text-xs text-[var(--text-mute)]">{item.category}</p>
                )}
              </div>
              <Tag tone={STATUS_TONE[item.status]} size="sm">
                {MAINTENANCE_STATUS_LABELS[item.status]}
              </Tag>
              {item.escalated && (
                <Tag tone="sage" size="sm">
                  Shared with landlord
                </Tag>
              )}
              {isActive && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleEscalation(item)}
                  disabled={busy}
                >
                  {item.escalated ? 'Unshare' : 'Send to landlord'}
                </Button>
              )}
              {isActive && item.status !== 'resolved' && (
                <Button size="sm" variant="ghost" onClick={() => resolve(item)} disabled={busy}>
                  Resolved
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isActive && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void raise();
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs fixing?"
            maxLength={120}
            className="min-h-9 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {MAINTENANCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button size="sm" type="submit" disabled={busy || !title.trim()}>
            Raise
          </Button>
        </form>
      )}
    </Card>
  );
}
