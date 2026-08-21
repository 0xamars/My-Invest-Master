import { MarketingHomeLink } from "@/components/layout/marketing-home-link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "sidebar" | "hero" | "lockup";
  className?: string;
  asLink?: boolean;
  priority?: boolean;
}

const TAGLINE = "Freedom, engineered.";

/** Compact shooting-star mark — favicon / header / collapsed chrome. */
export function CometMark({
  className,
  size = 32,
  priority: _priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    // Compact two-stripe comet mark — not the long-streak hero.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/comet-mark.svg"
      alt=""
      width={size}
      height={size}
      className={cn(
        "brand-logo-icon size-8 shrink-0 object-contain",
        className,
      )}
    />
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap font-semibold tracking-tight",
        className,
      )}
    >
      <span className="brand-text-invest">Invest</span>
      <span className="brand-text-salsa">Salsa</span>
    </span>
  );
}

export function BrandTagline({ className }: { className?: string }) {
  return (
    <span className={cn("font-normal tracking-[0.04em] text-white/80", className)}>
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
      content = <CometMark className={className} priority={priority} />;
      break;

    case "lockup":
      content = (
        <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
          <CometMark priority={priority} />
          <BrandWordmark className="text-lg leading-none" />
        </div>
      );
      break;

    case "hero":
      content = (
        <div className={cn("flex flex-col items-start gap-2", className)}>
          <div className="flex items-center gap-3">
            <CometMark className="size-12" size={48} priority={priority} />
            <BrandWordmark className="text-3xl leading-none" />
          </div>
          <BrandTagline className="pl-[3.75rem] text-sm" />
        </div>
      );
      break;

    default:
      content = (
        <div
          className={cn(
            "flex min-w-0 items-center gap-2.5 group-data-[collapsible=icon]:justify-center",
            className,
          )}
        >
          <CometMark
            className="size-8 group-data-[collapsible=icon]:size-8"
            priority={priority}
          />
          <BrandWordmark className="text-lg leading-none group-data-[collapsible=icon]:hidden" />
        </div>
      );
      break;
  }

  if (asLink) {
    return (
      <MarketingHomeLink className="inline-flex transition-opacity hover:opacity-90">
        {content}
      </MarketingHomeLink>
    );
  }

  return content;
}
