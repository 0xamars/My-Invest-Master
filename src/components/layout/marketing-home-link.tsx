"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { MARKETING_HOME_PATH } from "@/lib/routes";
import { useGoToMarketingHome } from "@/lib/navigation/marketing-home";
import { cn } from "@/lib/utils";

type MarketingHomeLinkProps = {
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"a">, "href" | "children" | "className">;

/**
 * Always navigates to the public marketing homepage (`/`),
 * including after sign-out when client routing can stall.
 */
export function MarketingHomeLink({
  children,
  className,
  onClick,
  ...props
}: MarketingHomeLinkProps) {
  const goHome = useGoToMarketingHome();

  return (
    <a
      href={MARKETING_HOME_PATH}
      className={cn(className)}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        goHome();
      }}
    >
      {children}
    </a>
  );
}
