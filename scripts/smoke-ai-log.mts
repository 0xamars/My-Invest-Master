/**
 * Confirm [ai] log lines for ok + no_key fallback.
 * Does not print secrets. Unsets key only in this process after import setup.
 */
delete process.env.OPENROUTER_API_KEY;
process.env.OPENROUTER_API_KEY = "";

const { complete } = await import("../src/lib/ai/client.ts");
const { logAiFallback } = await import("../src/lib/ai/log.ts");

try {
  await complete({
    feature: "analysis.company_blurb",
    messages: [{ role: "user", content: "ping" }],
  });
  console.log("unexpected success");
} catch {
  /* expected */
}

logAiFallback("analysis.company_blurb", "empty");
logAiFallback("chat.assistant", "error");
