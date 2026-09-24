/**
 * Plaid sync correctness with sandbox-shaped fixtures. No live Plaid calls.
 *   npx tsx --tsconfig tsconfig.json scripts/test-plaid-sync-unit.mts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyPlaidImport } from "../src/lib/budget/plaid.ts";
import { syncPlaidTransactions } from "../src/lib/plaid/client.ts";
import { BudgetPlanConflictError } from "../src/lib/budget/plan-version.ts";
import { flushQueuedPlanSave } from "../src/lib/budget/plan-save-queue.ts";
import {
  advancePlaidCursor,
  commitPlaidCursorAfterSave,
  PLAID_CURSOR_NOT_SAVED,
  plaidSyncNeedsDurableSave,
} from "../src/lib/plaid/cursor.ts";
import {
  foldPlaidSyncPages,
  type PlaidSyncPage,
} from "../src/lib/plaid/sync-delta.ts";
import { verifyPlaidWebhookSignature } from "../src/lib/plaid/webhook-verify.ts";
import { POST as plaidWebhook } from "../src/app/api/plaid/webhook/route.ts";
import { createEmptyBudgetPlan, type BudgetPlan } from "../src/types/budget.ts";
import type { PlaidSyncPayload } from "../src/lib/plaid/types.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const account = {
  plaidAccountId: "sandbox_acc",
  name: "Sandbox Checking",
  officialName: "Sandbox Checking",
  mask: "0000",
  type: "depository",
  subtype: "checking",
};

function payload(
  plan: BudgetPlan,
  delta: ReturnType<typeof foldPlaidSyncPages>,
): PlaidSyncPayload {
  return {
    itemId: "item_sandbox",
    institutionName: "Sandbox Bank",
    syncedAt: "2026-09-24T00:00:00.000Z",
    accounts: [account],
    transactions: delta.added,
    modified: delta.modified,
    removedTransactionIds: delta.removed,
    cursor: delta.nextCursor
      ? { previous: null, next: delta.nextCursor }
      : undefined,
  };
}

function ids(plan: BudgetPlan): string[] {
  return plan.transactions.map((tx) => tx.importId ?? tx.id).sort();
}

const pendingPage: PlaidSyncPage = {
  added: [
    {
      transaction_id: "sandbox_tx_pending",
      account_id: "sandbox_acc",
      date: "2026-09-01",
      name: "SANDBOX COFFEE",
      merchant_name: "Sandbox Coffee",
      amount: 4.5,
      pending: true,
    },
  ],
  modified: [],
  removed: [],
  next_cursor: "cursor_1",
  has_more: false,
};

let memory: { cursor: string | null; plan: BudgetPlan } = {
  cursor: null,
  plan: createEmptyBudgetPlan("Sandbox"),
};
let seq = 0;

async function attempt(pages: PlaidSyncPage[], saveOk: boolean) {
  const delta = foldPlaidSyncPages(pages, memory.cursor ?? "");
  const applied = applyPlaidImport(
    memory.plan,
    payload(memory.plan, delta),
    () => `id-${(seq += 1)}`,
  );
  let committed = false;
  let saved = false;
  try {
    await commitPlaidCursorAfterSave({
      needsSave: plaidSyncNeedsDurableSave(payload(memory.plan, delta)),
      plan: applied.next,
      save: async (next) => {
        if (!saveOk) throw new Error("save failed");
        memory.plan = next;
        saved = true;
      },
      commit: async () => {
        const next = advancePlaidCursor({
          storedCursor: memory.cursor,
          baseCursor: memory.cursor,
          nextCursor: delta.nextCursor,
        });
        if (next.advanced) memory.cursor = next.cursor;
        committed = next.advanced;
      },
    });
  } catch (error) {
    assert(!saved, "failed save does not keep the plan");
    assert(!committed, "failed save does not advance the cursor");
    assert(error instanceof Error && error.message === "save failed", "save error surfaces");
  }
  return { applied, committed, saved, delta };
}

const failed = await attempt([pendingPage], false);
assert(!failed.saved && !failed.committed, "failed save leaves the bookmark");
assert(memory.cursor === null, "cursor stays null after a failed save");
assert(memory.plan.transactions.length === 0, "failed save does not keep transactions");

const added = await attempt([pendingPage], true);
assert(added.saved && added.committed, "successful save advances the cursor");
assert(memory.cursor === "cursor_1", "cursor is the page bookmark");
assert(added.applied.imported === 1, "pending transaction is added once");
assert(memory.plan.transactions.length === 1, "one sandbox row");
const pendingRow = memory.plan.transactions[0]!;
assert(pendingRow.importId === "plaid:sandbox_tx_pending", "import id is the pending id");
assert(pendingRow.cleared === "uncleared", "pending stays uncleared");
pendingRow.categoryId = "sandbox-dining";
pendingRow.categoryManual = true;
const pendingBudgetId = pendingRow.id;

const replay = await attempt([pendingPage], true);
assert(replay.applied.duplicates === 1, "repeat sync of the same add is a duplicate");
assert(replay.applied.imported === 0, "repeat sync does not insert again");
assert(memory.plan.transactions.length === 1, "repeat sync stays one row");
assert(
  advancePlaidCursor({
    storedCursor: "cursor_1",
    baseCursor: null,
    nextCursor: "cursor_1",
  }).advanced === false,
  "a stale tab cannot rewind the cursor",
);

const modifiedPage: PlaidSyncPage = {
  added: [],
  modified: [
    {
      transaction_id: "sandbox_tx_pending",
      account_id: "sandbox_acc",
      date: "2026-09-01",
      name: "SANDBOX COFFEE",
      merchant_name: "Sandbox Coffee",
      amount: 5.25,
      pending: true,
    },
  ],
  removed: [],
  next_cursor: "cursor_2",
  has_more: false,
};
const modified = await attempt([modifiedPage], true);
assert(modified.applied.updated === 1, "modified updates the existing row");
assert(modified.applied.imported === 0, "modified is not a second insert");
assert(memory.plan.transactions.length === 1, "modify keeps a single row");
assert(memory.plan.transactions[0]!.amount === 5.25, "modified amount is applied");
assert(
  memory.plan.transactions[0]!.categoryId === "sandbox-dining",
  "modified keeps the category the user set",
);
assert(memory.cursor === "cursor_2", "cursor follows the modify");

const postedPages: PlaidSyncPage[] = [
  {
    added: [
      {
        transaction_id: "sandbox_tx_posted",
        account_id: "sandbox_acc",
        date: "2026-09-02",
        name: "SANDBOX COFFEE",
        merchant_name: "Sandbox Coffee",
        amount: 5.25,
        pending: false,
        pending_transaction_id: "sandbox_tx_pending",
      },
    ],
    modified: [],
    removed: [{ transaction_id: "sandbox_tx_pending" }],
    next_cursor: "cursor_3a",
    has_more: true,
  },
  {
    added: [],
    modified: [],
    removed: [],
    next_cursor: "cursor_3",
    has_more: false,
  },
];
const foldedPost = foldPlaidSyncPages(postedPages, "cursor_2");
assert(
  foldedPost.added.some((tx) => tx.transactionId === "sandbox_tx_posted") &&
    !foldedPost.added.some((tx) => tx.transactionId === "sandbox_tx_pending"),
  "pending-to-posted fold keeps the posted id only",
);
assert(
  foldedPost.removed.includes("sandbox_tx_pending"),
  "pending id is in removed",
);
const posted = await attempt(postedPages, true);
assert(posted.applied.imported === 0, "posted row replaces the pending row");
assert(posted.applied.removed === 0, "pending id is not deleted after it is retargeted");
assert(memory.plan.transactions.length === 1, "pending-to-posted is still one row");
const postedRow = memory.plan.transactions[0]!;
assert(postedRow.id === pendingBudgetId, "the budget row id is kept");
assert(postedRow.importId === "plaid:sandbox_tx_posted", "import id follows the posted transaction");
assert(postedRow.cleared === "cleared", "posted transaction is cleared");
assert(postedRow.categoryId === "sandbox-dining", "category survives pending-to-posted");
assert(memory.cursor === "cursor_3", "cursor follows the last page");

const postedAgain = await attempt(postedPages, true);
assert(postedAgain.applied.imported === 0, "replaying pending-to-posted adds nothing");
assert(postedAgain.applied.removed === 0, "replaying pending-to-posted deletes nothing");
assert(ids(memory.plan).join(",") === "plaid:sandbox_tx_posted", "replay keeps the posted import id");

const removedPage: PlaidSyncPage = {
  added: [],
  modified: [],
  removed: [{ transaction_id: "sandbox_tx_posted" }],
  next_cursor: "cursor_4",
  has_more: false,
};
const removed = await attempt([removedPage], true);
assert(removed.applied.removed === 1, "removed transaction is deleted");
assert(memory.plan.transactions.length === 0, "removed row is gone");
const removedAgain = await attempt([removedPage], true);
assert(removedAgain.applied.removed === 0, "removing an absent row is a no-op");
assert(memory.plan.transactions.length === 0, "second remove stays empty");

const calls: Array<string | undefined> = [];
const paged = await syncPlaidTransactions({
  accessToken: "access-sandbox",
  cursor: null,
  post: async (_path, body) => {
    calls.push(typeof body.cursor === "string" ? body.cursor : undefined);
    if (!body.cursor) {
      return {
        added: pendingPage.added,
        modified: [],
        removed: [],
        next_cursor: "cursor_a",
        has_more: true,
      };
    }
    return {
      added: [],
      modified: [
        {
          transaction_id: "sandbox_tx_pending",
          account_id: "sandbox_acc",
          date: "2026-09-01",
          name: "SANDBOX COFFEE",
          amount: 6,
          pending: false,
        },
      ],
      removed: [],
      next_cursor: "cursor_b",
      has_more: false,
    };
  },
});
assert(calls[0] === undefined && calls[1] === "cursor_a", "sync walks next_cursor");
assert(paged.added.length === 1 && paged.added[0]!.amount === 6, "later modify of an add stays added");
assert(paged.modified.length === 0, "same-update modify is not a second bucket");
assert(paged.removed.length === 0, "nothing was removed");
assert(paged.nextCursor === "cursor_b", "sync returns the last cursor");

const syncRoute = readFileSync(
  join(process.cwd(), "src/app/api/plaid/sync/route.ts"),
  "utf8",
);
const exchangeRoute = readFileSync(
  join(process.cwd(), "src/app/api/plaid/exchange/route.ts"),
  "utf8",
);
const reconnectRoute = readFileSync(
  join(process.cwd(), "src/app/api/plaid/reconnect/route.ts"),
  "utf8",
);
const bankLink = readFileSync(
  join(process.cwd(), "src/components/budget/budget-bank-link.tsx"),
  "utf8",
);
assert(!syncRoute.includes("markPlaidItemSynced"), "sync route does not store the cursor");
assert(!exchangeRoute.includes("markPlaidItemSynced"), "exchange route does not store the cursor");
assert(!reconnectRoute.includes("markPlaidItemSynced"), "reconnect route does not store the cursor");
assert(
  bankLink.includes("commitPlaidCursorAfterSave") &&
    bankLink.includes("enqueuePlanSave") &&
    bankLink.includes("plaidSyncNeedsDurableSave") &&
    bankLink.includes("const plan = importFromPlaid(payload)") &&
    !bankLink.includes("flushPlanSave"),
  "the browser saves the imported plan itself before committing the cursor",
);

const storageHook = readFileSync(
  join(process.cwd(), "src/hooks/use-budget-plans-storage.ts"),
  "utf8",
);
const mutationsHook = readFileSync(
  join(process.cwd(), "src/hooks/use-budget-plan-mutations.ts"),
  "utf8",
);
assert(
  !storageHook.includes("if (next !== plan) queueSave(next)"),
  "opening a budget does not save scheduled transactions by itself",
);
assert(
  mutationsHook.includes("persist: false"),
  "scheduled transactions stay local until a user edit",
);
assert(
  storageHook.includes("conflictedRef") && storageHook.includes("inflightRef"),
  "a conflict stops later saves and flush waits for the in-flight write",
);

// The old race: import enqueues inside a React updater that has not run,
// or the debounce already took the plan. Flush then resolved with nothing
// saved and the cursor still advanced.
let raceCursor: string | null = null;
const racedQueue = new Map<string, BudgetPlan>();
const racedPlan = racedQueue.get("missing") ?? null;
let raceCommitted = false;
try {
  await commitPlaidCursorAfterSave({
    needsSave: plaidSyncNeedsDurableSave({
      accounts: [account],
      transactions: [
        {
          transactionId: "sandbox_tx_race",
          plaidAccountId: "sandbox_acc",
          date: "2026-09-01",
          name: "SANDBOX RACE",
          merchantName: null,
          amount: 1,
          pending: false,
        },
      ],
    }),
    plan: racedPlan,
    save: async () => {
      throw new Error("save should not run without a plan");
    },
    commit: async () => {
      raceCommitted = true;
      raceCursor = "cursor_should_not_advance";
    },
  });
  assert(false, "a missing queued plan must reject");
} catch (error) {
  assert(
    error instanceof Error && error.message === PLAID_CURSOR_NOT_SAVED,
    "the race tells the caller the bookmark was left unchanged",
  );
}
assert(!raceCommitted && raceCursor === null, "cursor does not advance when the plan is not queued");

let conflictCursor: string | null = null;
try {
  await commitPlaidCursorAfterSave({
    needsSave: true,
    plan: createEmptyBudgetPlan("Sandbox"),
    save: async () => {
      throw new BudgetPlanConflictError();
    },
    commit: async () => {
      conflictCursor = "cursor_should_not_advance";
    },
  });
  assert(false, "a version conflict must reject");
} catch (error) {
  assert(error instanceof BudgetPlanConflictError, "the conflict surfaces");
}
assert(conflictCursor === null, "a version conflict does not advance the cursor");

let inflightCursor: string | null = null;
const inflight = Promise.reject(new BudgetPlanConflictError());
void inflight.catch(() => undefined);
try {
  await flushQueuedPlanSave({
    planId: "already-taken",
    pending: new Map<string, BudgetPlan>(),
    inflight,
    save: async () => {
      throw new Error("the debounce already took this plan");
    },
  });
  inflightCursor = "cursor_should_not_advance";
} catch (error) {
  assert(error instanceof BudgetPlanConflictError, "flush rejects the in-flight conflict");
}
assert(
  inflightCursor === null,
  "cursor does not advance when the debounce already took the plan and that save conflicts",
);

let exactSaved: BudgetPlan | null = null;
let exactCursor: string | null = null;
const exactPlan = createEmptyBudgetPlan("Sandbox");
await commitPlaidCursorAfterSave({
  needsSave: true,
  plan: exactPlan,
  save: async (next) => {
    exactSaved = next;
  },
  commit: async () => {
    exactCursor = "cursor_saved";
  },
});
assert(exactSaved === exactPlan, "the save receives the exact imported plan");
assert(exactCursor === "cursor_saved", "a successful save of that plan advances the cursor");

let emptySaved = false;
let emptyCursor: string | null = null;
await commitPlaidCursorAfterSave({
  needsSave: plaidSyncNeedsDurableSave({
    accounts: [],
    transactions: [],
    modified: [],
    removedTransactionIds: [],
  }),
  plan: null,
  save: async () => {
    emptySaved = true;
  },
  commit: async () => {
    emptyCursor = "cursor_empty";
  },
});
assert(!emptySaved && emptyCursor === "cursor_empty", "an empty batch can move the cursor without a save");

const now = 1_700_000_000;
const webhookBody = JSON.stringify({
  item_id: "item_sandbox",
  webhook_type: "ITEM",
  webhook_code: "ERROR",
  error: { error_code: "ITEM_LOGIN_REQUIRED" },
});

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function signedWebhook(body: string, iat: number, alg = "ES256") {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const exported = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const header = Buffer.from(JSON.stringify({ alg, kid: "sandbox-key", typ: "JWT" })).toString(
    "base64url",
  );
  const digest = createHash("sha256").update(body).digest("hex");
  const payload = Buffer.from(
    JSON.stringify({ iat, request_body_sha256: digest }),
  ).toString("base64url");
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    ),
  );
  return {
    jwt: `${header}.${payload}.${b64url(signature)}`,
    jwk: {
      ...exported,
      alg: "ES256",
      kid: "sandbox-key",
      use: "sig",
    },
  };
}

const good = await signedWebhook(webhookBody, now);
const verified = await verifyPlaidWebhookSignature({
  rawBody: webhookBody,
  verificationJwt: good.jwt,
  nowSeconds: now + 10,
  fetchKey: async () => good.jwk,
});
assert(verified.ok, "a signed webhook verifies");

const tampered = await verifyPlaidWebhookSignature({
  rawBody: webhookBody.replace("ITEM_LOGIN_REQUIRED", "ITEM_LOGIN_OK"),
  verificationJwt: good.jwt,
  nowSeconds: now + 10,
  fetchKey: async () => good.jwk,
});
assert(!tampered.ok && tampered.reason === "body-hash", "a changed body is rejected");

const stale = await verifyPlaidWebhookSignature({
  rawBody: webhookBody,
  verificationJwt: good.jwt,
  nowSeconds: now + 5 * 60 + 5,
  fetchKey: async () => good.jwk,
});
assert(!stale.ok && stale.reason === "stale", "a webhook older than five minutes is rejected");

const wrongAlg = await signedWebhook(webhookBody, now, "none");
const algResult = await verifyPlaidWebhookSignature({
  rawBody: webhookBody,
  verificationJwt: wrongAlg.jwt,
  nowSeconds: now,
  fetchKey: async () => good.jwk,
});
assert(!algResult.ok && algResult.reason === "alg", "only ES256 is accepted");

const missing = await verifyPlaidWebhookSignature({
  rawBody: webhookBody,
  verificationJwt: null,
  nowSeconds: now,
  fetchKey: async () => good.jwk,
});
assert(!missing.ok, "a missing Plaid-Verification header is rejected");

const unsigned = await plaidWebhook(
  new Request("https://investsalsa.com/api/plaid/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: webhookBody,
  }),
);
assert(unsigned.status === 401, "unsigned webhook route returns 401");
const unsignedBody = (await unsigned.json()) as { error?: string; status?: string };
assert(unsignedBody.status == null, "unsigned webhook does not report an item status");

const webhookRoute = readFileSync(
  join(process.cwd(), "src/app/api/plaid/webhook/route.ts"),
  "utf8",
);
const webhookHandler = webhookRoute.slice(webhookRoute.indexOf("export async function POST"));
assert(
  webhookHandler.includes("verifyPlaidWebhookRequest") &&
    webhookHandler.indexOf("verifyPlaidWebhookRequest") <
      webhookHandler.indexOf("markPlaidItemStatus"),
  "webhook signature is checked before item status changes",
);

console.log("plaid sync unit tests passed");
