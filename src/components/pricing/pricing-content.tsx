"use client";

import Link from "next/link";
import { Check, Crown, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useUserPlan } from "@/hooks/use-user-preferences";
import { planDisplayName } from "@/lib/plans/access";
import {
  FREE_PLAN_FEATURES,
  PREMIUM_PLAN_FEATURES,
  PREMIUM_SUPPORT_EMAIL,
  PRICING_DISCLAIMER,
} from "@/lib/plans/pricing";
import { cn } from "@/lib/utils";

function FeatureRow({
  label,
  included,
  emphasize = false,
}: {
  label: string;
  included: boolean;
  emphasize?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {included ? (
        <Check
          className={cn(
            "mt-0.5 size-4 shrink-0",
            emphasize ? "text-primary" : "text-muted-foreground",
          )}
        />
      ) : (
        <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      )}
      <span
        className={cn(
          included ? "text-foreground" : "text-muted-foreground",
          emphasize && included && "font-medium",
        )}
      >
        {label}
      </span>
    </li>
  );
}

export function PricingContent() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { plan, isPremium, isLoaded: isPlanLoaded } = useUserPlan();
  const planReady = !user || isPlanLoaded;

  const mailto = `mailto:${PREMIUM_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    "InvestSalsa Premium early access",
  )}`;

  return (
    <div className="flex flex-1 flex-col gap-10">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
          Pricing
        </p>
        <h1 className="page-title text-balance sm:text-3xl">
          Free to start. Premium when you need more.
        </h1>
        <p className="page-description mx-auto max-w-xl text-balance">
          Track budgets, portfolios, and retirement plans on Free. Upgrade to
          Premium for unlimited plans, create-from-portfolio, and deeper AI and
          market tools as they ship.
        </p>
        {user && planReady && (
          <p className="text-sm text-muted-foreground">
            You are currently on{" "}
            <span className="font-medium text-foreground">
              {planDisplayName(plan)}
            </span>
            .
          </p>
        )}
      </div>

      <div className="mx-auto grid w-full max-w-4xl gap-5 md:grid-cols-2">
        <section className="surface-card flex flex-col rounded-2xl p-6 shadow-none ring-1 ring-border/80">
          <div className="mb-5 space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold tracking-tight">Free</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Everything you need to start organizing your finances.
            </p>
            <p className="pt-3 text-3xl font-semibold tracking-tight">
              $0
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                forever
              </span>
            </p>
          </div>

          <ul className="flex flex-1 flex-col gap-2.5 border-t border-border/70 pt-5">
            {FREE_PLAN_FEATURES.map((feature) => (
              <FeatureRow key={feature} label={feature} included />
            ))}
          </ul>

          <div className="mt-6">
            {user ? (
              <Button
                variant="outline"
                className="w-full"
                render={<Link href={isPremium ? "/settings" : "/portfolio"} />}
              >
                {isPremium ? "Manage plan in Settings" : "Continue with Free"}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                disabled={isAuthLoading}
                render={<Link href="/?signin=1" />}
              >
                Sign in to get started
              </Button>
            )}
          </div>
        </section>

        <section className="relative flex flex-col overflow-hidden rounded-2xl border border-primary/35 bg-primary/5 p-6 shadow-none">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 to-transparent" />
          <div className="relative mb-5 space-y-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
              <Crown className="size-3" />
              Recommended
            </div>
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight">Premium</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Unlimited plans plus full AI, market depth, and upcoming bank
              connections.
            </p>
            <p className="pt-3 text-3xl font-semibold tracking-tight">
              Coming soon
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                · billing not live
              </span>
            </p>
          </div>

          <ul className="relative flex flex-1 flex-col gap-2.5 border-t border-primary/20 pt-5">
            {PREMIUM_PLAN_FEATURES.map((feature) => (
              <FeatureRow
                key={feature}
                label={feature}
                included
                emphasize
              />
            ))}
          </ul>

          <div className="relative mt-6 space-y-2">
            {isPremium ? (
              <Button className="w-full gap-2" disabled>
                <Crown className="size-4" />
                You&apos;re on Premium
              </Button>
            ) : (
              <Button
                className="w-full gap-2"
                render={<a href={mailto} />}
              >
                <Crown className="size-4" />
                Upgrade to Premium
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              {isPremium
                ? "Thanks for being a Premium member."
                : `Self-serve billing is not enabled yet. Email ${PREMIUM_SUPPORT_EMAIL} for early Premium access.`}
            </p>
          </div>
        </section>
      </div>

      <div className="mx-auto max-w-3xl overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="border-b border-border/80 bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                Feature
              </th>
              <th className="px-4 py-3 font-medium">Free</th>
              <th className="px-4 py-3 font-medium text-primary">Premium</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Portfolios", "1", "Unlimited"],
              ["Retirement plans", "1", "Unlimited"],
              ["Budget plans", "1", "Unlimited"],
              ["Create retirement from portfolio", "—", "Included"],
              ["AI assistant", "Basic", "Full"],
              ["Market insights", "Limited", "Full"],
              ["Plaid bank sync", "—", "Coming soon"],
              ["Portfolio intelligence", "—", "Coming soon"],
            ].map(([feature, free, premium]) => (
              <tr
                key={feature}
                className="border-b border-border/60 last:border-0"
              >
                <td className="px-4 py-3 text-muted-foreground">{feature}</td>
                <td className="px-4 py-3">{free}</td>
                <td className="px-4 py-3 font-medium">{premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
        {PRICING_DISCLAIMER}
      </p>
    </div>
  );
}
