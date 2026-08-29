import Image from "next/image";
import { MarketingHomeLink } from "@/components/layout/marketing-home-link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "sidebar" | "hero" | "lockup";
  className?: string;
  asLink?: boolean;
  priority?: boolean;
}

const TAGLINE = "Freedom, engineered.";

const ICON = "/brand/logo-icon.png";
const STACKED = "/brand/logo-lockup.png";

/** Growth line + salsa swooshes — the locked InvestSalsa mark. */
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
    <Image
      src={ICON}
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={cn(
        "brand-logo-icon size-8 shrink-0 object-contain",
        className,
      )}
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

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "brand-wordmark inline-flex items-center whitespace-nowrap font-semibold tracking-tight",
        className,
      )}
    >
      InvestSalsa
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
      content = <SalsaMark className={className} priority={priority} />;
      break;

    case "lockup":
      content = (
        <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
          <SalsaMark priority={priority} />
          <BrandWordmark className="text-lg leading-none" />
        </div>
      );
      break;

    case "hero":
      content = (
        <div className={cn("flex flex-col items-center gap-2", className)}>
          <Image
            src={STACKED}
            alt="InvestSalsa"
            width={450}
            height={338}
            priority={priority}
            className="h-auto w-[min(16rem,70vw)] object-contain"
          />
          <BrandTagline className="text-sm" />
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
          <SalsaMark
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
