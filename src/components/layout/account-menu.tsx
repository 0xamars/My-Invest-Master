"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SETTINGS_PATH } from "@/lib/chrome/nav";
import { accountInitial, accountLabel } from "@/lib/layout/account-initial";
import { signOutThenGoHome } from "@/lib/layout/sign-out-home";
import { useGoToMarketingHome } from "@/lib/navigation/marketing-home";
import { LOGIN_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function AccountMenu() {
  const { user, isLoading, signOut } = useAuth();
  const goToMarketingHome = useGoToMarketingHome();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (isLoading) {
    return (
      <div
        className="size-10 animate-pulse rounded-full border border-border bg-muted"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href={LOGIN_PATH}
        className="inline-flex h-10 items-center rounded-[var(--radius)] border border-border bg-muted px-4 text-sm font-medium text-foreground"
      >
        Sign in
      </Link>
    );
  }

  const initial = accountInitial(user);
  const label = accountLabel(user);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setOpen(false);
    try {
      await signOutThenGoHome(signOut, goToMarketingHome);
    } catch {
      /* goHome already ran */
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground hover:bg-muted/80"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {initial}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 min-w-52 rounded-[var(--radius)] border border-border bg-card p-1 text-popover-foreground shadow-none"
        >
          {label ? (
            <p className="truncate px-3 py-2 text-xs text-muted-foreground">
              {label}
            </p>
          ) : null}
          <Link
            href={SETTINGS_PATH}
            role="menuitem"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted",
            )}
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
            onClick={() => {
              void handleSignOut();
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
