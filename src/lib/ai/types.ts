export type AiFeatureId =
  | "analysis.company_blurb"
  | "analysis.narrative_bundle"
  | "analysis.future_outlook"
  | "invest.holding_thinking"
  | "chat.assistant";

export type AiFeatureConfig = {
  model: string;
  temperature: number;
  maxTokens: number;
};

export type AiMessageRole = "system" | "user" | "assistant";

export type AiMessage = {
  role: Exclude<AiMessageRole, "system">;
  content: string;
};

export type AiCompleteInput = {
  feature: AiFeatureId;
  messages: AiMessage[];
  system?: string;
  /** Hard abort for this completion (narrative uses this so the page cannot hang). */
  timeoutMs?: number;
};

export type AiCompletion = {
  text: string;
  feature: AiFeatureId;
  model: string;
  provider: "openrouter";
};

export class AiNotConfiguredError extends Error {
  readonly code = "AI_NOT_CONFIGURED" as const;

  constructor(message = "AI not configured") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export class AiRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiRequestError";
    this.status = status;
  }
}
