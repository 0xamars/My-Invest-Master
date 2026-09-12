import { RequireAuth } from "@/components/auth/require-auth";
import { RetirementPlanEditorContent } from "@/components/retirement/retirement-plan-editor-content";

interface RetirePlanPageProps {
  params: Promise<{ id: string }>;
}

export default async function RetirePlanPage({
  params,
}: RetirePlanPageProps) {
  const { id } = await params;

  return (
    <RequireAuth
      title="Sign in to edit Retire plans"
      description="Your Retire projections are tied to your account. Sign in to view and edit this plan."
    >
      <RetirementPlanEditorContent planId={id} />
    </RequireAuth>
  );
}
