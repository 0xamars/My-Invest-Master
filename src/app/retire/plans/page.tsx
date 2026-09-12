import { RequireAuth } from "@/components/auth/require-auth";
import { RetirementPlansListContent } from "@/components/retirement/retirement-plans-list-content";

export default function RetirePlansPage() {
  return (
    <RequireAuth
      title="Sign in to manage Retire plans"
      description="Retire plans are saved to your account and available on any device after you sign in."
    >
      <RetirementPlansListContent />
    </RequireAuth>
  );
}
