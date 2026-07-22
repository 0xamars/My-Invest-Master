"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogIn, LogOut, PieChart } from "lucide-react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { BrandLogo } from "@/components/layout/brand-logo";
import { MarketNewsSection } from "@/components/home/market-news-section";
import { Sp500Heatmap } from "@/components/home/sp500-heatmap";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export function HomeContent() {
  const { user, isLoading, signOut } = useAuth();
  const searchParams = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("signin") === "1" && !user && !isLoading) {
      setAuthMode("sign-in");
      setAuthOpen(true);
    }
  }, [searchParams, user, isLoading]);

  function openSignIn() {
    setAuthMode("sign-in");
    setAuthOpen(true);
  }

  function openSignUp() {
    setAuthMode("sign-up");
    setAuthOpen(true);
  }

  return (
    <div className="flex flex-1 flex-col gap-10">
      <section className="brand-hero">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-5">
            <BrandLogo variant="hero" priority />
            <div className="max-w-xl space-y-2">
              <p className="text-lg font-medium text-foreground">
                Spicy markets. Smarter portfolios.
              </p>
              <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
                Track stocks and crypto news, explore the S&amp;P 500 heatmap, and
                manage your portfolio securely from anywhere.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isLoading ? null : user ? (
              <>
                <span className="w-full text-sm text-muted-foreground sm:w-auto">
                  Signed in as {user.email}
                </span>
                <Button className="premium-cta" render={<Link href="/portfolio" />}>
                  <PieChart className="size-4" />
                  Open portfolio
                </Button>
                <Button variant="outline" onClick={() => void signOut()}>
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={openSignUp}>
                  Create account
                </Button>
                <Button className="premium-cta" onClick={openSignIn}>
                  <LogIn className="size-4" />
                  Sign in
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {welcomeMessage && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 text-sm text-foreground">
            {welcomeMessage}
          </CardContent>
        </Card>
      )}

      {!isLoading && !user && (
        <Card>
          <CardHeader>
            <CardTitle>Unlock portfolio &amp; options</CardTitle>
            <CardDescription>
              Sign in to manage holdings and options. Passwords are hashed and
              stored securely by Supabase Auth — never in browser localStorage.
              Existing data in this browser imports automatically on first sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button className="premium-cta" onClick={openSignIn}>
              <LogIn className="size-4" />
              Sign in
            </Button>
            <Button variant="outline" onClick={openSignUp}>
              Create account
            </Button>
          </CardContent>
        </Card>
      )}

      <Sp500Heatmap />
      <MarketNewsSection />

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultMode={authMode}
        onSuccess={() => {
          setWelcomeMessage(
            "Signed in successfully. Your local portfolio and options data will sync to your account. Open Portfolio or Options from the sidebar.",
          );
        }}
      />
    </div>
  );
}
