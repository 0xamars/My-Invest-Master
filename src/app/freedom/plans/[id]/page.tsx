import { RequireAuth } from "@/components/auth/require-auth";
import { RetirementPlanEditorContent } from "@/components/retirement/retirement-plan-editor-content";

interface FreedomPlanPageProps {
  params: Promise<{ id: string }>;
}

export default async function FreedomPlanPage({
  params,
}: FreedomPlanPageProps) {
  const { id } = await params;

  return (
    <RequireAuth
      title="Sign in to edit Freedom plans"
      description="Your Freedom projections are tied to your account. Sign in to view and edit this plan."
    >
      <RetirementPlanEditorContent planId={id} />
    </RequireAuth>
  );
}
