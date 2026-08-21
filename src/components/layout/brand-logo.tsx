import { MarketingHomeLink } from "@/components/layout/marketing-home-link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "sidebar" | "hero";
  className?: string;
  asLink?: boolean;
  priority?: boolean;
}

/** Compact letters for tight chrome only — not a product mark. */
function BrandInitials({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#16181D] text-[0.7rem] font-semibold tracking-tight text-[#A3E635] ring-1 ring-white/10",
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

    case "hero":
      content = (
        <BrandWordmark className={cn("text-3xl leading-none", className)} />
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
