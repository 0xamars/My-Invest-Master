"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pillarHomePath } from "@/lib/chrome/nav";
import { cn } from "@/lib/utils";

const PILLAR_LABEL: Record<string, string> = {
  "/budget": "Budget",
  "/invest": "Invest",
  "/freedom": "Freedom",
  "/retire": "Freedom",
};

export function PillarBackLink({
  href,
  label,
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  const target = href ?? "/home";
  const text = label ?? `Back to ${PILLAR_LABEL[target] ?? "Journey"}`;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-2 h-9 w-fit gap-1.5 text-muted-foreground hover:text-foreground",
        className,
      )}
      render={<Link href={target} />}
    >
      <ArrowLeft className="size-4" />
      {text}
    </Button>
  );
}

export function pillarBackHref(pathname: string): string {
  return pillarHomePath(pathname);
}
