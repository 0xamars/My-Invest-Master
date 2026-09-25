import Image from "next/image";
import { EMPTY_ART, type EmptyArtKind } from "@/lib/journey/empty-art";

export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
  const art = EMPTY_ART[kind];
  return (
    <div className="empty-art-frame" data-empty-art={kind}>
      <Image
        src={art.src}
        alt={art.alt}
        width={art.width}
        height={art.height}
        sizes="288px"
        className="empty-art"
        style={{ width: "100%", height: "auto" }}
      />
    </div>
  );
}
