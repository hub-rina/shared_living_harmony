'use client';

import type { ChurnRisk, HarmonyMoodLabel, PropertyMetrics } from '@homebuddy/shared';
import { CHURN_RISK_LABELS, harmonyBand } from '@homebuddy/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, EmptyState, Skeleton, Tag } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';

const HEALTH_BAR: Record<HarmonyMoodLabel, string> = {
  Tense:      'bg-[color:var(--color-mood-tense)]',
  Unstable:   'bg-[color:var(--color-mood-unstable)]',
  Calm:       'bg-[color:var(--color-mood-calm)]',
  Stable:     'bg-[color:var(--color-mood-stable)]',
  Harmonized: 'bg-[color:var(--color-mood-harmonized)]',
};

const HEALTH_TEXT: Record<HarmonyMoodLabel, string> = {
  Tense:      'text-[color:var(--mood-tense-fg)]',
  Unstable:   'text-[color:var(--mood-unstable-fg)]',
  Calm:       'text-[color:var(--mood-calm-fg)]',
  Stable:     'text-[color:var(--mood-stable-fg)]',
  Harmonized: 'text-[color:var(--mood-harmonized-fg)]',
};

const CHURN_TONE: Record<ChurnRisk, 'completed' | 'heavy' | 'overdue'> = {
  low: 'completed',
  medium: 'heavy',
  high: 'overdue',
};

function PropertyCard({ property }: { property: PropertyMetrics }) {
  const { mood } = harmonyBand(property.healthScore);

  return (
    <Card padded>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            <Link href={`/properties/${property.householdId}`} className="hover:underline">
              {property.name}
            </Link>
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-soft)]">
            {property.memberCount} resident{property.memberCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Tag tone={CHURN_TONE[property.churnRisk]} size="sm">
          {CHURN_RISK_LABELS[property.churnRisk]}
        </Tag>
      </header>

      <div className="mt-5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Property health
          </span>
          <span className={`text-2xl font-bold tabular-nums ${HEALTH_TEXT[mood]}`}>
            {property.healthScore}
            <span className="ml-0.5 text-sm font-normal text-[var(--text-soft)]">of 100</span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={property.healthScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Health ${property.healthScore} of 100`}
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${HEALTH_BAR[mood]}`}
            style={{ width: `${property.healthScore}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
          <span>Tense</span>
          <span className={`font-semibold ${HEALTH_TEXT[mood]}`}>{mood}</span>
          <span>Harmonized</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[var(--surface-raised)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Overdue chores
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
        <div className="rounded-lg bg-[var(--surface-raised)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Status
          </p>
          <p className="mt-1 text-lg font-semibold">
            {property.churnRisk === 'low'
              ? 'Stable'
              : property.churnRisk === 'medium'
              ? 'Watch'
              : 'Urgent'}
          </p>
        </div>
      </div>

      {property.churnRisk === 'high' && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-[color:var(--color-mood-tense)]/30 bg-[color:var(--color-mood-tense-wash)] px-4 py-3 text-sm text-[color:var(--mood-tense-fg)]"
        >
          High overdue rate. Residents may be disengaged. Consider reaching out.
        </p>
      )}
      {property.churnRisk === 'medium' && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-[color:var(--color-mood-unstable)]/30 bg-[color:var(--color-mood-unstable-wash)] px-4 py-3 text-sm text-[color:var(--mood-unstable-fg)]"
        >
          Harmony is sliding. Worth monitoring this week.
        </p>
      )}
    </Card>
  );
}

function SummaryBar({ properties }: { properties: PropertyMetrics[] }) {
  if (properties.length === 0) return null;
  const avgHealth = Math.round(
    properties.reduce((s, p) => s + p.healthScore, 0) / properties.length,
  );
  const highRisk = properties.filter((p) => p.churnRisk === 'high').length;
  const totalOverdue = properties.reduce((s, p) => s + p.overdueCount, 0);

  return (
    <Card padded surface="raised">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Portfolio health
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{avgHealth}</p>
          <p className="text-xs text-[var(--text-soft)]">
            avg across {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            High-risk
          </p>
          <p
            className={`mt-1 text-3xl font-bold tabular-nums ${
              highRisk > 0
                ? 'text-[color:var(--color-state-overdue)]'
                : 'text-[color:var(--mood-stable-fg)]'
            }`}
          >
            {highRisk}
          </p>
          <p className="text-xs text-[var(--text-soft)]">need attention</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
            Total overdue
          </p>
          <p
            className={`mt-1 text-3xl font-bold tabular-nums ${
              totalOverdue > 0
                ? 'text-[color:var(--mood-unstable-fg)]'
                : 'text-[var(--text-mute)]'
            }`}
          >
            {totalOverdue}
          </p>
          <p className="text-xs text-[var(--text-soft)]">across all properties</p>
        </div>
      </div>
    </Card>
  );
}

export default function LandlordDashboardPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.properties
      .list()
      .then(setProperties)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not load your portfolio.'),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
          Landlord
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Portfolio overview</h1>
        <p className="mt-1 text-sm text-[var(--text-mute)]">
          Hello {user?.name}. Here is each property at a glance.
        </p>
      </header>

      {error && (
        <p className="text-sm text-[color:var(--color-state-danger)]" role="alert">{error}</p>
      )}

      {properties.length === 0 ? (
        <EmptyState
          title="No properties linked"
          description="No properties are linked to your account yet."
        />
      ) : (
        <>
          <SummaryBar properties={properties} />
          <div className="grid gap-4 sm:grid-cols-2">
            {properties.map((p) => (
              <PropertyCard key={p.householdId} property={p} />
            ))}
          </div>
          <p className="text-center text-xs text-[var(--text-soft)]">
            Individual resident data is private. Metrics reflect aggregate household behaviour only.
          </p>
        </>
      )}
    </div>
  );
}
