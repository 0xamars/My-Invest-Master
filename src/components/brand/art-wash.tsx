import Image from "next/image";
import {
  IMAGINE_SLOTS,
  type ImagineSlotId,
} from "@/lib/brand/imagine-slots";
import { EMPTY_ART, type EmptyArtKind } from "@/lib/journey/empty-art";
import { cn } from "@/lib/utils";

/**
 * Imagine art as a soft wash inside a card. Black canvases screen out so
 * only the luminous green remains, capped near a watermark.
 */
export function ArtWash({
  slot,
  kind,
  strength = "ambient",
}: {
  slot?: ImagineSlotId;
  kind?: EmptyArtKind;
  strength?: "ambient" | "empty" | "welcome";
}) {
  const art = slot ? IMAGINE_SLOTS[slot] : kind ? EMPTY_ART[kind] : null;
  if (!art) return null;

  return (
    <div
      className={cn("art-wash", `art-wash--${strength}`)}
      data-art-wash={slot}
      data-empty-art={kind}
      aria-hidden
    >
      <Image
        src={art.src}
        alt=""
        width={art.width}
        height={art.height}
        sizes="720px"
        priority
        className="art-wash-image"
      />
    </div>
  );
}
