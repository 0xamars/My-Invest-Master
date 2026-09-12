"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { MarketingHomePage } from "@/components/home/marketing-home";
import { useAuth } from "@/hooks/use-auth";
import { BUDGET_PATH } from "@/lib/chrome/nav";

/** Signed-out `/` is marketing. Signed-in `/` goes to Budget — no Journey Home. */
export function RootHomeContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(BUDGET_PATH);
    }
  }, [isLoading, user, router]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#121212]">
        <RefreshCw className="size-5 animate-spin text-white/50" />
      </div>
    );
  }

  return <MarketingHomePage />;
}
