import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { subscribeConversations, subscribeMessages, subscribePublicKeys } from "./service";
import type { ChatConversation, ChatMessage } from "./types";

/** Every conversation the user belongs to, hidden ones included. */
export const usePrivateConversations = (uid?: string) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeConversations(
      uid,
      (items) => {
        setConversations(items);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { conversations, loading };
};

/**
 * Retries a failed listener. The sender's own new conversation shows up
 * locally before the server has it, so the message listener can attach a
 * moment too early, be denied (the rules look the conversation up), and — as
 * Firestore listeners do after an error — stop for good.
 */
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

export const usePrivateMessages = (conversationId?: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMessages([]);
    if (!conversationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let attempt = 0;
    let unsubscribe: (() => void) | undefined;
    let retryTimer: number | undefined;

    const subscribe = () => {
      unsubscribe = subscribeMessages(
        conversationId,
        (items) => {
          attempt = 0;
          setMessages(items);
          setLoading(false);
        },
        () => {
          const delay = RETRY_DELAYS_MS[attempt++];
          if (delay === undefined) return setLoading(false);
          retryTimer = window.setTimeout(subscribe, delay);
        },
      );
    };
    subscribe();

    return () => {
      window.clearTimeout(retryTimer);
      unsubscribe?.();
    };
  }, [conversationId]);

  return { messages, loading };
};

/** Live public keys for the given members. */
export const useMemberPublicKeys = (uids: string[]) => {
  const [keys, setKeys] = useState<Record<string, JsonWebKey | null>>({});
  const signature = [...uids].sort().join(",");

  useEffect(() => {
    setKeys({});
    if (!signature) return;
    return subscribePublicKeys(signature.split(","), setKeys);
  }, [signature]);

  return keys;
};

export interface Presence {
  isOnline?: boolean;
  lastActiveAt?: string;
  lastSeenAt?: string;
}

export const usePresence = (uid?: string) => {
  const [presence, setPresence] = useState<Presence>({});
  useEffect(() => {
    setPresence({});
    if (!uid) return;
    return onSnapshot(
      doc(db, "presence", uid),
      (snapshot) => setPresence(snapshot.exists() ? (snapshot.data() as Presence) : {}),
      () => setPresence({}),
    );
  }, [uid]);
  return presence;
};

/** Re-renders every `intervalMs` while `active` — for "typing…" and "online" to expire. */
export const useTicker = (active: boolean, intervalMs = 2000) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
};
