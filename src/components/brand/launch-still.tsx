import Image from "next/image";
import type { ReactNode } from "react";
import { LAUNCH_STILLS, type LaunchStillId } from "@/lib/brand/stills";
import { cn } from "@/lib/utils";

const STILL_ALT: Record<LaunchStillId, string> = {
  hero: "",
  heroLockup: "",
  freedom: "",
  home: "",
  budget: "",
  invest: "",
};

export function LaunchStillFrame({
  still,
  children,
  scrim = "right",
  className,
  minHeightClass = "min-h-[18rem]",
  priority = false,
}: {
  still: LaunchStillId;
  children: ReactNode;
  scrim?: "right" | "left" | "center";
  className?: string;
  minHeightClass?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("launch-still-frame text-white", minHeightClass, className)}>
      <Image
        src={LAUNCH_STILLS[still]}
        alt={STILL_ALT[still]}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 72rem, 100vw"
        className="launch-still-media"
      />
      <div
        className={cn(
          "launch-still-scrim",
          scrim === "center" && "launch-still-scrim--center",
          scrim === "left" && "launch-still-scrim--left",
        )}
        aria-hidden
      />
      <div className="relative z-10 flex h-full flex-col justify-center">
        {children}
      </div>
    </div>
  );
}

export function LaunchAtmosphere({
  still,
  className,
}: {
  still: LaunchStillId;
  className?: string;
}) {
  return (
    <div className={cn("launch-atmosphere", className)} aria-hidden>
      <Image
        src={LAUNCH_STILLS[still]}
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-top"
      />
    </div>
  );
}
