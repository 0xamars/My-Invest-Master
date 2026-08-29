import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { InvestHomeContent } from "@/components/invest/invest-home-content";
import { PillarLearnDo } from "@/components/journey/pillar-learn-do";

function LearnDoFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
      Opening Invest…
    </div>
  );
}

export default function InvestPage() {
  return (
    <RequireAuth
      title="Sign in to open Invest"
      description="The public-stock book is tied to your account. Sign in to continue."
    >
      <Suspense fallback={<LearnDoFallback />}>
        <PillarLearnDo pillar="invest">
          <InvestHomeContent />
        </PillarLearnDo>
      </Suspense>
    </RequireAuth>
  );
}
