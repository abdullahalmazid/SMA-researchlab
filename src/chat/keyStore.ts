import {
  generateChatKeyBundle,
  importPrivateKey,
  sameKey,
  unwrapKeyBundleWithPassphrase,
  wrapKeyBundleWithPassphrase,
} from "./crypto";
import { getKeyBackup, getUserChatPublicKey, saveKeyBackup, upsertUserChatPublicKey } from "./service";
import type { ChatKeyBundle, PassphraseWrappedKey } from "./types";

const CHAT_KEY_STORAGE_PREFIX = "rl_chat_keybundle_v2_";
const LEGACY_CHAT_KEY_STORAGE_PREFIX = "rl_chat_keybundle_v1_";

export interface ReadyKeys {
  bundle: ChatKeyBundle;
  privateKey: CryptoKey;
}

/**
 * Where this browser stands with the member's chat key.
 *
 * The old code generated a fresh key whenever this browser had none, and
 * overwrote the published public key with it. A second device — or a cleared
 * browser — therefore silently re-keyed the account, and every message sent to
 * the previous key became "[Unable to decrypt]" everywhere else. Now the key is
 * backed up under a passphrase and restored on new devices instead.
 */
export type ChatKeyStatus =
  | { state: "loading" }
  | { state: "ready"; keys: ReadyKeys; hasBackup: boolean }
  /** This browser has the key but there's no backup yet. */
  | { state: "create-backup"; bundle: ChatKeyBundle }
  /** A backup exists; this browser needs the passphrase to restore it. */
  | { state: "unlock"; backup: PassphraseWrappedKey }
  /** No usable key anywhere. `replacesKey`: an older key exists elsewhere. */
  | { state: "setup"; replacesKey: boolean }
  | { state: "error"; message: string };

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
    const raw = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isKeyBundle(parsed)) return null;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, JSON.stringify(parsed));
      localStorage.removeItem(legacyStorageKey);
    }
    return parsed;
  } catch {
    return null;
  }
};

const storeLocal = (uid: string, bundle: ChatKeyBundle) => {
  try {
    localStorage.setItem(`${CHAT_KEY_STORAGE_PREFIX}${uid}`, JSON.stringify(bundle));
  } catch {
    /* Private mode: the key lives for this session only; the backup still works. */
  }
};

const toReady = async (bundle: ChatKeyBundle): Promise<ReadyKeys> => ({
  bundle,
  privateKey: await importPrivateKey(bundle.privateKeyJwk),
});

/** Publish only when it differs — never as a side effect of opening chat. */
const publishIfChanged = async (uid: string, publicKeyJwk: JsonWebKey, published: JsonWebKey | null) => {
  if (!sameKey(published, publicKeyJwk)) await upsertUserChatPublicKey(uid, publicKeyJwk);
};

export const resolveChatKeyStatus = async (uid: string): Promise<ChatKeyStatus> => {
  try {
    const [local, backup, published] = await Promise.all([
      Promise.resolve(getLocalChatKeyBundle(uid)),
      getKeyBackup(uid),
      getUserChatPublicKey(uid),
    ]);

    if (backup) {
      if (local && sameKey(local.publicKeyJwk, backup.publicKeyJwk)) {
        await publishIfChanged(uid, local.publicKeyJwk, published);
        return { state: "ready", keys: await toReady(local), hasBackup: true };
      }
      return { state: "unlock", backup };
    }

    if (local && (!published || sameKey(local.publicKeyJwk, published))) {
      // Existing member from before backups: keep their key, ask for a passphrase.
      await publishIfChanged(uid, local.publicKeyJwk, published);
      return { state: "create-backup", bundle: local };
    }

    return { state: "setup", replacesKey: Boolean(published) };
  } catch (error) {
    return { state: "error", message: error instanceof Error ? error.message : "Could not load your chat key." };
  }
};

/** First-time setup, or backing up a key this browser already has. */
export const createKeyBackup = async (
  uid: string,
  passphrase: string,
  existing?: ChatKeyBundle,
): Promise<ReadyKeys> => {
  const bundle = existing ?? (await generateChatKeyBundle());
  await saveKeyBackup(uid, await wrapKeyBundleWithPassphrase(bundle, passphrase));
  storeLocal(uid, bundle);
  await upsertUserChatPublicKey(uid, bundle.publicKeyJwk);
  return toReady(bundle);
};

/** Restores the key on this device. Throws "wrong-passphrase" on failure. */
export const unlockKeyBackup = async (
  uid: string,
  backup: PassphraseWrappedKey,
  passphrase: string,
): Promise<ReadyKeys> => {
  let bundle: ChatKeyBundle;
  try {
    bundle = await unwrapKeyBundleWithPassphrase(backup, passphrase);
  } catch {
    throw new Error("wrong-passphrase");
  }
  storeLocal(uid, bundle);
  await publishIfChanged(uid, bundle.publicKeyJwk, await getUserChatPublicKey(uid));
  return toReady(bundle);
};

/** Session-only use of a key that has no backup yet ("Not now"). */
export const keysWithoutBackup = (bundle: ChatKeyBundle) => toReady(bundle);
