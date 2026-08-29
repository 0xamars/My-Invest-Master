"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { APP_HOME_PATH, MARKETING_HOME_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

type BrandHomeLinkProps = {
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"a">, "href" | "children" | "className">;

/**
 * Signed-in chrome mark lands on Journey Home.
 * Marketing / signed-out mark still lands on `/`.
 */
export function BrandHomeLink({
  children,
  className,
  ...props
}: BrandHomeLinkProps) {
  const { user } = useAuth();
  const href = user ? APP_HOME_PATH : MARKETING_HOME_PATH;

  return (
    <Link href={href} className={cn(className)} {...props}>
      {children}
    </Link>
  );
}
