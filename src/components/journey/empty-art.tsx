import { ArtWash } from "@/components/brand/art-wash";
import type { EmptyArtKind } from "@/lib/journey/empty-art";

export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
  return <ArtWash kind={kind} strength="empty" />;
}
