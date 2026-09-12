import { redirect } from "next/navigation";

interface FreedomPlanRedirectProps {
  params: Promise<{ id: string }>;
}

export default async function FreedomPlanRedirectPage({
  params,
}: FreedomPlanRedirectProps) {
  const { id } = await params;
  redirect(`/retire/plans/${id}`);
}
