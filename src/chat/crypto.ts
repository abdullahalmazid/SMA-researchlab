import type { ChatKeyBundle, EncryptedMessagePayload } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const fromBase64 = (b64: string) => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const generateChatKeyBundle = async (): Promise<ChatKeyBundle> => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey,
  );

  return {
    algorithm: "RSA-OAEP",
    publicKeyJwk,
    privateKeyJwk,
    createdAt: new Date().toISOString(),
  };
};

const importPublicKey = (jwk: JsonWebKey) =>
  crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"],
  );

const importPrivateKey = (jwk: JsonWebKey) =>
  crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"],
  );

export const encryptForRecipient = async (
  plainText: string,
  recipientPublicKeyJwk: JsonWebKey,
): Promise<EncryptedMessagePayload> => {
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textEncoder.encode(plainText),
  );

  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  const recipientKey = await importPublicKey(recipientPublicKeyJwk);
  const wrappedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientKey,
    rawAesKey,
  );

  return {
    ciphertextB64: toBase64(new Uint8Array(ciphertext)),
    ivB64: toBase64(iv),
    wrappedKeyB64: toBase64(new Uint8Array(wrappedKey)),
    version: 1,
  };
};

export const decryptWithPrivateKey = async (
  payload: EncryptedMessagePayload,
  privateKeyJwk: JsonWebKey,
): Promise<string> => {
  const privateKey = await importPrivateKey(privateKeyJwk);
  const rawAesKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    fromBase64(payload.wrappedKeyB64),
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    rawAesKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.ivB64) },
    aesKey,
    fromBase64(payload.ciphertextB64),
  );

  return textDecoder.decode(plainBuffer);
};
