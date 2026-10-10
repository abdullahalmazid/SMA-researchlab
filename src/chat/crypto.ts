import type { ChatKeyBundle, EncryptedMessagePayload, PassphraseWrappedKey } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const RSA = { name: "RSA-OAEP", hash: "SHA-256" } as const;
/** OWASP's 2023 floor for PBKDF2-HMAC-SHA256. */
const PBKDF2_ITERATIONS = 310_000;

export const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

export const fromBase64 = (b64: string) => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** Two JWKs describe the same RSA key when modulus and exponent match. */
export const sameKey = (a?: JsonWebKey | null, b?: JsonWebKey | null) =>
  Boolean(a?.n && b?.n && a.n === b.n && a.e === b.e);

export const generateChatKeyBundle = async (): Promise<ChatKeyBundle> => {
  const keyPair = await crypto.subtle.generateKey(
    { ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ["encrypt", "decrypt"],
  );
  return {
    algorithm: "RSA-OAEP",
    publicKeyJwk: await crypto.subtle.exportKey("jwk", keyPair.publicKey),
    privateKeyJwk: await crypto.subtle.exportKey("jwk", keyPair.privateKey),
    createdAt: new Date().toISOString(),
  };
};

/* Importing an RSA key is slow enough to notice when it happens once per
   message. Public keys are cached by modulus; the private key is imported once
   by the caller and passed around as a CryptoKey. */
const publicKeyCache = new Map<string, Promise<CryptoKey>>();

const importPublicKey = (jwk: JsonWebKey) => {
  const cacheKey = `${jwk.n}|${jwk.e}`;
  let key = publicKeyCache.get(cacheKey);
  if (!key) {
    key = crypto.subtle.importKey("jwk", jwk, RSA, false, ["encrypt"]);
    publicKeyCache.set(cacheKey, key);
  }
  return key;
};

export const importPrivateKey = (jwk: JsonWebKey) =>
  crypto.subtle.importKey("jwk", jwk, RSA, false, ["decrypt"]);

/**
 * Encrypts once with a fresh AES key, then wraps that key for every recipient.
 * Each recipient's payload carries the same ciphertext, so a group message
 * costs one AES pass plus one RSA wrap per member.
 */
export const encryptForRecipients = async (
  plainText: string,
  publicKeysByUid: Record<string, JsonWebKey>,
): Promise<Record<string, EncryptedMessagePayload>> => {
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, textEncoder.encode(plainText));
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);

  const ciphertextB64 = toBase64(new Uint8Array(ciphertext));
  const ivB64 = toBase64(iv);

  const entries = await Promise.all(
    Object.entries(publicKeysByUid).map(async ([uid, jwk]) => {
      const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, await importPublicKey(jwk), rawAesKey);
      const payload: EncryptedMessagePayload = {
        ciphertextB64,
        ivB64,
        wrappedKeyB64: toBase64(new Uint8Array(wrapped)),
        version: 1,
      };
      return [uid, payload] as const;
    }),
  );
  return Object.fromEntries(entries);
};

export const decryptWithPrivateKey = async (
  payload: EncryptedMessagePayload,
  privateKey: CryptoKey,
): Promise<string> => {
  const rawAesKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, fromBase64(payload.wrappedKeyB64));
  const aesKey = await crypto.subtle.importKey("raw", rawAesKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.ivB64) },
    aesKey,
    fromBase64(payload.ciphertextB64),
  );
  return textDecoder.decode(plain);
};

/* ── Passphrase backup of the private key ─────────────────────────────── */

const deriveWrappingKey = async (passphrase: string, salt: BufferSource, iterations: number) => {
  const base = await crypto.subtle.importKey("raw", textEncoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export const wrapKeyBundleWithPassphrase = async (
  bundle: ChatKeyBundle,
  passphrase: string,
): Promise<PassphraseWrappedKey> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveWrappingKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(JSON.stringify(bundle.privateKeyJwk)),
  );
  return {
    ciphertextB64: toBase64(new Uint8Array(ciphertext)),
    ivB64: toBase64(iv),
    saltB64: toBase64(salt),
    iterations: PBKDF2_ITERATIONS,
    version: 1,
    publicKeyJwk: bundle.publicKeyJwk,
    createdAt: new Date().toISOString(),
  };
};

/** Throws when the passphrase is wrong — AES-GCM authentication fails. */
export const unwrapKeyBundleWithPassphrase = async (
  wrapped: PassphraseWrappedKey,
  passphrase: string,
): Promise<ChatKeyBundle> => {
  const key = await deriveWrappingKey(passphrase, fromBase64(wrapped.saltB64), wrapped.iterations);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(wrapped.ivB64) },
    key,
    fromBase64(wrapped.ciphertextB64),
  );
  return {
    algorithm: "RSA-OAEP",
    publicKeyJwk: wrapped.publicKeyJwk,
    privateKeyJwk: JSON.parse(textDecoder.decode(plain)) as JsonWebKey,
    createdAt: wrapped.createdAt,
  };
};

/* ── Files ─────────────────────────────────────────────────────────────── */

/** Encrypts file bytes with their own AES key, carried inside the message. */
export const encryptBytes = async (data: ArrayBuffer) => {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const raw = await crypto.subtle.exportKey("raw", key);
  return { cipher, keyB64: toBase64(new Uint8Array(raw)), ivB64: toBase64(iv) };
};

export const decryptBytes = async (cipher: ArrayBuffer, keyB64: string, ivB64: string) => {
  const key = await crypto.subtle.importKey("raw", fromBase64(keyB64), { name: "AES-GCM" }, false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(ivB64) }, key, cipher);
};
