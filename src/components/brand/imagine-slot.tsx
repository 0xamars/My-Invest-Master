import Image from "next/image";
import {
  IMAGINE_SLOTS,
  type ImagineSlotId,
} from "@/lib/brand/imagine-slots";
import { cn } from "@/lib/utils";

export function ImagineSlot({
  slot,
  className,
}: {
  slot: ImagineSlotId;
  className?: string;
}) {
  const art = IMAGINE_SLOTS[slot];
  if (!art) return null;
  return (
    <div className={cn("imagine-slot", className)} data-imagine-slot={slot}>
      <Image
        src={art.src}
        alt={art.alt}
        width={art.width}
        height={art.height}
        sizes="240px"
        style={{ width: "100%", height: "auto" }}
      />
    </div>
  );
}
