/**
 * Access-token encryption. No live Plaid calls.
 *   npx tsx --tsconfig tsconfig.json scripts/test-plaid-crypto-unit.mts
 */
import { createHash } from "node:crypto";
import {
  decryptPlaidAccessToken,
  encryptPlaidAccessToken,
  openStoredPlaidAccessToken,
  plaidTokenKeyFromSecret,
  PlaidTokenLockedError,
  readPlaidTokenKey,
  sealPlaidAccessToken,
} from "../src/lib/plaid/crypto.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const token = "access-sandbox-very-secret-token-99";
const hexKey = createHash("sha256").update("hex-source").digest("hex");
const key = plaidTokenKeyFromSecret(hexKey);
assert(key?.length === 32, "a 64-char hex secret is a 32-byte key");
assert(key != null, "hex key exists");

const sealed = encryptPlaidAccessToken(token, key!);
assert(sealed.startsWith("v1:"), "ciphertext is versioned");
assert(!sealed.includes(token), "ciphertext does not contain the access token");
assert(decryptPlaidAccessToken(sealed, key!) === token, "round trip restores the token");
assert(
  encryptPlaidAccessToken(token, key!) !== sealed,
  "each seal uses a fresh IV",
);

const base64Key = plaidTokenKeyFromSecret(key!.toString("base64"));
assert(base64Key?.equals(key!), "base64 form of 32 bytes is the same key");
const phraseKey = plaidTokenKeyFromSecret("a long passphrase for the app");
assert(phraseKey?.length === 32, "a passphrase becomes a 32-byte key");
assert(
  decryptPlaidAccessToken(encryptPlaidAccessToken(token, phraseKey!), phraseKey!) ===
    token,
  "a passphrase key round-trips",
);

const parts = sealed.split(":");
parts[3] = `${parts[3]}x`;
let tampered = false;
try {
  decryptPlaidAccessToken(parts.join(":"), key!);
} catch (error) {
  tampered = error instanceof PlaidTokenLockedError;
}
assert(tampered, "a changed ciphertext is rejected");

let wrongKey = false;
try {
  decryptPlaidAccessToken(sealed, phraseKey!);
} catch (error) {
  wrongKey = error instanceof PlaidTokenLockedError;
}
assert(wrongKey, "the wrong key is rejected");

assert(
  openStoredPlaidAccessToken("access-legacy-plain", null) === "access-legacy-plain",
  "a token stored before encryption still opens",
);
let locked = false;
try {
  openStoredPlaidAccessToken(sealed, null);
} catch (error) {
  locked = error instanceof PlaidTokenLockedError;
}
assert(locked, "ciphertext without the app key does not open");

const previous = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
process.env.PLAID_TOKEN_ENCRYPTION_KEY = hexKey;
try {
  const fromEnv = readPlaidTokenKey();
  assert(fromEnv?.equals(key!), "the env key is the hex key");
  assert(
    openStoredPlaidAccessToken(sealPlaidAccessToken(token, fromEnv), fromEnv) === token,
    "seal and open use the env key",
  );
} finally {
  if (previous === undefined) delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  else process.env.PLAID_TOKEN_ENCRYPTION_KEY = previous;
}

assert(readPlaidTokenKey({ PLAID_TOKEN_ENCRYPTION_KEY: "" }) == null, "an empty key is not ready");

console.log("plaid crypto unit tests passed");
