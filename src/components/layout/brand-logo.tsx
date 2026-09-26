import { MarketingHomeLink } from "@/components/layout/marketing-home-link";
import { BRAND } from "@/lib/brand/assets";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "sidebar" | "hero" | "lockup";
  className?: string;
  asLink?: boolean;
  priority?: boolean;
}

const TAGLINE = "Retire, engineered.";

/** Brush S from the wordmark. Outline letters disappear at this size. */
export function SalsaMark({
  className,
  size = 32,
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    // next/image rejects SVG sources. The mark is a few-KB transparent file.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND.logoMark}
      alt=""
      width={size}
      height={size}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("brand-logo-icon size-8 shrink-0 object-contain", className)}
    />
  );
}

/** @deprecated Use SalsaMark. Kept so existing imports keep working. */
export function CometMark(props: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return <SalsaMark {...props} />;
}

/** Full InvestSalsa wordmark. Paths only — no webfont. */
export function BrandWordmark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND.wordmark}
      alt="InvestSalsa"
      width={417}
      height={100}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn(
        "brand-wordmark-svg h-9 w-auto shrink-0 object-contain md:h-11",
        className,
      )}
    />
  );
}

export function BrandTagline({ className }: { className?: string }) {
  return (
    <span className={cn("type-small font-normal text-[var(--fg-muted)]", className)}>
      {TAGLINE}
    </span>
  );
}

export function BrandLogo({
  variant = "sidebar",
  className,
  asLink = false,
  priority = false,
}: BrandLogoProps) {
  let content: React.ReactNode;

  switch (variant) {
    case "icon":
      content = <SalsaMark className={className} priority={priority} />;
      break;

    case "hero":
      content = (
        <div className={cn("flex flex-col items-start gap-2", className)}>
          <BrandWordmark className="h-16 max-w-none sm:h-20 md:h-20" priority={priority} />
          <BrandTagline className="text-sm" />
        </div>
      );
      break;

    default:
      content = (
        <div className={cn("flex min-w-0 items-center", className)}>
          <BrandWordmark priority={priority} />
        </div>
      );
      break;
  }

  if (asLink) {
    return (
      <MarketingHomeLink className="inline-flex shrink-0 items-center transition-opacity duration-200 hover:opacity-80">
        {content}
      </MarketingHomeLink>
    );
  }

  return content;
}
