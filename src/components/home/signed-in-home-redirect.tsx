"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  shouldRedirectSignedInFromMarketing,
  signedInLandingPath,
} from "@/lib/journey/landing";

/** Signed-in visitors leave marketing `/` after auth hydrates. */
export function SignedInHomeRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (
      shouldRedirectSignedInFromMarketing({
        signedIn: Boolean(user),
        pathname: "/",
      })
    ) {
      router.replace(signedInLandingPath());
    }
  }, [isLoading, user, router]);

  return null;
}
