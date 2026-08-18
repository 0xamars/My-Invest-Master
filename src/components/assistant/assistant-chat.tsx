"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Lock,
  Minimize2,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAssistantContext } from "@/hooks/use-assistant-context";
import { ASSISTANT_DISCLAIMER, buildWelcomeMessage } from "@/lib/assistant/system-prompt";
import type { AssistantChatMessage } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function createId() {
  return crypto.randomUUID();
}

function renderMessageText(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function AssistantChat() {
  const {
    page,
    starterQuestions,
    context,
    isAuthenticated,
    authRequired,
    isAuthLoading,
  } = useAssistantContext();

  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [messages, setMessages] = useState<UiMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content: buildWelcomeMessage(page.title),
    },
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastPageIdRef = useRef(page.id);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, open, showSuggestions]);

  useEffect(() => {
    if (open && isAuthenticated) {
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, isAuthenticated]);

  // Refresh page-aware welcome / suggestions when the route changes
  useEffect(() => {
    if (lastPageIdRef.current === page.id) return;
    lastPageIdRef.current = page.id;

    setShowSuggestions(true);
    setMessages((prev) => {
      const hasUserMessages = prev.some((message) => message.role === "user");
      if (hasUserMessages) {
        return [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content: `You've moved to **${page.title}**. I can help with this page specifically — ask a question or pick a suggestion below.`,
          },
        ];
      }
      return [
        {
          id: "welcome",
          role: "assistant",
          content: buildWelcomeMessage(page.title),
        },
      ];
    });
  }, [page.id, page.title]);

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || isSending) return;

    if (!isAuthenticated) {
      setAuthOpen(true);
      setError("Sign in to use the InvestSalsa assistant.");
      return;
    }

    setError(null);
    setInput("");
    setShowSuggestions(false);

    const userMessage: UiMessage = {
      id: createId(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsSending(true);

    const history: AssistantChatMessage[] = nextMessages
      .filter((message) => message.id !== "welcome")
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          context,
        }),
      });

      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
      };

      if (response.status === 401) {
        setAuthOpen(true);
        throw new Error(payload.error || "Sign in to continue.");
      }

      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "Something went wrong.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: payload.reply!,
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not reach the assistant.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content:
            "I couldn't complete that reply. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleClose() {
    setOpen(false);
  }

  function handleClear() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: buildWelcomeMessage(page.title),
      },
    ]);
    setShowSuggestions(true);
    setError(null);
  }

  const canChat = isAuthenticated && !isAuthLoading;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="assistant-fab"
          onClick={() => setOpen(true)}
          aria-label="Open InvestSalsa assistant"
        >
          <span className="assistant-fab-ring" aria-hidden />
          <span className="assistant-fab-glow" aria-hidden />
          <span className="assistant-fab-core">
            <Sparkles className="assistant-fab-icon" strokeWidth={2.25} />
          </span>
        </button>
      )}

      {open && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex w-[min(100vw-1.5rem,24rem)] flex-col overflow-hidden rounded-2xl border border-border/70",
            "bg-card/95 shadow-2xl shadow-black/50 backdrop-blur-xl",
            "h-[min(72vh,38rem)]",
          )}
          role="dialog"
          aria-label="InvestSalsa assistant"
        >
          <div className="flex items-start gap-3 border-b border-border/60 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--brand-green)_20%,transparent),color-mix(in_oklch,var(--brand-orange)_12%,transparent))] px-4 py-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-green)]/20 text-[var(--brand-green)]">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                InvestSalsa
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Context · {page.title}
                {context.dataScopes.length > 0
                  ? ` · ${context.dataScopes.join(", ")}`
                  : " · guidance"}
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleClose}
                aria-label="Minimize assistant"
                className="text-muted-foreground"
              >
                <Minimize2 className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleClose}
                aria-label="Close assistant"
                className="text-muted-foreground"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="border-b border-border/50 px-4 py-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {ASSISTANT_DISCLAIMER}
            </p>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 px-4 py-4">
              {!canChat && authRequired && !isAuthLoading && (
                <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Lock className="size-4 text-[var(--brand-orange)]" />
                    Sign in required
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                    The assistant can answer questions about your portfolio,
                    retirement plans, and budget only after you sign in.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setAuthOpen(true)}
                    >
                      Sign in
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      render={<Link href="/login" />}
                    >
                      Go to Home
                    </Button>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      message.role === "user"
                        ? "bg-[var(--brand-green)]/18 text-foreground"
                        : "border border-border/60 bg-muted/30 text-foreground/95",
                    )}
                  >
                    {renderMessageText(message.content)}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-[var(--brand-green)]" />
                    InvestSalsa is typing…
                  </div>
                </div>
              )}

              {canChat && showSuggestions && !isSending && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Suggested for {page.title}
                  </p>
                  <div className="flex flex-col gap-2">
                    {starterQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void sendMessage(question)}
                        className="rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-left text-xs text-foreground/90 transition-colors hover:border-[var(--brand-green)]/40 hover:bg-[var(--brand-green)]/8"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {error && (
            <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <form
            className="flex items-center gap-2 border-t border-border/60 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(input);
            }}
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                canChat
                  ? `Ask about ${page.title}…`
                  : "Sign in to chat with InvestSalsa…"
              }
              disabled={isSending || !canChat}
              className="h-10 flex-1 bg-background/50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isSending || !canChat || !input.trim()}
              aria-label="Send message"
              className="size-10 shrink-0"
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </Button>
          </form>

          <div className="flex items-center justify-between border-t border-border/40 px-3 py-1.5">
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear chat
            </button>
            <span className="text-[11px] text-muted-foreground">
              Session only · not advice
            </span>
          </div>
        </div>
      )}

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
