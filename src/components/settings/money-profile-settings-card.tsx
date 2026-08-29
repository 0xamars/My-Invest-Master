"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { useSyncWorkingFlags } from "@/hooks/use-sync-working-flags";
import { profileSummaryLine, STATION_STATUS_LABELS } from "@/lib/journey/labels";
import { withDerivedWorking } from "@/lib/journey/working";
import { MONEY_PROFILE_PATH } from "@/lib/routes";

export function MoneyProfileSettingsCard() {
  const { profile, isLoaded } = useMoneyProfile();
  const derivedWorking = useSyncWorkingFlags();
  const liveProfile =
    profile && derivedWorking
      ? withDerivedWorking(profile, derivedWorking)
      : profile;

  if (!isLoaded) return null;

  const editHref = `${MONEY_PROFILE_PATH}?from=settings`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserRound className="size-5" />
          Money Profile
        </CardTitle>
        <CardDescription>
          Country, knowledge, goal, and risk. Saving recomputes your track.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {liveProfile ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {profileSummaryLine(liveProfile)}
            </p>
            <p className="text-xs text-muted-foreground">
              Budget {liveProfile.working.budget ? STATION_STATUS_LABELS.working : "not yet"}
              {" · "}
              Invest {liveProfile.working.invest ? STATION_STATUS_LABELS.working : "not yet"}
              {" · "}
              Freedom {liveProfile.working.freedom ? STATION_STATUS_LABELS.working : "not yet"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No profile yet. Three steps. Pay is optional.
          </p>
        )}
        <Button render={<Link href={editHref} />}>
          {profile ? "Edit Money Profile" : "Create Money Profile"}
        </Button>
      </CardContent>
    </Card>
  );
}
