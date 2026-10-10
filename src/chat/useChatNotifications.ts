import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { conversationTitle, isConversationUnread, isMuted } from "./envelope";
import { usePrivateConversations } from "./hooks";

const TITLE_PREFIX = /^\(\d+\+?\)\s/;

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

/**
 * Runs site-wide for chat members. There's no backend to send email or push,
 * so this covers the cases the browser can: an unread count for the launcher,
 * "(3)" in the tab title, and a desktop notification when a message arrives
 * while chat isn't in front of you. Muted conversations stay silent.
 */
export const useChatNotifications = (uid: string | undefined, nameOf: (uid: string) => string | undefined) => {
  const { conversations } = usePrivateConversations(uid);
  const navigate = useNavigate();
  const location = useLocation();
  const onChatPage = location.pathname === "/chat";

  const unreadCount = useMemo(
    () => (uid ? conversations.filter((c) => isConversationUnread(c, uid) && !isMuted(c, uid)).length : 0),
    [conversations, uid],
  );

  /* "(3) Site name" — re-applied if anything else rewrites the title. */
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(TITLE_PREFIX, "");
      const next = unreadCount > 0 ? `(${unreadCount > 99 ? "99+" : unreadCount}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const titleEl = document.querySelector("title");
    const observer = titleEl ? new MutationObserver(apply) : null;
    if (titleEl) observer?.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      observer?.disconnect();
      document.title = document.title.replace(TITLE_PREFIX, "");
    };
  }, [unreadCount]);

  /* Desktop notifications for messages that arrive after the page loaded. */
  const seen = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!uid) return;
    const previous = seen.current;
    const next = new Map(conversations.map((c) => [c.id, c.lastMessageAt ?? ""]));
    seen.current = next;
    if (!previous || !notificationsSupported() || Notification.permission !== "granted") return;
    if (onChatPage && document.visibilityState === "visible") return;

    conversations.forEach((conversation) => {
      const before = previous.get(conversation.id) ?? "";
      const now = conversation.lastMessageAt ?? "";
      if (!now || now <= before) return;
      if (conversation.lastSenderId === uid || isMuted(conversation, uid) || !isConversationUnread(conversation, uid)) return;

      const sender = conversation.lastSenderId ? nameOf(conversation.lastSenderId) : undefined;
      const title = conversationTitle(conversation, uid, nameOf);
      try {
        const notification = new Notification(conversation.type === "group" ? title : sender || title, {
          body: conversation.type === "group" && sender ? `${sender} sent a message` : "New message",
          tag: `chat-${conversation.id}`,
          icon: "/favicon.ico",
        });
        notification.onclick = () => {
          window.focus();
          navigate(`/chat?c=${encodeURIComponent(conversation.id)}`);
          notification.close();
        };
      } catch {
        /* Some mobile browsers only allow notifications from a service worker. */
      }
    });
  }, [conversations, navigate, nameOf, onChatPage, uid]);

  return { unreadCount };
};
