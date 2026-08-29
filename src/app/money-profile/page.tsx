import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { MoneyProfileWizard } from "@/components/journey/money-profile-wizard";

function WizardFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
      Loading Money Profile…
    </div>
  );
}

export default function MoneyProfilePage() {
  return (
    <RequireAuth
      title="Sign in to set your Money Profile"
      description="The Money Profile is tied to your account. Sign in to continue."
    >
      <Suspense fallback={<WizardFallback />}>
        <MoneyProfileWizard />
      </Suspense>
    </RequireAuth>
  );
}
