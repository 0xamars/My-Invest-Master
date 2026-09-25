import Link from "next/link";
import { Check } from "lucide-react";
import { ImagineSlot } from "@/components/brand/imagine-slot";
import { EmptyArt } from "@/components/journey/empty-art";
import { IMAGINE_SLOTS } from "@/lib/brand/imagine-slots";
import {
  HOME_CHECKLIST_NOTE,
  HOME_CHECKLIST_TITLE,
  type HomeChecklistItem,
} from "@/lib/journey/home-checklist";
import { JOURNEY_EDUCATIONAL_FOOTER } from "@/lib/journey/empty-states";
import { cn } from "@/lib/utils";

function FirstRunArt() {
  if (IMAGINE_SLOTS["first-run"]) return <ImagineSlot slot="first-run" />;
  if (IMAGINE_SLOTS["hero-home"]) return <ImagineSlot slot="hero-home" />;
  return <EmptyArt kind="home" />;
}

export function HomeChecklist({ items }: { items: HomeChecklistItem[] }) {
  return (
    <section
      className="budget-panel"
      data-home-checklist="1"
      aria-labelledby="home-checklist-title"
    >
      <div className="grid sm:grid-cols-[minmax(0,1fr)_13.5rem]">
      <div className="px-4 py-4 sm:px-5">
      <h2 id="home-checklist-title" className="text-sm font-semibold tracking-tight">
        {HOME_CHECKLIST_TITLE}
      </h2>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
        {HOME_CHECKLIST_NOTE}
      </p>
      <ol className="mt-3 space-y-0.5">
        {items.map((item, index) => (
          <li key={item.id}>
            <Link
              href={item.href}
              data-checklist-item={item.id}
              data-done={item.done ? "true" : "false"}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm hover:bg-muted/70"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums",
                  item.done
                    ? "border-[var(--brand-green)] bg-[var(--brand-green)]/15 text-[var(--brand-green-text)]"
                    : "border-border text-muted-foreground",
                )}
              >
                {item.done ? <Check className="size-3" /> : index + 1}
              </span>
              <span>
                {item.done ? <span className="sr-only">Done. </span> : null}
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {JOURNEY_EDUCATIONAL_FOOTER}
      </p>
      </div>
      <div className="checklist-art surface-0 flex items-center border-t border-border px-4 py-4 sm:border-t-0 sm:border-l sm:px-3">
        <FirstRunArt />
      </div>
      </div>
    </section>
  );
}
