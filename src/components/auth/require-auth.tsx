"use client";

import Link from "next/link";
import { Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useGoToMarketingHome } from "@/lib/navigation/marketing-home";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface RequireAuthProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function RequireAuth({
  children,
  title = "Sign in required",
  description = "Budget, Invest, and Freedom are available after you sign in. Your plans are stored in Supabase.",
}: RequireAuthProps) {
  const { user, isLoading } = useAuth();
  const goToMarketingHome = useGoToMarketingHome();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        Checking account…
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cloud auth not configured</CardTitle>
          <CardDescription>
            Add Supabase credentials and run the migration to enable sign-in and
            cross-browser plan sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" type="button" onClick={goToMarketingHome}>
            Back to Home
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button render={<Link href={LOGIN_PATH} />}>
            <LogIn className="size-4" />
            Sign in
          </Button>
          <Button variant="outline" render={<Link href={SIGNUP_PATH} />}>
            Start
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
