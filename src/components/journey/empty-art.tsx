import Image from "next/image";
import { EMPTY_ART, type EmptyArtKind } from "@/lib/journey/empty-art";

/**
 * Centered empty illustration, in normal flow above the title.
 * The file is unoptimized so the flat #141518 field is not recompressed
 * into a different plate.
 */
export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
  const art = EMPTY_ART[kind];
  return (
    <div className="empty-stack-art" data-empty-art={kind}>
      <Image
        src={art.src}
        alt={art.alt}
        width={art.width}
        height={art.height}
        unoptimized
        sizes="(min-width: 640px) 176px, 120px"
        className="empty-stack-image"
      />
    </div>
  );
}
