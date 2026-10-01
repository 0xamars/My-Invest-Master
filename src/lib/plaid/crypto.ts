import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";

export class PlaidTokenLockedError extends Error {
  constructor() {
    super("Bank connection could not be unlocked.");
    this.name = "PlaidTokenLockedError";
  }
}

/**
 * 32-byte AES-256 key.
 * Accepts 64 hex chars, a 32-byte base64 secret (`openssl rand -base64 32`),
 * or any other passphrase (SHA-256). Empty input is not a key.
 */
export function plaidTokenKeyFromSecret(secret: string): Buffer | null {
  const trimmed = secret.trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  if (
    /^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmed) &&
    trimmed.length >= 43 &&
    trimmed.length <= 44
  ) {
    const decoded = Buffer.from(
      trimmed.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    if (decoded.length === 32) return decoded;
  }
  return createHash("sha256").update(trimmed, "utf8").digest();
}

export function readPlaidTokenKey(
  env: Record<string, string | undefined> = process.env,
): Buffer | null {
  return plaidTokenKeyFromSecret(env.PLAID_TOKEN_ENCRYPTION_KEY ?? "");
}

export function isPlaidEncryptionReady(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readPlaidTokenKey(env) != null;
}

/** AES-256-GCM. Output is `v1:<iv>:<tag>:<ciphertext>`, each part base64url. */
export function encryptPlaidAccessToken(plaintext: string, key: Buffer): string {
  if (!plaintext) {
    throw new Error("Bank linking is not set up on this server.");
  }
  if (key.length !== 32) {
    throw new Error("Bank linking is not set up on this server.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptPlaidAccessToken(stored: string, key: Buffer): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new PlaidTokenLockedError();
  }
  if (key.length !== 32) throw new PlaidTokenLockedError();
  const iv = Buffer.from(parts[1] ?? "", "base64url");
  const tag = Buffer.from(parts[2] ?? "", "base64url");
  const ciphertext = Buffer.from(parts[3] ?? "", "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new PlaidTokenLockedError();
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const token = plain.toString("utf8");
    if (!token) throw new PlaidTokenLockedError();
    return token;
  } catch (error) {
    if (error instanceof PlaidTokenLockedError) throw error;
    throw new PlaidTokenLockedError();
  }
}

/**
 * Rows written before encryption have a raw token. Those still open.
 * Ciphertext requires the app key. A bad tag or a missing key throws.
 */
export function openStoredPlaidAccessToken(
  stored: string,
  key: Buffer | null,
): string {
  const value = stored.trim();
  if (!value.startsWith(`${VERSION}:`)) return value;
  if (!key) throw new PlaidTokenLockedError();
  return decryptPlaidAccessToken(value, key);
}

export function sealPlaidAccessToken(
  plaintext: string,
  key: Buffer | null,
): string {
  if (!key) {
    throw new Error("Bank linking is not set up on this server.");
  }
  return encryptPlaidAccessToken(plaintext, key);
}
