'use client';

import { ShieldCheck, UserCircle } from '@phosphor-icons/react';
import { LANDLORD_MODE_LABELS, type LandlordMode } from '@homebuddy/shared';
import Link from 'next/link';
import { useState } from 'react';
import { Card, SectionHeader, Skeleton, Tag } from '@/components/ui';
import { SuppliesSection } from '@/components/feature/supplies-section';
import { MaintenanceSection } from '@/components/feature/maintenance-section';
import { InviteRoommates } from '@/components/feature/invite-roommates';
import { apiClient } from '@/lib/api';
import { useHousehold } from '@/lib/household-context';
import { useCan } from '@/lib/use-can';

interface Member {
  id: string;
  user: { id: string; name: string; email: string };
  role?: string;
  status?: string;
}

interface LandlordLink {
  landlordId: string;
  mode: LandlordMode;
  consentGranted: boolean;
  landlord: { id: string; name: string; email: string };
}

const MODES: LandlordMode[] = ['observer', 'caretaker'];

function LandlordSection({
  householdId,
  link,
  isAdmin,
  onChange,
}: {
  householdId: string;
  link: LandlordLink;
  isAdmin: boolean;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const save = async (input: { mode?: LandlordMode; consentGranted?: boolean }) => {
    setBusy(true);
    try {
      await apiClient.households.updateLandlord(householdId, link.landlordId, input);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionHeader
        eyebrow="Landlord"
        title={link.landlord.name}
        description="Choose what your landlord can see. Off means they see nothing."
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Share house health</p>
            <p className="text-xs text-[var(--text-mute)]">
              {link.consentGranted
                ? 'Your landlord can see an anonymous health score. No names, chores, or messages.'
                : 'Your landlord sees nothing right now.'}
            </p>
          </div>
          {link.consentGranted ? (
            <Tag tone="completed" size="sm">
              <ShieldCheck size={11} weight="fill" aria-hidden className="mr-0.5" />
              Sharing on
            </Tag>
          ) : (
            <Tag tone="heavy" size="sm">
              Off
            </Tag>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ consentGranted: !link.consentGranted })}
              className="self-start rounded-full border border-[var(--border)] px-4 py-1.5 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-wash)] disabled:opacity-50"
            >
              {link.consentGranted ? 'Stop sharing' : 'Start sharing health'}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-mute)]">
                Involvement
              </span>
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={busy || link.mode === mode}
                  onClick={() => save({ mode })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-100 ${
                    link.mode === mode
                      ? 'bg-[var(--accent)] text-white'
                      : 'border border-[var(--border)] text-[var(--text-mute)] hover:bg-[var(--accent-wash)]'
                  }`}
                >
                  {LANDLORD_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-soft)]">
              {link.mode === 'caretaker'
                ? 'Caretaker: your landlord maintains shared areas; those chores stay off your rotation.'
                : 'Observer: your landlord only watches the health score, with no chore duties.'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function HousePage() {
  const { household, loading, refresh } = useHousehold();
  const { isAdmin } = useCan();

  if (loading) {
    return <Skeleton className="h-64" />;
  }

  const householdWithMembers = household as
    | (typeof household & { members?: Member[]; landlords?: LandlordLink[] })
    | null;
  const landlordLink = householdWithMembers?.landlords?.[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">House</p>
        <h1 className="text-3xl font-bold tracking-tight">{household?.name ?? 'House'}</h1>
        <p className="max-w-prose text-sm text-[var(--text-mute)]">
          See who lives here and manage your home.
        </p>
      </header>

      {household && (
        <Card backdrop="friendship" backdropAnchor="right-bottom" backdropOpacity={0.13}>
          <SectionHeader
            eyebrow="Current home"
            title={household.name}
            description={`Harmony ${household.harmonyScore} of 100.`}
          />
          {householdWithMembers?.members && householdWithMembers.members.length > 0 ? (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {householdWithMembers.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <UserCircle
                    size={32}
                    weight="duotone"
                    aria-hidden
                    className="shrink-0 text-[var(--accent-hover)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{m.user.name}</p>
                    <p className="truncate text-xs text-[var(--text-mute)]">{m.user.email}</p>
                  </div>
                  <Tag
                    tone={
                      m.status === 'inactive'
                        ? 'heavy'
                        : m.status === 'invited'
                          ? 'reactive'
                          : 'sage'
                    }
                    size="sm"
                  >
                    {m.status === 'inactive'
                      ? 'Away'
                      : m.status === 'invited'
                        ? 'Invited'
                        : (m.role ?? 'Member')}
                  </Tag>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-mute)]">No members listed.</p>
          )}
        </Card>
      )}

      {household?.joinCode && (
        <Card>
          <SectionHeader eyebrow="Invite" title="Invite roommates" />
          <InviteRoommates
            householdId={household.id}
            joinCode={household.joinCode}
            isAdmin={isAdmin}
            onRegenerated={() => {
              void refresh();
            }}
          />
        </Card>
      )}

      {household && <SuppliesSection householdId={household.id} />}

      {household && <MaintenanceSection householdId={household.id} />}

      {landlordLink && household && (
        <LandlordSection
          householdId={household.id}
          link={landlordLink}
          isAdmin={isAdmin}
          onChange={refresh}
        />
      )}

      <p className="text-sm text-[var(--text-mute)]">
        Want to create a new household?{' '}
        <Link href="/new" className="font-semibold text-[var(--accent)] hover:underline">
          Create one here
        </Link>
        .
      </p>
    </div>
  );
}
