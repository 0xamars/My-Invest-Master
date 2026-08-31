import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AssessLandingSearch } from "@/components/invest/assess/assess-landing-search";
import { InvestToolsNav } from "@/components/layout/invest-tools-nav";
import { RetireEmptyState, RetirePageHeader, RetirePanel } from "@/components/retirement/retire-ui";
import { TrendingUp } from "lucide-react";

function AssessLandingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
      Opening Assess…
    </div>
  );
}

export default function InvestAssessPage() {
  return (
    <RequireAuth
      title="Sign in to open Assess"
      description="Fundamental tape and one-note assessment are tied to your account."
    >
      <Suspense fallback={<AssessLandingFallback />}>
        <div className="flex flex-1 flex-col gap-5">
          <InvestToolsNav />
          <RetirePageHeader
            title="Assess"
            description="Replace spreadsheet fundamental work — one note plus an annual cash-and-earnings tape."
          />
          <RetirePanel className="p-6">
            <div className="space-y-6">
              <RetireEmptyState
                icon={<TrendingUp className="size-5" />}
                title="Pick a public equity"
                description="Search a ticker to open the Assess note and Tape panels. Uses Financial Modeling Prep warehouse data — missing years are skipped, not invented."
                actions={
                  <div className="w-full max-w-md">
                    <AssessLandingSearch />
                  </div>
                }
              />
              <p className="text-center text-xs text-muted-foreground">
                Not investment advice. No trade execution.
              </p>
            </div>
          </RetirePanel>
        </div>
      </Suspense>
    </RequireAuth>
  );
}
