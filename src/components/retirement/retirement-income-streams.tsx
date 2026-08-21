"use client";

import { Plus, Trash2 } from "lucide-react";
import { RetireField, RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createIncomeStream,
  RETIREMENT_INCOME_KIND_LABELS,
  type RetirementIncomeKind,
  type RetirementIncomeStream,
} from "@/types/retirement";

const QUICK_KINDS: RetirementIncomeKind[] = ["cpp", "oas", "pension", "other"];

export function RetirementIncomeStreams({
  streams,
  onChange,
}: {
  streams: RetirementIncomeStream[];
  onChange: (streams: RetirementIncomeStream[]) => void;
}) {
  function patch(id: string, next: Partial<RetirementIncomeStream>) {
    onChange(
      streams.map((stream) =>
        stream.id === id ? { ...stream, ...next } : stream,
      ),
    );
  }

  return (
    <RetirePanel className="px-5 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Income streams</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            CPP, OAS, pension, or other. After the target age, portfolio withdrawal
            is spending minus income that year.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_KINDS.map((kind) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => onChange([...streams, createIncomeStream(kind)])}
            >
              <Plus className="size-3.5" />
              {RETIREMENT_INCOME_KIND_LABELS[kind]}
            </Button>
          ))}
        </div>
      </div>

      {streams.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No income yet. US Social Security can be an Other income row.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {streams.map((stream) => (
            <div
              key={stream.id}
              className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_auto] sm:items-end"
            >
              <RetireField label="Name">
                <Input
                  value={stream.name}
                  onChange={(event) =>
                    patch(stream.id, { name: event.target.value })
                  }
                />
              </RetireField>
              <RetireField label="Annual amount today">
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={stream.annualAmount}
                  onChange={(event) =>
                    patch(stream.id, {
                      annualAmount: Number(event.target.value) || 0,
                    })
                  }
                  className="tabular-nums"
                />
              </RetireField>
              <RetireField label="Start age">
                <Input
                  type="number"
                  min="0"
                  max="120"
                  value={stream.startAge}
                  onChange={(event) =>
                    patch(stream.id, {
                      startAge: Number(event.target.value) || 0,
                    })
                  }
                  className="tabular-nums"
                />
              </RetireField>
              <RetireField label="COLA">
                <Button
                  type="button"
                  variant={stream.colaWithInflation ? "default" : "outline"}
                  onClick={() =>
                    patch(stream.id, {
                      colaWithInflation: !stream.colaWithInflation,
                    })
                  }
                >
                  {stream.colaWithInflation ? "Tracks inflation" : "Flat"}
                </Button>
              </RetireField>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onChange(streams.filter((item) => item.id !== stream.id))
                }
                aria-label={`Remove ${stream.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </RetirePanel>
  );
}
