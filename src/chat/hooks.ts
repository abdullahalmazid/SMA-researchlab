import { useEffect, useState } from "react";
import { subscribeConversations, subscribeMessages } from "./service";
import type { ChatConversation, ChatMessage } from "./types";

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
    const unsub = subscribeConversations(
      uid,
      (items) => {
        setConversations(items);
        setLoading(false);
      },
      () => {
        setConversations([]);
        setLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  return { conversations, loading };
};

export const usePrivateMessages = (conversationId?: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeMessages(
      conversationId,
      (items) => { setMessages(items); setLoading(false); },
      () => { setMessages([]); setLoading(false); },
    );

    return unsub;
  }, [conversationId]);

  return { messages, loading };
};
