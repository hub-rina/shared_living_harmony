import { redirect } from 'next/navigation';

export default async function DashboardRedirect({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  redirect(`/h/${householdId}/today`);
}
