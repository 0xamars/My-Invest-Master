import Image from "next/image";
import {
  IMAGINE_SLOTS,
  type ImagineSlotId,
} from "@/lib/brand/imagine-slots";
import { EMPTY_ART, type EmptyArtKind } from "@/lib/journey/empty-art";

/**
 * Centered empty-state illustration, in normal flow above the title.
 */
export function StackArt({
  kind,
  slot,
}: {
  kind?: EmptyArtKind;
  slot?: ImagineSlotId;
}) {
  const art = slot ? IMAGINE_SLOTS[slot] : kind ? EMPTY_ART[kind] : null;
  if (!art) return null;

  return (
    <div
      className="empty-stack-art"
      data-empty-art={kind}
      data-imagine-slot={slot}
    >
      <Image
        src={art.src}
        alt={art.alt}
        width={art.width}
        height={art.height}
        sizes="(min-width: 640px) 176px, 120px"
        className="empty-stack-image"
      />
    </div>
  );
}

export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
  return <StackArt kind={kind} />;
}
