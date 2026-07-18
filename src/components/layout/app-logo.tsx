import Image from "next/image";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { box: "size-8", image: 32, title: "text-sm", subtitle: "text-[10px]" },
  md: { box: "size-10", image: 40, title: "text-sm", subtitle: "text-xs" },
  lg: { box: "size-12", image: 48, title: "text-base", subtitle: "text-xs" },
} as const;

export function AppLogo({
  showText = true,
  size = "md",
  className,
}: AppLogoProps) {
  const sizing = sizeMap[size];

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.65)]",
          sizing.box,
        )}
      >
        <Image
          src="/logo.png"
          alt="My Invest Master"
          width={sizing.image}
          height={sizing.image}
          className="size-full object-cover"
          priority
        />
      </div>
      {showText && (
        <div className="grid min-w-0 flex-1 text-left leading-tight">
          <span
            className={cn(
              "truncate font-semibold tracking-wide metallic-text",
              sizing.title,
            )}
          >
            My Invest Master
          </span>
          <span
            className={cn(
              "truncate text-muted-foreground tracking-wide",
              sizing.subtitle,
            )}
          >
            Portfolio Tracker
          </span>
        </div>
      )}
    </div>
  );
}
