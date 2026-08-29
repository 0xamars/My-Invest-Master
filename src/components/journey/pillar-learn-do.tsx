"use client";

import { useCallback, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FreedomDoNudge } from "@/components/journey/freedom-do-nudge";
import { InvestDoSkipPanel } from "@/components/journey/invest-do-skip-panel";
import { LearnPanel } from "@/components/journey/learn-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { useSyncWorkingFlags } from "@/hooks/use-sync-working-flags";
import { investDoIsLocked } from "@/lib/journey/locks";
import { parseLessonId } from "@/lib/journey/lessons";
import { withDerivedWorking } from "@/lib/journey/working";
import { bookPresenceFromPortfolio } from "@/lib/retirement/freedom-path";
import {
  learnIsCollapsed,
  parsePillarTab,
  pillarTabHref,
  resolvePillarTab,
  type PillarTab,
} from "@/lib/journey/tabs";
import type { JourneyPillar } from "@/types/money-profile";

export function PillarLearnDo({
  pillar,
  children,
}: {
  pillar: JourneyPillar;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useMoneyProfile();
  const { primaryPortfolio } = usePortfolioPlans();
  const derivedWorking = useSyncWorkingFlags();
  const liveProfile =
    profile && derivedWorking
      ? withDerivedWorking(profile, derivedWorking)
      : profile;

  const hasBook = bookPresenceFromPortfolio(primaryPortfolio).status === "present";
  const investLocked = investDoIsLocked({ profile: liveProfile, hasBook });

  const tab = resolvePillarTab(searchParams.get("tab"), profile, pillar);
  const lessonId = parseLessonId(searchParams.get("lesson"), pillar);
  const collapsed = learnIsCollapsed(profile);
  const showInvestLock = pillar === "invest" && tab === "do" && investLocked;
  const showFreedomNudge = pillar === "freedom" && tab === "do";

  const go = useCallback(
    (next: PillarTab, lesson?: string | null) => {
      const href = pillarTabHref(pillar, next, next === "learn" ? lesson : null);
      if (`${pathname}${searchParams.toString() ? `?${searchParams}` : ""}` === href) {
        return;
      }
      router.replace(href, { scroll: false });
    },
    [pathname, pillar, router, searchParams],
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = parsePillarTab(String(value));
        if (next) go(next, lessonId);
      }}
      className="flex flex-1 flex-col gap-5"
    >
      <TabsList className="grid w-full max-w-xs grid-cols-2">
        <TabsTrigger value="learn">Learn</TabsTrigger>
        <TabsTrigger value="do">Do</TabsTrigger>
      </TabsList>

      <TabsContent value="learn" className="flex flex-1 flex-col">
        <LearnPanel
          pillar={pillar}
          lessonId={lessonId}
          collapsed={collapsed}
          onSelectLesson={(id) => go("learn", id)}
        />
      </TabsContent>

      <TabsContent value="do" className="flex flex-1 flex-col gap-4">
        {showInvestLock ? (
          <InvestDoSkipPanel />
        ) : (
          <>
            {showFreedomNudge ? <FreedomDoNudge hasBook={hasBook} /> : null}
            {children}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
