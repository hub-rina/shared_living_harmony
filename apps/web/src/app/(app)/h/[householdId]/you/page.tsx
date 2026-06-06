'use client';

import { SignOut } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { INACTIVE_MAX_DAYS, validateInactiveWindow } from '@homebuddy/shared';
import { Button, Card, SectionHeader, Tag } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';
import { useHousehold } from '@/lib/household-context';

export default function YouPage() {
  const router = useRouter();
  const { user, signOut, refresh: refreshAuth } = useAuth();
  const { householdId, scope, refresh } = useHousehold();

  const [signingOut, setSigningOut] = useState(false);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');
  const [awayOpen, setAwayOpen] = useState(false);
  const [awayErr, setAwayErr] = useState<string | null>(null);
  const [awayBusy, setAwayBusy] = useState(false);

  const isAway = scope.membership?.status === 'inactive';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } finally {
      setSigningOut(false);
    }
  }

  async function submitAway(e: React.FormEvent) {
    e.preventDefault();
    setAwayErr(null);
    const fromDate = new Date(from + 'T00:00:00.000Z');
    const untilDate = until ? new Date(until + 'T00:00:00.000Z') : null;
    const v = validateInactiveWindow({ from: fromDate, until: untilDate }, new Date());
    if (!v.ok) {
      setAwayErr(v.code);
      return;
    }
    setAwayBusy(true);
    try {
      await apiClient.households.setSelfInactive(householdId, {
        from: fromDate.toISOString(),
        until: untilDate!.toISOString(),
        reason: reason || undefined,
      });
      setAwayOpen(false);
      await refresh();
      await refreshAuth();
    } catch (e: unknown) {
      setAwayErr(e instanceof Error ? e.message : 'Could not save your away dates.');
    } finally {
      setAwayBusy(false);
    }
  }

  async function comeBack() {
    await apiClient.households.endOwnInactive(householdId);
    await refresh();
    await refreshAuth();
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">You</p>
        <h1 className="text-3xl font-bold tracking-tight">{user?.name}</h1>
        <p className="text-sm text-[var(--text-mute)]">{user?.email}</p>
      </header>

      <Card backdrop="profile-pic" backdropAnchor="top-right">
        <SectionHeader eyebrow="Profile" title="Your account" />
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--text-soft)]">Name</dt>
            <dd className="text-sm font-medium">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-soft)]">Email</dt>
            <dd className="text-sm font-medium">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-soft)]">Status in this home</dt>
            <dd>
              <Tag tone={isAway ? 'heavy' : 'sage'} size="sm">
                {isAway ? 'Away' : 'Active'}
              </Tag>
            </dd>
          </div>
        </dl>
      </Card>

      {scope.membership && (
        <Card surface="wash">
          <SectionHeader
            eyebrow="Availability"
            title={isAway ? 'You are away' : 'Set as away'}
            description={
              isAway
                ? 'Your tasks have been reassigned. Come back early any time.'
                : `Mark yourself unavailable for up to ${INACTIVE_MAX_DAYS} days. Your tasks will be reassigned.`
            }
          />
          {isAway ? (
            <Button type="button" variant="secondary" onClick={comeBack}>
              Come back early
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setAwayOpen(true)}>
              Set as away
            </Button>
          )}
          {awayOpen && (
            <form onSubmit={submitAway} className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--text-mute)]">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  required
                  className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--text-mute)]">Until</label>
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  required
                  className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-[var(--text-soft)]">Max {INACTIVE_MAX_DAYS} days.</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--text-mute)]">Reason (optional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              {awayErr && (
                <p className="text-xs text-[color:var(--color-state-danger)]" role="alert">{awayErr}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={awayBusy}>
                  {awayBusy ? 'Saving…' : 'Confirm'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setAwayOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      <Card surface="wash">
        <SectionHeader
          eyebrow="Session"
          title="Sign out"
          description="You can sign back in any time with the same email and password."
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <SignOut size={16} weight="bold" aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </Card>
    </div>
  );
}
