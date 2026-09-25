import { LayoutGrid, List } from "lucide-react";
import { DeskEmptyMark } from "@/components/layout/desk-empty-mark";
import type { EmptyArtKind } from "@/lib/journey/empty-art";

/**
 * Centered empty mark above the title. The Imagine PNGs stay unpainted
 * until their background matches the card, so this is the SVG / icon kit.
 */
export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
  return (
    <div className="empty-stack-mark" data-empty-art={kind} data-empty-kit="mark">
      {kind === "home" ? (
        <div className="desk-empty-icon" aria-hidden>
          <LayoutGrid className="size-5" />
        </div>
      ) : kind === "transactions" ? (
        <div className="desk-empty-icon" aria-hidden>
          <List className="size-5" />
        </div>
      ) : (
        <DeskEmptyMark kind={kind} />
      )}
    </div>
  );
}
