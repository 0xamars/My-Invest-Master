import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { PillarLearnDo } from "@/components/journey/pillar-learn-do";
import { RetireHomeContent } from "@/components/retire/retire-home-content";

function LearnDoFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
      Opening Freedom…
    </div>
  );
}

export default function FreedomPage() {
  return (
    <RequireAuth
      title="Sign in to open Freedom"
      description="Freedom plans are tied to your account. Sign in to continue."
    >
      <Suspense fallback={<LearnDoFallback />}>
        <PillarLearnDo pillar="freedom">
          <RetireHomeContent />
        </PillarLearnDo>
      </Suspense>
    </RequireAuth>
  );
}
