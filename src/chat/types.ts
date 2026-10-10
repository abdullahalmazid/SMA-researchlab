export interface ChatKeyBundle {
  algorithm: "RSA-OAEP";
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  createdAt: string;
}

export interface EncryptedMessagePayload {
  ciphertextB64: string;
  ivB64: string;
  wrappedKeyB64: string;
  version: 1;
}

/** The private key, encrypted with the member's chat passphrase. */
export interface PassphraseWrappedKey {
  ciphertextB64: string;
  ivB64: string;
  saltB64: string;
  iterations: number;
  version: 1;
  publicKeyJwk: JsonWebKey;
  createdAt: string;
}

export type ConversationType = "direct" | "group";

export interface ChatConversation {
  id: string;
  type: ConversationType;
  participants: string[];
  participantNames: Record<string, string>;
  /** Groups only. */
  title?: string;
  admins: string[];
  createdBy?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  /** The last message's preview, encrypted separately for each member. */
  previewByUser: Record<string, EncryptedMessagePayload>;
  readAt: Record<string, string>;
  typingBy: Record<string, string | null>;
  mutedBy: Record<string, boolean>;
  hiddenFor: string[];
  clearedAtBy: Record<string, string>;
  /** "Clear chat for everyone": messages before this are hidden for all. */
  clearedForAllAt?: string;
  pinnedMessageId?: string;
  /** Pre-readAt conversations tracked a per-member counter instead. */
  legacyUnreadCounts: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  /** Direct chats only. */
  recipientId?: string;
  encryptedByUser: Record<string, EncryptedMessagePayload>;
  createdAt: string;
  expiresAt: string;
  /** Legacy per-message receipt; newer receipts come from conversation.readAt. */
  readAt?: string;
  editedAt?: string;
  deletedForEveryoneAt?: string;
  replyToMessageId?: string;
  /** uid → emoji. One reaction per person. */
  reactions: Record<string, string>;
  hiddenFor: string[];
  /** Still waiting for the server to confirm the write. */
  pending: boolean;
}

/** A file shared in chat. The bytes are AES-encrypted before upload. */
export interface ChatAttachment {
  url: string;
  name: string;
  mime: string;
  size: number;
  keyB64: string;
  ivB64: string;
}

/** What a message decrypts to. */
export interface MessageEnvelope {
  text: string;
  attachment?: ChatAttachment;
}
