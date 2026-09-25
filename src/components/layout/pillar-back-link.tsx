"use client";

import Link from "next/link";
import { pillarHomePath } from "@/lib/chrome/nav";
import { cn } from "@/lib/utils";

const PILLAR_LABEL: Record<string, string> = {
  "/budget": "Budget",
  "/invest": "Invest",
  "/freedom": "Retire",
  "/retire": "Retire",
};

export function PillarBackLink({
  href,
  label,
  current,
  className,
}: {
  href?: string;
  label?: string;
  current?: string;
  className?: string;
}) {
  const target = href ?? "/budget";
  const raw = label ?? `Back to ${PILLAR_LABEL[target] ?? "Budget"}`;
  const parent = raw.replace(/^Back to\s+/i, "");

  return (
    <nav aria-label="Breadcrumb" className={cn("product-crumb", className)}>
      <Link href={target} className="hover:text-foreground">
        {parent}
      </Link>
      {current ? (
        <>
          <span aria-hidden="true">/</span>
          <span className="truncate text-foreground">{current}</span>
        </>
      ) : null}
    </nav>
  );
}

export function pillarBackHref(pathname: string): string {
  return pillarHomePath(pathname);
}
