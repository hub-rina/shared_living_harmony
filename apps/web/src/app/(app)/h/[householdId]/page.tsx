import { redirect } from 'next/navigation';

export default async function HouseholdRoot({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  redirect(`/h/${householdId}/today`);
}
