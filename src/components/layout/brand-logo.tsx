import Image from "next/image";
import { MarketingHomeLink } from "@/components/layout/marketing-home-link";
import { BRAND } from "@/lib/brand/assets";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "sidebar" | "hero" | "lockup";
  className?: string;
  asLink?: boolean;
  priority?: boolean;
}

const TAGLINE = "Freedom, engineered.";

const ICON = BRAND.logoMark;

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
    <span className={cn("font-normal text-white/55", className)}>
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
          <BrandWordmark className="text-[1.05rem] leading-none" />
        </div>
      );
      break;

    case "hero":
      content = (
        <div className={cn("flex items-center gap-3", className)}>
          <SalsaMark className="size-11" size={44} priority={priority} />
          <div className="flex flex-col items-start gap-1">
            <BrandWordmark className="text-2xl leading-none" />
            <BrandTagline className="text-sm" />
          </div>
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
          <BrandWordmark className="text-[1.05rem] leading-none group-data-[collapsible=icon]:hidden" />
        </div>
      );
      break;
  }

  if (asLink) {
    return (
      <MarketingHomeLink className="inline-flex transition-opacity duration-200 hover:opacity-80">
        {content}
      </MarketingHomeLink>
    );
  }

  return content;
}
