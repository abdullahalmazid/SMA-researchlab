import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
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
} from "./types";

const CHAT_TTL_HOURS = 72;

const normalizeConversationId = (uidA: string, uidB: string) =>
  [uidA, uidB].sort().join("__");

const toIsoString = (value: unknown) => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
};

const toIsoStringOrUndefined = (value: unknown) => {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return undefined;
};

export const upsertConversation = async (
  uidA: string,
  uidB: string,
  participantNames?: Record<string, string>,
) => {
  const id = normalizeConversationId(uidA, uidB);
  const participants = [uidA, uidB].sort();
  const ref = doc(db, "privateChats", id);
  const now = new Date().toISOString();

  // Do not read first: Firestore correctly denies reading a nonexistent
  // private chat because it has no participant list yet. Nested increment(0)
  // initializes counters on create and preserves them on later merges.
  await setDoc(ref, {
    participants,
    participantNames: participantNames ?? {},
    unreadCounts: {
      [uidA]: increment(0),
      [uidB]: increment(0),
    },
    typingBy: {
      [uidA]: null,
      [uidB]: null,
    },
    updatedAt: now,
  }, { merge: true });

  return id;
};

export const sendEncryptedMessage = async (input: {
  senderId: string;
  recipientId: string;
  participantNames?: Record<string, string>;
  encryptedByUser: Record<string, EncryptedMessagePayload>;
  replyToMessageId?: string;
}) => {
  const conversationId = await upsertConversation(
    input.senderId,
    input.recipientId,
    input.participantNames,
  );

  const createdAt = Timestamp.now();
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + CHAT_TTL_HOURS * 60 * 60 * 1000),
  );

  const messageRef = doc(
    collection(db, "privateChats", conversationId, "messages"),
  );

  try {
    await setDoc(messageRef, {
      conversationId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      encryptedByUser: input.encryptedByUser,
      createdAt,
      expiresAt,
      ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null) Object.assign(error, { chatStep: "message-create" });
    throw error;
  }

  try {
    await updateDoc(doc(db, "privateChats", conversationId), {
      lastMessageAt: createdAt,
      updatedAt: createdAt,
      lastMessagePreview: "Encrypted message",
      [`unreadCounts.${input.recipientId}`]: increment(1),
      [`unreadCounts.${input.senderId}`]: 0,
      [`typingBy.${input.senderId}`]: null,
      hiddenFor: arrayRemove(input.senderId, input.recipientId),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null) Object.assign(error, { chatStep: "conversation-metadata" });
    throw error;
  }

  return { conversationId, messageId: messageRef.id };
};

export const subscribeConversations = (
  uid: string,
  onChange: (items: ChatConversation[]) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(
    collection(db, "privateChats"),
    where("participants", "array-contains", uid),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .map((row: any) => ({
          id: String(row.id),
          participants: row.participants as string[],
          participantNames: (row.participantNames ?? {}) as Record<
            string,
            string
          >,
          lastMessagePreview:
            typeof row.lastMessagePreview === "string"
              ? row.lastMessagePreview
              : undefined,
          lastMessageAt: toIsoStringOrUndefined(row.lastMessageAt),
          unreadCounts: (row.unreadCounts ?? {}) as Record<string, number>,
          typingBy: (row.typingBy ?? {}) as Record<string, string | null>,
          pinnedMessageId:
            typeof row.pinnedMessageId === "string"
              ? row.pinnedMessageId
              : undefined,
          hiddenFor: Array.isArray(row.hiddenFor) ? row.hiddenFor.map(String) : [],
          clearedAtBy: (row.clearedAtBy ?? {}) as Record<string, string>,
          createdAt: toIsoString(row.createdAt),
          updatedAt: toIsoString(row.updatedAt),
        }))
        .filter((row) => !row.hiddenFor?.includes(uid))
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );

      onChange(items);
    },
    (error) => {
      onError?.(error);
      onChange([]);
    },
  );
};

export const subscribeMessages = (
  conversationId: string,
  onChange: (items: ChatMessage[]) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(
    collection(db, "privateChats", conversationId, "messages"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => {
      const row = d.data();
      return {
        id: d.id,
        conversationId,
        senderId: String(row.senderId),
        recipientId: String(row.recipientId),
        encryptedByUser: (row.encryptedByUser ?? {}) as Record<
          string,
          EncryptedMessagePayload
        >,
        createdAt: toIsoString(row.createdAt),
        expiresAt: toIsoString(row.expiresAt),
        readAt: row.readAt ? toIsoString(row.readAt) : undefined,
        deliveredAt: row.deliveredAt ? toIsoString(row.deliveredAt) : undefined,
        editedAt: row.editedAt ? toIsoString(row.editedAt) : undefined,
        deletedForEveryoneAt: row.deletedForEveryoneAt
          ? toIsoString(row.deletedForEveryoneAt)
          : undefined,
        replyToMessageId:
          typeof row.replyToMessageId === "string"
            ? row.replyToMessageId
            : undefined,
        reactions:
          row.reactions && typeof row.reactions === "object"
            ? (row.reactions as Record<string, string[]>)
            : undefined,
        hiddenFor: Array.isArray(row.hiddenFor) ? row.hiddenFor.map(String) : [],
      } as ChatMessage;
    });

    onChange(items);
  }, (error) => { onError?.(error); onChange([]); });
};

export const upsertUserChatPublicKey = async (
  uid: string,
  publicKeyJwk: JsonWebKey,
) => {
  await setDoc(
    doc(db, "chatPublicKeys", uid),
    {
      ownerUid: uid,
      chatPublicKeyJwk: publicKeyJwk,
      chatKeyUpdatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
};

export const getUserChatPublicKey = async (uid: string) => {
  const snap = await getDoc(doc(db, "chatPublicKeys", uid));
  if (!snap.exists()) return null;
  const data = snap.data() as { chatPublicKeyJwk?: JsonWebKey };
  return data.chatPublicKeyJwk ?? null;
};

export const setTypingStatus = async (
  conversationId: string,
  uid: string,
  isTyping: boolean,
) => {
  await updateDoc(doc(db, "privateChats", conversationId), {
    [`typingBy.${uid}`]: isTyping ? new Date().toISOString() : null,
  });
};

export const markConversationRead = async (
  conversationId: string,
  uid: string,
  unreadMessageIds: string[],
) => {
  const batch = writeBatch(db);
  const now = Timestamp.now();

  unreadMessageIds.forEach((messageId) => {
    const messageRef = doc(
      db,
      "privateChats",
      conversationId,
      "messages",
      messageId,
    );
    batch.update(messageRef, { readAt: now, deliveredAt: now });
  });

  const conversationRef = doc(db, "privateChats", conversationId);
  batch.update(conversationRef, {
    [`unreadCounts.${uid}`]: 0,
    [`typingBy.${uid}`]: null,
    updatedAt: now,
  });

  await batch.commit();
};

export const editMessageBySender = async (input: {
  conversationId: string;
  messageId: string;
  encryptedByUser: Record<string, EncryptedMessagePayload>;
}) => {
  await updateDoc(
    doc(db, "privateChats", input.conversationId, "messages", input.messageId),
    {
      encryptedByUser: input.encryptedByUser,
      editedAt: Timestamp.now(),
      deletedForEveryoneAt: null,
    },
  );
};

export const deleteMessageForEveryoneBySender = async (
  conversationId: string,
  messageId: string,
) => {
  await updateDoc(
    doc(db, "privateChats", conversationId, "messages", messageId),
    {
      deletedForEveryoneAt: Timestamp.now(),
      encryptedByUser: {},
      reactions: {},
    },
  );
};

export const hideMessageForUser = async (conversationId: string, messageId: string, uid: string) => {
  await updateDoc(doc(db, "privateChats", conversationId, "messages", messageId), { hiddenFor: arrayUnion(uid) });
};

export const clearConversationForUser = async (conversationId: string, uid: string) => {
  await updateDoc(doc(db, "privateChats", conversationId), {
    [`clearedAtBy.${uid}`]: new Date().toISOString(),
    [`unreadCounts.${uid}`]: 0,
    updatedAt: Timestamp.now(),
  });
};

export const hideConversationForUser = async (conversationId: string, uid: string) => {
  await updateDoc(doc(db, "privateChats", conversationId), {
    hiddenFor: arrayUnion(uid),
    [`unreadCounts.${uid}`]: 0,
    updatedAt: Timestamp.now(),
  });
};

export const restoreConversationForParticipants = async (conversationId: string, uids: string[]) => {
  await updateDoc(doc(db, "privateChats", conversationId), { hiddenFor: arrayRemove(...uids) });
};

export const deleteConversationForBoth = async (
  conversationId: string,
  requesterUid: string,
) => {
  const conversationRef = doc(db, "privateChats", conversationId);
  const conversationSnap = await getDoc(conversationRef);

  if (!conversationSnap.exists()) return;

  const participants: string[] = Array.isArray(conversationSnap.data().participants)
    ? conversationSnap.data().participants.map(String)
    : [];

  if (!participants.includes(requesterUid) || participants.length !== 2) {
    throw new Error("Only a conversation participant can delete this chat.");
  }

  // Spark-plan implementation: securely remove all client-readable message
  // material in batches. Firestore batches are capped at 500 writes.
  const messageSnap = await getDocs(
    collection(db, "privateChats", conversationId, "messages"),
  );
  const deletedAt = Timestamp.now();
  const batchSize = 400;

  for (let offset = 0; offset < messageSnap.docs.length; offset += batchSize) {
    const batch = writeBatch(db);
    messageSnap.docs.slice(offset, offset + batchSize).forEach((messageDoc) => {
      batch.update(messageDoc.ref, {
        encryptedByUser: {},
        reactions: {},
        deletedForEveryoneAt: deletedAt,
      });
    });
    await batch.commit();
  }

  const metadata: Record<string, unknown> = {
    deletedForEveryoneAt: deletedAt,
    lastMessagePreview: "Conversation deleted",
    hiddenFor: arrayUnion(...participants),
    pinnedMessageId: null,
    updatedAt: deletedAt,
  };
  participants.forEach((uid) => {
    metadata[`unreadCounts.${uid}`] = 0;
    metadata[`typingBy.${uid}`] = null;
    metadata[`clearedAtBy.${uid}`] = deletedAt.toDate().toISOString();
  });
  await updateDoc(conversationRef, metadata);
};

export const setPinnedConversationMessage = async (
  conversationId: string,
  messageId: string | null,
) => {
  await updateDoc(doc(db, "privateChats", conversationId), {
    pinnedMessageId: messageId,
    updatedAt: Timestamp.now(),
  });
};

export const addReactionToMessage = async (
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string,
) => {
  const messageRef = doc(
    db,
    "privateChats",
    conversationId,
    "messages",
    messageId,
  );
  const messageSnap = await getDoc(messageRef);

  if (!messageSnap.exists()) return;

  const currentReactions = (messageSnap.data().reactions ?? {}) as Record<
    string,
    string[]
  >;
  const reactors = currentReactions[emoji] ?? [];

  // Only add if user hasn't already reacted with this emoji
  if (!reactors.includes(userId)) {
    reactors.push(userId);
    currentReactions[emoji] = reactors;

    await updateDoc(messageRef, {
      reactions: currentReactions,
    });
  }
};

export const removeReactionFromMessage = async (
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string,
) => {
  const messageRef = doc(
    db,
    "privateChats",
    conversationId,
    "messages",
    messageId,
  );
  const messageSnap = await getDoc(messageRef);

  if (!messageSnap.exists()) return;

  const currentReactions = (messageSnap.data().reactions ?? {}) as Record<
    string,
    string[]
  >;
  const reactors = currentReactions[emoji] ?? [];

  // Remove user from reactors
  const updatedReactors = reactors.filter((uid) => uid !== userId);

  if (updatedReactors.length === 0) {
    // Delete empty reaction
    delete currentReactions[emoji];
  } else {
    currentReactions[emoji] = updatedReactors;
  }

  await updateDoc(messageRef, {
    reactions: currentReactions,
  });
};
