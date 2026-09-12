"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { MarketingHomePage } from "@/components/home/marketing-home";
import { useAuth } from "@/hooks/use-auth";
import { APP_HOME_PATH } from "@/lib/routes";

/** Signed-out `/` is marketing. Signed-in `/` goes to Home. */
export function RootHomeContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(APP_HOME_PATH);
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <MarketingHomePage />;
}
