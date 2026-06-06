'use client';

import type {
  HarmonyMoodLabel,
  MaintenanceRequest,
  PropertyInsights,
  PropertyMetrics,
} from '@homebuddy/shared';
import {
  CHURN_RISK_LABELS,
  MAINTENANCE_STATUS_LABELS,
  RETENTION_PERK,
  estimateRetentionValue,
  harmonyBand,
} from '@homebuddy/shared';
import { ShieldCheck } from '@phosphor-icons/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton, Tag } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';

const HEALTH_TEXT: Record<HarmonyMoodLabel, string> = {
  Tense:      'text-[color:var(--color-mood-tense)]',
  Unstable:   'text-[color:var(--color-mood-unstable)]',
  Calm:       'text-[color:var(--color-mood-calm)]',
  Stable:     'text-[color:var(--color-mood-stable)]',
  Harmonized: 'text-[color:var(--color-mood-harmonized)]',
};

export default function PropertyDetailPage() {
  const params = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<PropertyMetrics | null>(null);
  const [insights, setInsights] = useState<PropertyInsights | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.propertyId) return;
    Promise.all([
      apiClient.properties.get(params.propertyId),
      apiClient.properties.insights(params.propertyId).catch(() => null),
      apiClient.properties.maintenance(params.propertyId).catch(() => []),
    ])
      .then(([prop, ins, maint]) => {
        setProperty(prop);
        setInsights(ins);
        setMaintenance(maint);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not load this property.'),
      )
      .finally(() => setLoading(false));
  }, [params?.propertyId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--color-state-danger)]">{error ?? 'Not found.'}</p>
        <Link href="/properties" className="text-sm font-semibold text-[var(--accent)] hover:underline">
          Back to portfolio
        </Link>
      </div>
    );
  }

  const { mood } = harmonyBand(property.healthScore);
  const roi = estimateRetentionValue(property.churnRisk, property.memberCount);
  const perk = RETENTION_PERK[property.churnRisk];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/properties"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)] hover:underline"
        >
          Portfolio
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{property.name}</h1>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-[var(--text-mute)]">
            {property.memberCount} resident{property.memberCount !== 1 ? 's' : ''}
          </p>
          <Tag tone="completed" size="sm">
            <ShieldCheck size={11} weight="fill" aria-hidden className="mr-0.5" />
            Privacy protected
          </Tag>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Health
          </p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${HEALTH_TEXT[mood]}`}>
            {property.healthScore}
            <span className="ml-0.5 text-sm font-normal text-[var(--text-soft)]">/ 100</span>
          </p>
          <p className={`text-xs font-semibold ${HEALTH_TEXT[mood]}`}>{mood}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Overdue
          </p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              property.overdueCount > 0
                ? 'text-[color:var(--color-state-overdue)]'
                : 'text-[var(--text-mute)]'
            }`}
          >
            {property.overdueCount}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Risk
          </p>
          <div className="mt-1">
            <Tag
              tone={
                property.churnRisk === 'low'
                  ? 'completed'
                  : property.churnRisk === 'medium'
                  ? 'heavy'
                  : 'overdue'
              }
              size="sm"
            >
              {CHURN_RISK_LABELS[property.churnRisk]}
            </Tag>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
          Retention value
        </h2>
        <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--accent)]">
          €{roi.annualEur}
          <span className="ml-1 text-sm font-normal text-[var(--text-soft)]">/ year protected</span>
        </p>
        <p className="mt-1 text-xs text-[var(--text-mute)]">
          Estimated turnover cost avoided at this health level (≈{Math.round(roi.departureProbability * 100)}% departure
          risk across {property.memberCount} resident{property.memberCount !== 1 ? 's' : ''}). Illustrative.
        </p>
        {perk && (
          <p className="mt-3 rounded-md bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent-hover)]">
            {perk}
          </p>
        )}
      </section>

      {insights && insights.churnRiskFactors.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Why this risk level
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
            {insights.churnRiskFactors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      {insights && insights.overdueTasks.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Most overdue chores
          </h2>
          <ul className="mt-2 flex flex-col divide-y divide-[var(--border)]">
            {insights.overdueTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{t.title}</span>
                <span className="text-xs font-semibold text-[color:var(--color-state-overdue)]">
                  {t.daysOverdue}d overdue
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {insights && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Workload balance
          </h2>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              {insights.contributionBalance.spread === 'even'
                ? 'Evenly shared'
                : 'Unevenly shared'}
            </span>
            <span className="text-xs text-[var(--text-mute)]">
              {insights.contributionBalance.activeContributors} of{' '}
              {insights.contributionBalance.totalMembers} residents active in the last 30 days
            </span>
          </div>
        </section>
      )}

      {insights && insights.recentMessFlagCount > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Recent mess flags
          </h2>
          <p className="mt-2 text-sm">
            <span className="font-medium tabular-nums">{insights.recentMessFlagCount}</span>{' '}
            <span className="text-[var(--text-mute)]">flagged in the last 30 days</span>
          </p>
        </section>
      )}

      {maintenance.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Maintenance requests
          </h2>
          <ul className="mt-2 flex flex-col divide-y divide-[var(--border)]">
            {maintenance.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{m.title}</span>
                  {m.category && (
                    <span className="ml-2 text-[var(--text-mute)]">{m.category}</span>
                  )}
                </span>
                <span className="text-xs font-semibold text-[var(--text-mute)]">
                  {MAINTENANCE_STATUS_LABELS[m.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-[var(--text-soft)]">
        Individual resident data is private. Metrics reflect aggregate household behaviour only.
      </p>
    </div>
  );
}
