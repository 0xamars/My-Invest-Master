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
import { profileSummaryLine } from "@/lib/journey/labels";
import { MONEY_PROFILE_PATH } from "@/lib/routes";

export function MoneyProfileSettingsCard() {
  const { profile, isLoaded } = useMoneyProfile();

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
        {profile ? (
          <p className="text-sm text-muted-foreground">
            {profileSummaryLine(profile)}
          </p>
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
