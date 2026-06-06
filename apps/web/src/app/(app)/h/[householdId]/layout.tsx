import { HouseholdProvider } from '@/lib/household-context';
import { HouseholdSwitcher } from '@/components/household-switcher';
import { QuickAddFab } from '@/components/feature/quick-add-fab';

export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return (
    <HouseholdProvider householdId={householdId}>
      <HouseholdSwitcher activeId={householdId} />
      {children}
      <QuickAddFab />
    </HouseholdProvider>
  );
}
