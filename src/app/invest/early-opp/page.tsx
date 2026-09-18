import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { EarlyOppLanding } from "@/components/invest/early-opp/early-opp-landing";

function LandingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
      Opening 16-step framework…
    </div>
  );
}

export default function InvestEarlyOppPage() {
  return (
    <RequireAuth
      title="Sign in to open Early Opp"
      description="The 16-step framework is tied to your account."
    >
      <Suspense fallback={<LandingFallback />}>
        <EarlyOppLanding />
      </Suspense>
    </RequireAuth>
  );
}
