"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pillarHomePath } from "@/lib/chrome/nav";
import { cn } from "@/lib/utils";

const PILLAR_LABEL: Record<string, string> = {
  "/budget": "Budget",
  "/invest": "Invest",
  "/retire": "Retire",
  "/home": "Home",
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
  const target = href ?? "/invest";
  const text = label ?? `Back to ${PILLAR_LABEL[target] ?? "Home"}`;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2 w-fit gap-1.5 text-muted-foreground", className)}
      render={<Link href={target} />}
    >
      <ArrowLeft className="size-3.5" />
      {text}
    </Button>
  );
}

export function pillarBackHref(pathname: string): string {
  return pillarHomePath(pathname);
}
