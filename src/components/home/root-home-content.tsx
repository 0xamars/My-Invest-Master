"use client";

import { RefreshCw } from "lucide-react";
import { MarketingHomePage } from "@/components/home/marketing-home";
import { JourneyHomeContent } from "@/components/journey/journey-home-content";
import { useAuth } from "@/hooks/use-auth";

/** Signed-out `/` is marketing. Signed-in `/` is Journey Home. */
export function RootHomeContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#121212]">
        <RefreshCw className="size-5 animate-spin text-white/50" />
      </div>
    );
  }

  if (user) {
    return <JourneyHomeContent />;
  }

  return <MarketingHomePage />;
}
