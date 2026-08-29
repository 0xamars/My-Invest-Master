"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { ChoiceGroup } from "@/components/journey/choice-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import {
  LEARN_DISCLAIMER,
  lessonById,
  lessonsForPillar,
  type LearnLesson,
} from "@/lib/journey/lessons";
import { isLessonComplete, markLessonComplete } from "@/lib/journey/profile";
import { MONEY_PROFILE_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { JourneyPillar } from "@/types/money-profile";

const PILLAR_LABEL: Record<JourneyPillar, string> = {
  budget: "Budget",
  invest: "Invest",
  freedom: "Freedom",
};

function LessonChecks({ lesson }: { lesson: LearnLesson }) {
  const checks = lesson.checks ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (checks.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <p className="text-sm font-medium">Quick check</p>
      {checks.map((check) => {
        const picked = answers[check.id] ?? "";
        const showResult = picked.length > 0;
        const correct = picked === check.correctId;
        return (
          <div key={check.id} className="space-y-2">
            <ChoiceGroup
              legend={check.prompt}
              name={`${lesson.id}-${check.id}`}
              value={picked}
              options={check.options.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              onChange={(next) =>
                setAnswers((current) => ({ ...current, [check.id]: next }))
              }
            />
            {showResult ? (
              <p
                className={cn(
                  "text-xs",
                  correct ? "text-primary" : "text-muted-foreground",
                )}
              >
                {correct
                  ? "That matches the tool."
                  : "Look at the tool if this and the screen disagree."}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function LessonDetail({
  lesson,
  completed,
  onComplete,
  isSaving,
  hasProfile,
}: {
  lesson: LearnLesson;
  completed: boolean;
  onComplete: () => void;
  isSaving: boolean;
  hasProfile: boolean;
}) {
  return (
    <article className="surface-card space-y-4 px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold tracking-tight">{lesson.title}</h3>
        {completed ? (
          <Badge variant="outline">
            <Check className="size-3" />
            Done
          </Badge>
        ) : null}
      </div>
      {lesson.paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
          {paragraph}
        </p>
      ))}
      <LessonChecks key={lesson.id} lesson={lesson} />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" render={<Link href={lesson.cta.href} />}>
          Do this in the app now
        </Button>
        {hasProfile ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={completed || isSaving}
            onClick={onComplete}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            {completed ? "Completed" : "Mark complete"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            render={<Link href={MONEY_PROFILE_PATH} />}
          >
            Save a Money Profile to keep this
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{lesson.cta.label}</p>
    </article>
  );
}

export function LearnPanel({
  pillar,
  lessonId,
  collapsed,
  onSelectLesson,
}: {
  pillar: JourneyPillar;
  lessonId: string | null;
  collapsed: boolean;
  onSelectLesson: (id: string) => void;
}) {
  const { profile, saveProfile, isSaving } = useMoneyProfile();
  const lessons = lessonsForPillar(pillar);
  const selected =
    (lessonId ? lessonById(lessonId) : undefined) ??
    lessons.find((lesson) => !isLessonComplete(profile, lesson.id)) ??
    lessons[0];

  const doneCount = useMemo(
    () => lessons.filter((lesson) => isLessonComplete(profile, lesson.id)).length,
    [lessons, profile],
  );

  async function completeSelected() {
    if (!profile || !selected) return;
    await saveProfile(markLessonComplete(profile, selected.id));
  }

  const list = (
    <ol className="grid gap-2">
      {lessons.map((lesson, index) => {
        const done = isLessonComplete(profile, lesson.id);
        const active = selected?.id === lesson.id;
        return (
          <li key={lesson.id}>
            <button
              type="button"
              onClick={() => onSelectLesson(lesson.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex border border-border bg-muted w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="mt-0.5 w-5 shrink-0 text-xs font-medium">
                {done ? <Check className="size-3.5 text-primary" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {lesson.title}
                </span>
                {collapsed ? (
                  <span className="mt-1 block text-xs leading-relaxed opacity-80">
                    {lesson.keyIdea}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <h2 className="page-title">Learn {PILLAR_LABEL[pillar]}</h2>
        <p className="page-description">
          {doneCount} of {lessons.length} complete. Short reads. The tool wins if
          a screen and a lesson disagree.
        </p>
      </div>

      {collapsed ? (
        <details className="surface-card px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Key ideas
          </summary>
          <div className="mt-3 space-y-3">
            {list}
          </div>
        </details>
      ) : (
        list
      )}

      {selected ? (
        <LessonDetail
          lesson={selected}
          completed={isLessonComplete(profile, selected.id)}
          onComplete={() => void completeSelected()}
          isSaving={isSaving}
          hasProfile={profile !== null}
        />
      ) : null}

      <p className="text-xs text-muted-foreground">{LEARN_DISCLAIMER}</p>
    </div>
  );
}
