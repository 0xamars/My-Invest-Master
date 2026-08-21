"use client";

import Link from "next/link";
import { Cloud, Loader2, LogOut } from "lucide-react";
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

export function AccountSettings() {
  const { user, isLoading, isConfigured, signOut } = useAuth();
  const goToMarketingHome = useGoToMarketingHome();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Checking account…
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cloud className="size-5" />
            Cloud sync unavailable
          </CardTitle>
          <CardDescription>
            Add Supabase credentials to <code className="text-xs">.env.local</code>,
            run the SQL migration in{" "}
            <code className="text-xs">supabase/migrations/001_user_data.sql</code>
            , then restart the dev server.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cloud className="size-5" />
            Account
          </CardTitle>
          <CardDescription>
            Signed in as {user.email}. Budget, Invest, and Freedom plans are
            stored in Supabase and available on any browser or device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              void (async () => {
                await signOut();
                goToMarketingHome();
              })();
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cloud className="size-5" />
          Account
        </CardTitle>
        <CardDescription>
          Sign in to access Budget, Invest, and Freedom. Your plans are stored
          securely in Supabase, not in the browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button render={<Link href={LOGIN_PATH} />}>Sign in</Button>
        <Button variant="outline" render={<Link href={SIGNUP_PATH} />}>
          Create account
        </Button>
      </CardContent>
    </Card>
  );
}
