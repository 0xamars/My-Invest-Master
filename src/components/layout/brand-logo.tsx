import { MarketingHomeLink } from "@/components/layout/marketing-home-link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "sidebar" | "hero" | "lockup";
  className?: string;
  asLink?: boolean;
  priority?: boolean;
}

/** Compact letters for tight chrome only — not a product mark. Chili is not the mark. */
function BrandInitials({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(160deg,#E59570,#BD7A64)] text-[0.7rem] font-semibold tracking-tight text-white shadow-[0_0_18px_color-mix(in_srgb,#E59570_35%,transparent)]",
        className,
      )}
      aria-hidden
    >
      IS
    </span>
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

export function BrandLogo({
  variant = "sidebar",
  className,
  asLink = false,
}: BrandLogoProps) {
  let content: React.ReactNode;

  switch (variant) {
    case "icon":
      content = <BrandInitials className={className} />;
      break;

    case "lockup":
      content = (
        <div className={cn("flex min-w-0 items-center gap-3", className)}>
          <BrandInitials />
          <BrandWordmark className="text-lg leading-none" />
        </div>
      );
      break;

    case "hero":
      content = (
        <div className={cn("flex items-center gap-3", className)}>
          <BrandInitials className="size-12 rounded-2xl text-base" />
          <BrandWordmark className="text-3xl leading-none" />
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
          <BrandInitials className="hidden group-data-[collapsible=icon]:inline-flex" />
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
