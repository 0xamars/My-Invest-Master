"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { MarketingHomePage } from "@/components/home/marketing-home";
import { useAuth } from "@/hooks/use-auth";
import { APP_HOME_PATH } from "@/lib/routes";

/** Public marketing homepage — shown for both logged-out and logged-in visitors. */
export function MarketingHomeContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");

  useEffect(() => {
    if (searchParams.get("signin") === "1" && !user && !isLoading) {
      setAuthMode("sign-in");
      setAuthOpen(true);
    }
  }, [searchParams, user, isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#050505]">
        <RefreshCw className="size-5 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <>
      <MarketingHomePage
        isSignedIn={Boolean(user)}
        onSignIn={() => {
          setAuthMode("sign-in");
          setAuthOpen(true);
        }}
        onSignUp={() => {
          setAuthMode("sign-up");
          setAuthOpen(true);
        }}
        dashboardHref={APP_HOME_PATH}
      />
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultMode={authMode}
        onSuccess={() => {
          router.push(APP_HOME_PATH);
        }}
      />
    </>
  );
}
