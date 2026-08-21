import Image from "next/image";
import { MarketingHomeLink } from "@/components/layout/marketing-home-link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "sidebar" | "hero";
  className?: string;
  asLink?: boolean;
  priority?: boolean;
}

const iconSizes = {
  sidebar: { width: 40, height: 40, className: "size-10" },
  sidebarCollapsed: { width: 32, height: 32, className: "size-8" },
  hero: { width: 48, height: 48, className: "size-12" },
  default: { width: 40, height: 40, className: "size-10" },
} as const;

function BrandMark({
  className,
  priority = false,
  width,
  height,
}: {
  className?: string;
  priority?: boolean;
  width: number;
  height: number;
}) {
  return (
    <span
      className={cn(
        "brand-logo-icon-wrap inline-flex shrink-0 overflow-hidden rounded-[0.7rem] ring-1 ring-black/10 dark:ring-white/10",
        className,
      )}
    >
      <Image
        src="/brand/app-icon.png"
        alt=""
        width={width}
        height={height}
        priority={priority}
        aria-hidden
        className="brand-logo-icon h-full w-full object-cover"
      />
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
  priority = false,
}: BrandLogoProps) {
  let content: React.ReactNode;

  switch (variant) {
    case "icon":
      content = (
        <BrandMark
          priority={priority}
          width={iconSizes.default.width}
          height={iconSizes.default.height}
          className={iconSizes.default.className}
        />
      );
      break;

    case "hero":
      content = (
        <div className={cn("flex items-center gap-4", className)}>
          <BrandMark
            priority={priority}
            width={iconSizes.hero.width}
            height={iconSizes.hero.height}
            className={iconSizes.hero.className}
          />
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
          <BrandMark
            priority={priority}
            width={iconSizes.sidebar.width}
            height={iconSizes.sidebar.height}
            className={cn(
              iconSizes.sidebar.className,
              "group-data-[collapsible=icon]:size-8",
            )}
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
