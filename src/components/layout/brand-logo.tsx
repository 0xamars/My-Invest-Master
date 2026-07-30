import Image from "next/image";
import Link from "next/link";
import { MARKETING_HOME_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "sidebar" | "hero";
  className?: string;
  asLink?: boolean;
  priority?: boolean;
}

const iconSizes = {
  sidebar: { width: 58, height: 68, className: "h-[4.25rem] w-[3.5rem]" },
  sidebarCollapsed: { width: 46, height: 54, className: "h-[3.375rem] w-[2.875rem]" },
  hero: { width: 68, height: 80, className: "h-20 w-[4.25rem]" },
  default: { width: 58, height: 68, className: "h-[4.25rem] w-[3.5rem]" },
} as const;

function ThemeBrandIcon({
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
        "brand-logo-icon-wrap inline-flex shrink-0 items-center justify-center overflow-visible",
        className,
      )}
    >
      <Image
        src="/brand/logo-icon-light.png"
        alt=""
        width={width}
        height={height}
        priority={priority}
        aria-hidden
        className="brand-logo-icon h-full w-full object-contain object-center dark:hidden"
      />
      <Image
        src="/brand/logo-icon-dark.png"
        alt=""
        width={width}
        height={height}
        priority={priority}
        aria-hidden
        className="brand-logo-icon hidden h-full w-full object-contain object-center dark:block"
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
        <ThemeBrandIcon
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
          <ThemeBrandIcon
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
            "flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:justify-center",
            className,
          )}
        >
          <ThemeBrandIcon
            priority={priority}
            width={iconSizes.sidebar.width}
            height={iconSizes.sidebar.height}
            className={cn(
              iconSizes.sidebar.className,
              "group-data-[collapsible=icon]:h-[3.375rem] group-data-[collapsible=icon]:w-[2.875rem]",
            )}
          />
          <BrandWordmark className="text-lg leading-none group-data-[collapsible=icon]:hidden" />
        </div>
      );
      break;
  }

  if (asLink) {
    return (
      <Link
        href={MARKETING_HOME_PATH}
        className="inline-flex transition-opacity hover:opacity-90"
      >
        {content}
      </Link>
    );
  }

  return content;
}
