"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, PenLine } from "lucide-react";
import {
  getAssetFallbackLabel,
  getCryptoLogoApiUrl,
  getStockLogoUrls,
  resolveHoldingLogoUrl,
} from "@/lib/portfolio/logos";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/types/portfolio";

type AssetLogoSize = "xs" | "sm" | "md";

const SIZE_CLASSES: Record<AssetLogoSize, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
};

const ICON_SIZES: Record<AssetLogoSize, string> = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-4",
};

interface AssetLogoProps {
  symbol: string;
  name?: string;
  type: AssetType;
  logoUrl?: string;
  priceId?: string;
  size?: AssetLogoSize;
  className?: string;
}

export function AssetLogo({
  symbol,
  name,
  type,
  logoUrl,
  priceId,
  size = "sm",
  className,
}: AssetLogoProps) {
  const stockSources = useMemo(
    () => (type === "stock" ? getStockLogoUrls(symbol) : []),
    [symbol, type],
  );

  const [stockSourceIndex, setStockSourceIndex] = useState(0);
  const [cryptoLogoUrl, setCryptoLogoUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const resolvedLogoUrl =
    logoUrl ??
    resolveHoldingLogoUrl({ symbol, type, priceId, logoUrl }) ??
    (type === "crypto" ? (cryptoLogoUrl ?? undefined) : undefined);

  const activeStockUrl =
    type === "stock" ? stockSources[stockSourceIndex] : undefined;

  const displayUrl: string | undefined =
    type === "stock" && !logoUrl
      ? activeStockUrl
      : resolvedLogoUrl ?? undefined;

  useEffect(() => {
    setStockSourceIndex(0);
    setImageFailed(false);
  }, [symbol, type, logoUrl]);

  useEffect(() => {
    if (type !== "crypto" || logoUrl || !priceId) {
      setCryptoLogoUrl(null);
      return;
    }

    let cancelled = false;

    async function loadCryptoLogo() {
      try {
        const response = await fetch(getCryptoLogoApiUrl(priceId!));
        if (!response.ok) return;
        const data = (await response.json()) as { logoUrl?: string | null };
        if (!cancelled && data.logoUrl) {
          setCryptoLogoUrl(data.logoUrl);
        }
      } catch {
        // fallback handles missing logo
      }
    }

    void loadCryptoLogo();

    return () => {
      cancelled = true;
    };
  }, [type, logoUrl, priceId]);

  const showImage = Boolean(displayUrl) && !imageFailed;

  if (type === "cash") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
          SIZE_CLASSES[size],
          className,
        )}
        title={name ?? symbol}
      >
        <Banknote className={ICON_SIZES[size]} />
      </div>
    );
  }

  if (type === "custom") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#E47B31_18%,transparent)] font-semibold text-[#D85921] dark:text-[#E47B31]",
          SIZE_CLASSES[size],
          className,
        )}
        title={name ?? symbol}
      >
        <PenLine className={ICON_SIZES[size]} />
      </div>
    );
  }

  if (showImage) {
    return (
      <img
        src={displayUrl}
        alt={`${name ?? symbol} logo`}
        title={name ?? symbol}
        className={cn(
          "shrink-0 rounded-full bg-muted object-cover ring-1 ring-border/60",
          SIZE_CLASSES[size],
          className,
        )}
        onError={() => {
          if (type === "stock" && stockSourceIndex < stockSources.length - 1) {
            setStockSourceIndex((index) => index + 1);
            return;
          }
          setImageFailed(true);
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-1 ring-border/60",
        SIZE_CLASSES[size],
        className,
      )}
      title={name ?? symbol}
    >
      {getAssetFallbackLabel(symbol, type)}
    </div>
  );
}
