export {
  EARLY_OPP_FRAMEWORK_ID,
  EARLY_OPP_FRAMEWORK_VERSION,
  EARLY_OPP_STEPS,
  EARLY_OPP_STEP_IDS,
  earlyOppStepById,
  type EarlyOppStepDef,
  type EarlyOppStepId,
} from "@/lib/analysis/early-opp/steps";
export { extractEarlyOppFacts, type EarlyOppFacts } from "@/lib/analysis/early-opp/facts";
export { EARLY_OPP_DISCLAIMER, statusLabel } from "@/lib/analysis/early-opp/format";
export { scoreEarlyOppSteps, earlyOppCountsFromSteps } from "@/lib/analysis/early-opp/score";
export { buildEarlyOppPayload } from "@/lib/analysis/early-opp/generate";
export type {
  EarlyOppAiMeta,
  EarlyOppCounts,
  EarlyOppNumber,
  EarlyOppPayload,
  EarlyOppQualitativeOverlay,
  EarlyOppStatus,
  EarlyOppStepResult,
} from "@/lib/analysis/early-opp/types";
