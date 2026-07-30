import { RequireAuth } from "@/components/auth/require-auth";
import { RetirementPlanEditorContent } from "@/components/retirement/retirement-plan-editor-content";

interface RetirementPlanPageProps {
  params: Promise<{ id: string }>;
}

export default async function RetirementPlanPage({
  params,
}: RetirementPlanPageProps) {
  const { id } = await params;

  return (
    <RequireAuth
      title="Sign in to edit retirement plans"
      description="Your retirement projections are tied to your account. Sign in to view and edit this plan."
    >
      <RetirementPlanEditorContent planId={id} />
    </RequireAuth>
  );
}
