import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppHomeContent } from "@/components/home/app-home-content";

function HomeLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <RefreshCw className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AppHomePage() {
  return (
    <RequireAuth
      title="Sign in to open your dashboard"
      description="Your InvestSalsa overview is tied to your account. Sign in to continue."
    >
      <Suspense fallback={<HomeLoading />}>
        <AppHomeContent />
      </Suspense>
    </RequireAuth>
  );
}
