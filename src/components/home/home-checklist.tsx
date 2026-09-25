import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyArt, StackArt } from "@/components/journey/empty-art";
import { IMAGINE_SLOTS } from "@/lib/brand/imagine-slots";
import {
  HOME_CHECKLIST_NOTE,
  HOME_CHECKLIST_TITLE,
  type HomeChecklistItem,
} from "@/lib/journey/home-checklist";
import { JOURNEY_EDUCATIONAL_FOOTER } from "@/lib/journey/empty-states";
import { cn } from "@/lib/utils";

export function HomeChecklist({ items }: { items: HomeChecklistItem[] }) {
  const undone = items.find((item) => !item.done) ?? items[0];

  return (
    <section
      className="budget-panel"
      data-home-checklist="1"
      aria-labelledby="home-checklist-title"
    >
      <div className="empty-stack">
        {IMAGINE_SLOTS["first-run-welcome"] ? (
          <StackArt slot="first-run-welcome" />
        ) : (
          <EmptyArt kind="home" />
        )}
        <h2 id="home-checklist-title" className="empty-stack-title">
          {HOME_CHECKLIST_TITLE}
        </h2>
        <p className="empty-stack-line">{HOME_CHECKLIST_NOTE}</p>
        <ol className="empty-stack-steps">
          {items.map((item, index) => (
            <li key={item.id}>
              <Link
                href={item.href}
                data-checklist-item={item.id}
                data-done={item.done ? "true" : "false"}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-muted/70"
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
        {undone ? (
          <div className="empty-stack-actions">
            <Button render={<Link href={undone.href} />}>{undone.label}</Button>
          </div>
        ) : null}
        <p className="empty-stack-note">{JOURNEY_EDUCATIONAL_FOOTER}</p>
      </div>
    </section>
  );
}
