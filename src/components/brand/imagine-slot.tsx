import Image from "next/image";
import {
  IMAGINE_SLOTS,
  type ImagineSlotId,
} from "@/lib/brand/imagine-slots";
import { cn } from "@/lib/utils";

export function ImagineSlot({
  slot,
  size = "hero",
  className,
}: {
  slot: ImagineSlotId;
  size?: "hero" | "welcome" | "accent";
  className?: string;
}) {
  const art = IMAGINE_SLOTS[slot];
  return (
    <div
      className={cn("imagine-slot", `imagine-slot--${size}`, className)}
      data-imagine-slot={slot}
      aria-hidden
    >
      <Image
        src={art.src}
        alt=""
        width={art.width}
        height={art.height}
        sizes={size === "accent" ? "48px" : "208px"}
        className="imagine-slot-image"
      />
    </div>
  );
}
