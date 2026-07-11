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

export interface ChatConversation {
  id: string;
  participants: string[];
  participantNames?: Record<string, string>;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCounts?: Record<string, number>;
  typingBy?: Record<string, string | null>;
  pinnedMessageId?: string;
  hiddenFor?: string[];
  clearedAtBy?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  encryptedByUser: Record<string, EncryptedMessagePayload>;
  createdAt: string;
  expiresAt: string;
  readAt?: string;
  deliveredAt?: string;
  editedAt?: string;
  deletedForEveryoneAt?: string;
  replyToMessageId?: string;
  reactions?: Record<string, string[]>;
  hiddenFor?: string[];
}
