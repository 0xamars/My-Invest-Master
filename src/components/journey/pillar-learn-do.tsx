"use client";

import { useCallback, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LearnPanel } from "@/components/journey/learn-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { parseLessonId } from "@/lib/journey/lessons";
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

  const tab = resolvePillarTab(searchParams.get("tab"), profile, pillar);
  const lessonId = parseLessonId(searchParams.get("lesson"), pillar);
  const collapsed = learnIsCollapsed(profile);

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

      <TabsContent value="do" className="flex flex-1 flex-col">
        {children}
      </TabsContent>
    </Tabs>
  );
}
