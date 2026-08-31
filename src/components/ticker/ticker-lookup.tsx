"use client";

import { useRouter } from "next/navigation";
import { TickerSearch } from "@/components/ticker/ticker-search";
import { investTickerPath } from "@/lib/ticker/symbol";
import { cn } from "@/lib/utils";

export function TickerLookup({
  className,
  placeholder = "Name or ticker",
}: {
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();

  return (
    <TickerSearch
      assetType="stock"
      placeholder={placeholder}
      clearOnSelect
      size="lg"
      className={cn("w-full", className)}
      onSelect={(hit) => {
        router.push(investTickerPath(hit.symbol));
      }}
    />
  );
}
