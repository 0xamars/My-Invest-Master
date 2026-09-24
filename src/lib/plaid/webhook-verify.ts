import { createHash, timingSafeEqual } from "node:crypto";
import { plaidPost } from "@/lib/plaid/client";

/** Plaid rejects webhooks older than five minutes. */
export const PLAID_WEBHOOK_MAX_AGE_SECONDS = 5 * 60;

export type PlaidVerificationJwk = {
  alg?: string;
  crv?: string;
  kid?: string;
  kty?: string;
  use?: string;
  x?: string;
  y?: string;
  expired_at?: number | null;
};

export type PlaidWebhookVerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

const keyCache = new Map<string, PlaidVerificationJwk>();

export function clearPlaidWebhookKeyCacheForTests(): void {
  keyCache.clear();
}

function decodeBase64Url(segment: string): Uint8Array {
  const padded =
    segment.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (segment.length % 4)) % 4);
  return new Uint8Array(Buffer.from(padded, "base64"));
}

function decodeJsonSegment(segment: string): unknown {
  const json = new TextDecoder().decode(decodeBase64Url(segment));
  return JSON.parse(json) as unknown;
}

function timingSafeEqualHex(actual: string, expected: string): boolean {
  const left = Buffer.from(actual.toLowerCase());
  const right = Buffer.from(expected.toLowerCase());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function importEs256Key(key: PlaidVerificationJwk): Promise<CryptoKey | null> {
  if (
    key.kty !== "EC" ||
    key.crv !== "P-256" ||
    key.alg !== "ES256" ||
    !key.x ||
    !key.y
  ) {
    return null;
  }
  try {
    return await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        x: key.x,
        y: key.y,
        alg: "ES256",
        ext: true,
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }
}

/**
 * Plaid's documented check: ES256 JWT in `Plaid-Verification`, key from
 * `/webhook_verification_key/get`, `iat` within five minutes, then a
 * constant-time compare of SHA-256(raw body) to `request_body_sha256`.
 * The body must be the exact bytes Plaid sent, not a re-serialized JSON value.
 */
export async function verifyPlaidWebhookSignature(input: {
  rawBody: string;
  verificationJwt: string | null | undefined;
  nowSeconds?: number;
  fetchKey: (kid: string) => Promise<PlaidVerificationJwk | null>;
}): Promise<PlaidWebhookVerifyResult> {
  const token = input.verificationJwt?.trim() ?? "";
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return { ok: false, reason: "malformed" };
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts as [
    string,
    string,
    string,
  ];

  let header: Record<string, unknown>;
  try {
    const decoded = decodeJsonSegment(headerSegment);
    if (!decoded || typeof decoded !== "object") {
      return { ok: false, reason: "malformed" };
    }
    header = decoded as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (header.alg !== "ES256") return { ok: false, reason: "alg" };
  const kid = typeof header.kid === "string" ? header.kid.trim() : "";
  if (!kid) return { ok: false, reason: "kid" };

  const jwk = await input.fetchKey(kid);
  if (!jwk || jwk.kid !== kid) return { ok: false, reason: "key" };
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof jwk.expired_at === "number" && jwk.expired_at <= nowSeconds) {
    return { ok: false, reason: "expired-key" };
  }

  const cryptoKey = await importEs256Key(jwk);
  if (!cryptoKey) return { ok: false, reason: "key" };

  let signatureOk = false;
  try {
    signatureOk = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      cryptoKey,
      decodeBase64Url(signatureSegment) as BufferSource,
      new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { ok: false, reason: "signature" };

  let payload: Record<string, unknown>;
  try {
    const decoded = decodeJsonSegment(payloadSegment);
    if (!decoded || typeof decoded !== "object") {
      return { ok: false, reason: "payload" };
    }
    payload = decoded as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "payload" };
  }

  const iat = payload.iat;
  if (typeof iat !== "number" || !Number.isFinite(iat)) {
    return { ok: false, reason: "iat" };
  }
  if (iat < nowSeconds - PLAID_WEBHOOK_MAX_AGE_SECONDS) {
    return { ok: false, reason: "stale" };
  }

  const claimed = payload.request_body_sha256;
  if (typeof claimed !== "string" || !claimed) {
    return { ok: false, reason: "body-hash" };
  }
  const actual = createHash("sha256").update(input.rawBody).digest("hex");
  if (!timingSafeEqualHex(actual, claimed)) {
    return { ok: false, reason: "body-hash" };
  }
  return { ok: true };
}

export async function fetchPlaidWebhookVerificationKey(
  kid: string,
  options?: { refresh?: boolean },
): Promise<PlaidVerificationJwk | null> {
  if (!options?.refresh) {
    const cached = keyCache.get(kid);
    if (cached) return cached;
  }
  try {
    const data = await plaidPost<{ key?: PlaidVerificationJwk }>(
      "/webhook_verification_key/get",
      { key_id: kid },
    );
    const key = data.key;
    if (!key || key.kid !== kid || key.alg !== "ES256" || key.kty !== "EC") {
      return null;
    }
    keyCache.set(kid, key);
    return key;
  } catch {
    return null;
  }
}

/** Verify, and refetch the JWK once if the signature fails (key rotation). */
export async function verifyPlaidWebhookRequest(input: {
  rawBody: string;
  verificationJwt: string | null | undefined;
  nowSeconds?: number;
}): Promise<PlaidWebhookVerifyResult> {
  const first = await verifyPlaidWebhookSignature({
    ...input,
    fetchKey: (kid) => fetchPlaidWebhookVerificationKey(kid),
  });
  if (first.ok || first.reason !== "signature") return first;
  return verifyPlaidWebhookSignature({
    ...input,
    fetchKey: (kid) => fetchPlaidWebhookVerificationKey(kid, { refresh: true }),
  });
}
