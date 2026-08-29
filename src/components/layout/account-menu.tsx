"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { SETTINGS_PATH } from "@/lib/chrome/nav";
import { useGoToMarketingHome } from "@/lib/navigation/marketing-home";
import { LOGIN_PATH } from "@/lib/routes";

function initialsFromEmail(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 1).toUpperCase();
}

export function AccountMenu() {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const goToMarketingHome = useGoToMarketingHome();

  if (isLoading) {
    return (
      <div
        className="size-9 animate-pulse rounded-full bg-muted"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Button
        variant="outline"
        render={<Link href={LOGIN_PATH} />}
      >
        Sign in
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full border-border/80 bg-card text-sm font-semibold"
            aria-label="Account menu"
          >
            {initialsFromEmail(user.email)}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="truncate font-normal">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            router.push(SETTINGS_PATH);
          }}
        >
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <div className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1">
          <span className="text-xs text-muted-foreground">Appearance</span>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void (async () => {
              await signOut();
              goToMarketingHome();
            })();
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
