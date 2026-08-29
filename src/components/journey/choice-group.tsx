"use client";

import { cn } from "@/lib/utils";

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export function ChoiceGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  columns = 1,
}: {
  legend: string;
  name: string;
  value: T | null | "";
  options: readonly ChoiceOption<T>[];
  onChange: (next: T) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <div
        className={cn(
          "grid gap-2",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3",
        )}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              name={name}
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-xl border border-border bg-muted px-3 py-3 text-left transition-colors",
                selected
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              {option.description ? (
                <span className="mt-1 block text-xs leading-relaxed opacity-80">
                  {option.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
