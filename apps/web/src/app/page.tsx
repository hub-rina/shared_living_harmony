'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/use-auth';
import { HoomaLoader } from '@/components/brand/hooma-loader';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const lastVisited =
      typeof window !== 'undefined' ? localStorage.getItem('lastHouseholdId') : null;
    const stillMember =
      lastVisited && user.memberships.some((m) => m.householdId === lastVisited);
    if (stillMember) {
      router.replace(`/h/${lastVisited}`);
    } else if (user.memberships[0]) {
      router.replace(`/h/${user.memberships[0].householdId}`);
    } else if (user.properties[0]) {
      router.replace(`/properties/${user.properties[0].propertyId}`);
    } else {
      router.replace('/welcome');
    }
  }, [user, loading, router]);

  return <HoomaLoader label="Finding your way home" />;
}
