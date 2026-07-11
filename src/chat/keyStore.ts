import { generateChatKeyBundle } from "./crypto";
import { upsertUserChatPublicKey } from "./service";
import type { ChatKeyBundle } from "./types";

const CHAT_KEY_STORAGE_PREFIX = "rl_chat_keybundle_v2_";
const LEGACY_CHAT_KEY_STORAGE_PREFIX = "rl_chat_keybundle_v1_";

const isKeyBundle = (value: unknown): value is ChatKeyBundle => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChatKeyBundle>;
  return Boolean(
    candidate.algorithm === "RSA-OAEP" &&
      candidate.publicKeyJwk &&
      candidate.privateKeyJwk &&
      typeof candidate.createdAt === "string",
  );
};

export const getLocalChatKeyBundle = (uid: string): ChatKeyBundle | null => {
  try {
    const storageKey = `${CHAT_KEY_STORAGE_PREFIX}${uid}`;
    const legacyStorageKey = `${LEGACY_CHAT_KEY_STORAGE_PREFIX}${uid}`;
    const raw =
      localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isKeyBundle(parsed)) return null;

    // Preserve existing browser-local keys while moving away from the legacy
    // key name. The private key is never sent to Firestore.
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, JSON.stringify(parsed));
      localStorage.removeItem(legacyStorageKey);
    }
    return parsed;
  } catch {
    return null;
  }
};

export const ensureLocalChatKeyBundle = async (uid: string) => {
  const existing = getLocalChatKeyBundle(uid);
  if (existing) {
    await upsertUserChatPublicKey(uid, existing.publicKeyJwk);
    return existing;
  }

  const generated = await generateChatKeyBundle();
  localStorage.setItem(
    `${CHAT_KEY_STORAGE_PREFIX}${uid}`,
    JSON.stringify(generated),
  );
  await upsertUserChatPublicKey(uid, generated.publicKeyJwk);
  return generated;
};
