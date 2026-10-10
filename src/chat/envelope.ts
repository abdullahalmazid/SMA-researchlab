import type { ChatAttachment, ChatConversation, MessageEnvelope } from "./types";

/**
 * A message decrypts to either plain text (every message before attachments
 * existed) or a small JSON envelope carrying text plus an encrypted file's
 * location and key. The marker keeps a person who literally types JSON from
 * being misread as an envelope.
 */
const MARKER = "__rlchat";

export const encodeEnvelope = (envelope: MessageEnvelope): string =>
  envelope.attachment
    ? JSON.stringify({ [MARKER]: 2, text: envelope.text, attachment: envelope.attachment })
    : envelope.text;

export const decodeEnvelope = (plain: string): MessageEnvelope => {
  if (plain.startsWith(`{"${MARKER}"`)) {
    try {
      const parsed = JSON.parse(plain) as { text?: unknown; attachment?: ChatAttachment };
      return {
        text: typeof parsed.text === "string" ? parsed.text : "",
        attachment: parsed.attachment && typeof parsed.attachment.url === "string" ? parsed.attachment : undefined,
      };
    } catch {
      /* fall through to plain text */
    }
  }
  return { text: plain };
};

/** The short line shown in the conversation list. */
export const previewText = (envelope: MessageEnvelope) => {
  const text = envelope.text.replace(/\s+/g, " ").trim();
  const head = text.length > 90 ? `${text.slice(0, 88)}…` : text;
  if (envelope.attachment) return head ? `📎 ${head}` : `📎 ${envelope.attachment.name}`;
  return head;
};

/* ── Unread, presence, names ───────────────────────────────────────────── */

const ms = (value?: string) => (value ? Date.parse(value) || 0 : 0);

export const isConversationUnread = (conversation: ChatConversation, uid: string) => {
  if (conversation.hiddenFor.includes(uid)) return false;
  if (conversation.lastSenderId) {
    return conversation.lastSenderId !== uid && ms(conversation.lastMessageAt) > ms(conversation.readAt[uid]);
  }
  // Conversations from before readAt kept a counter instead.
  return (conversation.legacyUnreadCounts[uid] ?? 0) > 0;
};

export const isMuted = (conversation: ChatConversation, uid: string) => conversation.mutedBy[uid] === true;

/**
 * Presence is written every minute while a tab is open, but a closed tab never
 * gets to say "offline". Treat a stale heartbeat as offline.
 */
const PRESENCE_FRESH_MS = 150_000;
export const isPresenceOnline = (presence?: { isOnline?: boolean; lastActiveAt?: string }) =>
  Boolean(presence?.isOnline && Date.now() - ms(presence.lastActiveAt) < PRESENCE_FRESH_MS);

export const TYPING_FRESH_MS = 6_000;
export const isTypingFresh = (value?: string | null) => Boolean(value && Date.now() - ms(value) < TYPING_FRESH_MS);

export const conversationTitle = (
  conversation: ChatConversation,
  uid: string,
  nameOf: (uid: string) => string | undefined,
) => {
  if (conversation.type === "group") return conversation.title || "Untitled group";
  const other = conversation.participants.find((p) => p !== uid);
  return (other && (nameOf(other) || conversation.participantNames[other])) || "Former collaborator";
};
