import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import type {
  ChatConversation,
  ChatMessage,
  EncryptedMessagePayload,
  PassphraseWrappedKey,
} from "./types";

/** Messages disappear this long after they're sent (Firestore TTL on expiresAt). */
export const CHAT_TTL_HOURS = 72;
/** Newest messages loaded per conversation. 72 hours rarely gets near it. */
const MESSAGE_WINDOW = 300;
export const MAX_GROUP_MEMBERS = 50;

export const directConversationId = (uidA: string, uidB: string) => [uidA, uidB].sort().join("__");

const iso = (value: unknown): string | undefined => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && value) return value;
  return undefined;
};

const stringMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const text = iso(entry);
    if (text) out[key] = text;
  });
  return out;
};

const stringList = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);

export const normalizeConversation = (id: string, row: Record<string, unknown>): ChatConversation => {
  const participants = stringList(row.participants);
  const typingRaw = (row.typingBy ?? {}) as Record<string, unknown>;
  return {
    id,
    type: row.type === "group" ? "group" : "direct",
    participants,
    participantNames: (row.participantNames ?? {}) as Record<string, string>,
    title: typeof row.title === "string" ? row.title : undefined,
    admins: stringList(row.admins),
    createdBy: typeof row.createdBy === "string" ? row.createdBy : undefined,
    lastMessageAt: iso(row.lastMessageAt),
    lastSenderId: typeof row.lastSenderId === "string" ? row.lastSenderId : undefined,
    previewByUser: (row.previewByUser ?? {}) as Record<string, EncryptedMessagePayload>,
    readAt: stringMap(row.readAt),
    typingBy: Object.fromEntries(Object.entries(typingRaw).map(([uid, value]) => [uid, iso(value) ?? null])),
    mutedBy: Object.fromEntries(
      Object.entries((row.mutedBy ?? {}) as Record<string, unknown>).map(([uid, value]) => [uid, value === true]),
    ),
    hiddenFor: stringList(row.hiddenFor),
    clearedAtBy: stringMap(row.clearedAtBy),
    clearedForAllAt: iso(row.clearedForAllAt),
    pinnedMessageId: typeof row.pinnedMessageId === "string" ? row.pinnedMessageId : undefined,
    legacyUnreadCounts: Object.fromEntries(
      Object.entries((row.unreadCounts ?? {}) as Record<string, unknown>).map(([uid, value]) => [uid, Number(value) || 0]),
    ),
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(row.updatedAt) ?? iso(row.lastMessageAt) ?? new Date(0).toISOString(),
  };
};

/**
 * Reactions used to be stored emoji → [uids], which made one person's tap a
 * read-modify-write of everyone's reactions. They're now uid → emoji. Old
 * entries are still read, and a person's own new entry overrides them.
 */
const normalizeReactions = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") return {};
  const legacy: Record<string, string> = {};
  const current: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (Array.isArray(entry)) entry.forEach((uid) => (legacy[String(uid)] = key));
    else if (typeof entry === "string" && entry) current[key] = entry;
  });
  return { ...legacy, ...current };
};

/** All conversations the user is in — including ones they've hidden. */
export const subscribeConversations = (
  uid: string,
  onChange: (items: ChatConversation[]) => void,
  onError?: (error: Error) => void,
) =>
  onSnapshot(
    query(collection(db, "privateChats"), where("participants", "array-contains", uid)),
    (snap) => {
      const items = snap.docs
        .map((d) => normalizeConversation(d.id, d.data({ serverTimestamps: "estimate" })))
        .sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt));
      onChange(items);
    },
    (error) => {
      onError?.(error);
      onChange([]);
    },
  );

export const subscribeMessages = (
  conversationId: string,
  onChange: (items: ChatMessage[]) => void,
  onError?: (error: Error) => void,
) =>
  onSnapshot(
    query(
      collection(db, "privateChats", conversationId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(MESSAGE_WINDOW),
    ),
    { includeMetadataChanges: true },
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          // "estimate" so a message we just sent sorts and shows a time
          // before the server has stamped it.
          const row = d.data({ serverTimestamps: "estimate" });
          return {
            id: d.id,
            conversationId,
            senderId: String(row.senderId),
            recipientId: typeof row.recipientId === "string" ? row.recipientId : undefined,
            encryptedByUser: (row.encryptedByUser ?? {}) as Record<string, EncryptedMessagePayload>,
            createdAt: iso(row.createdAt) ?? new Date().toISOString(),
            expiresAt: iso(row.expiresAt) ?? "",
            readAt: iso(row.readAt),
            editedAt: iso(row.editedAt),
            deletedForEveryoneAt: iso(row.deletedForEveryoneAt),
            replyToMessageId: typeof row.replyToMessageId === "string" ? row.replyToMessageId : undefined,
            reactions: normalizeReactions(row.reactions),
            hiddenFor: stringList(row.hiddenFor),
            pending: d.metadata.hasPendingWrites,
          } satisfies ChatMessage;
        }),
      );
    },
    (error) => {
      if (onError) onError(error);
      else onChange([]);
    },
  );

/* ── Sending ───────────────────────────────────────────────────────────── */

export interface SendMessageInput {
  conversationId: string;
  /** Present when the conversation document doesn't exist yet. */
  create?: {
    type: "direct";
    participants: string[];
    participantNames: Record<string, string>;
  };
  participants: string[];
  senderId: string;
  recipientId?: string;
  encryptedByUser: Record<string, EncryptedMessagePayload>;
  previewByUser: Record<string, EncryptedMessagePayload>;
  replyToMessageId?: string;
}

/**
 * One batch: the conversation update and the message land together or not at
 * all. Before, these were three sequential writes, and a failure in the middle
 * left a message with no unread marker (or an unread marker with no message).
 */
export const sendMessage = async (input: SendMessageInput) => {
  const conversationRef = doc(db, "privateChats", input.conversationId);
  const messageRef = doc(collection(conversationRef, "messages"));
  const batch = writeBatch(db);

  batch.set(
    conversationRef,
    {
      ...(input.create
        ? {
            type: "direct",
            participants: [...input.create.participants].sort(),
            participantNames: input.create.participantNames,
            createdAt: serverTimestamp(),
          }
        : { hiddenFor: arrayRemove(...input.participants) }),
      lastMessageAt: serverTimestamp(),
      lastSenderId: input.senderId,
      previewByUser: input.previewByUser,
      updatedAt: serverTimestamp(),
      readAt: { [input.senderId]: serverTimestamp() },
      typingBy: { [input.senderId]: null },
    },
    { merge: true },
  );

  batch.set(messageRef, {
    conversationId: input.conversationId,
    senderId: input.senderId,
    ...(input.recipientId ? { recipientId: input.recipientId } : {}),
    encryptedByUser: input.encryptedByUser,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + CHAT_TTL_HOURS * 3_600_000),
    ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}),
  });

  await batch.commit();
  return messageRef.id;
};

export const editMessage = (
  conversationId: string,
  messageId: string,
  encryptedByUser: Record<string, EncryptedMessagePayload>,
) =>
  updateDoc(doc(db, "privateChats", conversationId, "messages", messageId), {
    encryptedByUser,
    editedAt: serverTimestamp(),
  });

/** Sender only (enforced by the rules): wipes the ciphertext for everyone. */
export const deleteMessageForEveryone = (conversationId: string, messageId: string) =>
  updateDoc(doc(db, "privateChats", conversationId, "messages", messageId), {
    deletedForEveryoneAt: serverTimestamp(),
    encryptedByUser: {},
    reactions: {},
  });

export const hideMessageForMe = (conversationId: string, messageId: string, uid: string) =>
  updateDoc(doc(db, "privateChats", conversationId, "messages", messageId), { hiddenFor: arrayUnion(uid) });

/** Sets (or clears, with null) this person's single reaction. */
export const setReaction = (conversationId: string, messageId: string, uid: string, emoji: string | null) =>
  updateDoc(doc(db, "privateChats", conversationId, "messages", messageId), {
    [`reactions.${uid}`]: emoji ?? deleteField(),
  });

/* ── Per-member conversation state ─────────────────────────────────────── */

export const markConversationRead = (conversationId: string, uid: string, hasLegacyCounter: boolean) =>
  updateDoc(doc(db, "privateChats", conversationId), {
    [`readAt.${uid}`]: serverTimestamp(),
    ...(hasLegacyCounter ? { [`unreadCounts.${uid}`]: 0 } : {}),
  });

export const setTypingStatus = (conversationId: string, uid: string, isTyping: boolean) =>
  updateDoc(doc(db, "privateChats", conversationId), {
    [`typingBy.${uid}`]: isTyping ? new Date().toISOString() : null,
  });

export const setConversationMuted = (conversationId: string, uid: string, muted: boolean) =>
  updateDoc(doc(db, "privateChats", conversationId), {
    [`mutedBy.${uid}`]: muted ? true : deleteField(),
  });

export const clearConversationForMe = (conversationId: string, uid: string) =>
  updateDoc(doc(db, "privateChats", conversationId), {
    [`clearedAtBy.${uid}`]: new Date().toISOString(),
    [`readAt.${uid}`]: serverTimestamp(),
  });

export const hideConversationForMe = (conversationId: string, uid: string) =>
  updateDoc(doc(db, "privateChats", conversationId), {
    hiddenFor: arrayUnion(uid),
    [`readAt.${uid}`]: serverTimestamp(),
  });

/**
 * "Delete for everyone" on a whole chat. Nobody may destroy another member's
 * messages, so this wipes the requester's own messages and sets a shared
 * cutoff that hides everything older for all members. The rest expires with
 * the normal 72-hour TTL.
 */
export const clearConversationForEveryone = async (
  conversationId: string,
  ownMessageIds: string[],
) => {
  for (let offset = 0; offset < Math.max(ownMessageIds.length, 1); offset += 400) {
    const batch = writeBatch(db);
    ownMessageIds.slice(offset, offset + 400).forEach((messageId) => {
      batch.update(doc(db, "privateChats", conversationId, "messages", messageId), {
        encryptedByUser: {},
        reactions: {},
        deletedForEveryoneAt: serverTimestamp(),
      });
    });
    if (offset === 0) {
      batch.update(doc(db, "privateChats", conversationId), {
        clearedForAllAt: serverTimestamp(),
        pinnedMessageId: deleteField(),
        previewByUser: {},
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
};

export const setPinnedMessage = (conversationId: string, messageId: string | null) =>
  updateDoc(doc(db, "privateChats", conversationId), {
    pinnedMessageId: messageId ?? deleteField(),
  });

/* ── Groups ────────────────────────────────────────────────────────────── */

export const createGroupConversation = async (input: {
  creatorId: string;
  title: string;
  memberIds: string[];
  participantNames: Record<string, string>;
}) => {
  const ref = doc(collection(db, "privateChats"));
  const participants = Array.from(new Set([input.creatorId, ...input.memberIds]));
  await setDoc(ref, {
    type: "group",
    title: input.title.trim().slice(0, 80),
    participants,
    participantNames: input.participantNames,
    admins: [input.creatorId],
    createdBy: input.creatorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    readAt: { [input.creatorId]: serverTimestamp() },
  });
  return ref.id;
};

export const renameGroup = (conversationId: string, title: string) =>
  updateDoc(doc(db, "privateChats", conversationId), { title: title.trim().slice(0, 80) });

export const addGroupMembers = (conversationId: string, members: Record<string, string>) =>
  updateDoc(doc(db, "privateChats", conversationId), {
    participants: arrayUnion(...Object.keys(members)),
    ...Object.fromEntries(Object.entries(members).map(([uid, name]) => [`participantNames.${uid}`, name])),
  });

export const removeGroupMember = (conversationId: string, uid: string) =>
  updateDoc(doc(db, "privateChats", conversationId), {
    participants: arrayRemove(uid),
    admins: arrayRemove(uid),
  });

export const leaveGroup = (conversationId: string, uid: string) =>
  updateDoc(doc(db, "privateChats", conversationId), {
    participants: arrayRemove(uid),
    admins: arrayRemove(uid),
  });

/* ── Keys ──────────────────────────────────────────────────────────────── */

export const upsertUserChatPublicKey = (uid: string, publicKeyJwk: JsonWebKey) =>
  setDoc(
    doc(db, "chatPublicKeys", uid),
    { ownerUid: uid, chatPublicKeyJwk: publicKeyJwk, chatKeyUpdatedAt: new Date().toISOString() },
    { merge: true },
  );

export const getUserChatPublicKey = async (uid: string) => {
  const snap = await getDoc(doc(db, "chatPublicKeys", uid));
  return snap.exists() ? ((snap.data().chatPublicKeyJwk as JsonWebKey | undefined) ?? null) : null;
};

/** Live public keys for a set of members, so a re-key is picked up at once. */
export const subscribePublicKeys = (
  uids: string[],
  onChange: (keys: Record<string, JsonWebKey | null>) => void,
) => {
  const keys: Record<string, JsonWebKey | null> = {};
  const unsubs = uids.map((uid) =>
    onSnapshot(
      doc(db, "chatPublicKeys", uid),
      (snap) => {
        keys[uid] = snap.exists() ? ((snap.data().chatPublicKeyJwk as JsonWebKey | undefined) ?? null) : null;
        onChange({ ...keys });
      },
      () => {
        keys[uid] = null;
        onChange({ ...keys });
      },
    ),
  );
  return () => unsubs.forEach((unsub) => unsub());
};

export const getKeyBackup = async (uid: string) => {
  const snap = await getDoc(doc(db, "chatKeyBackups", uid));
  return snap.exists() ? (snap.data() as PassphraseWrappedKey) : null;
};

export const saveKeyBackup = (uid: string, backup: PassphraseWrappedKey) =>
  setDoc(doc(db, "chatKeyBackups", uid), backup);
