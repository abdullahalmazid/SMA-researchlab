import { ArrowDown, ArrowLeft, Info, MessageSquarePlus, MoreVertical, Pin, Search, X } from "lucide-react";
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCollaborators } from "../../firebase/hooks";
import type { User } from "../../types";
import { uploadEncryptedFile } from "../attachments";
import { decryptWithPrivateKey, encryptForRecipients } from "../crypto";
import {
  conversationTitle,
  decodeEnvelope,
  encodeEnvelope,
  isConversationUnread,
  isMuted,
  isPresenceOnline,
  isTypingFresh,
  previewText,
} from "../envelope";
import { useMemberPublicKeys, usePresence, usePrivateConversations, usePrivateMessages, useTicker } from "../hooks";
import { resolveChatKeyStatus, type ChatKeyStatus, type ReadyKeys } from "../keyStore";
import {
  addGroupMembers,
  clearConversationForEveryone,
  clearConversationForMe,
  createGroupConversation,
  deleteMessageForEveryone,
  directConversationId,
  editMessage,
  getUserChatPublicKey,
  hideConversationForMe,
  hideMessageForMe,
  leaveGroup,
  markConversationRead,
  removeGroupMember,
  renameGroup,
  sendMessage,
  setConversationMuted,
  setPinnedMessage,
  setReaction,
  setTypingStatus,
} from "../service";
import type { ChatConversation, ChatMessage } from "../types";
import { ChatFeedbackProvider, useChatFeedback } from "./ChatFeedback";
import { Avatar, formatLastSeen, iconButton } from "./chatUi";
import Composer, { MAX_MESSAGE_LENGTH } from "./Composer";
import ConversationList from "./ConversationList";
import InfoPanel from "./InfoPanel";
import KeySetup from "./KeySetup";
import MessageList, { type Decoded } from "./MessageList";
import PeoplePicker from "./PeoplePicker";

/* The emoji library is large; only load it when someone opens the full picker. */
const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface ChatWorkspaceProps {
  appUser: User | null;
  immersive?: boolean;
  /** App chrome lives in the sidebar header, so there's no second bar on top. */
  brand?: { title?: string; logoUrl?: string };
  onBack?: () => void;
  onOpenSettings?: () => void;
}

const ms = (value?: string) => (value ? Date.parse(value) || 0 : 0);
const NEAR_BOTTOM_PX = 140;

const decodeMessage = async (message: ChatMessage, uid: string, privateKey: CryptoKey): Promise<Decoded> => {
  if (message.deletedForEveryoneAt) return { state: "deleted" };
  const payload = message.encryptedByUser[uid];
  if (!payload) return { state: "locked" };
  try {
    return { state: "ok", envelope: decodeEnvelope(await decryptWithPrivateKey(payload, privateKey)) };
  } catch {
    return { state: "locked" };
  }
};

const cacheKeyFor = (message: ChatMessage, uid: string) =>
  `${message.id}|${message.editedAt ?? ""}|${message.deletedForEveryoneAt ? 1 : 0}|${
    message.encryptedByUser[uid]?.wrappedKeyB64.slice(0, 24) ?? ""
  }`;

const friendlyError = (error: unknown, fallback: string) => {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code.includes("permission-denied")) return "You don't have permission to do that here. You may no longer be a member of this chat.";
  if (code.includes("unavailable") || code.includes("network")) return "You seem to be offline. Check your connection and try again.";
  return error instanceof Error && error.message && !error.message.startsWith("FirebaseError") ? error.message : fallback;
};

const Workspace: React.FC<ChatWorkspaceProps> = ({ appUser, immersive = false, brand, onBack, onOpenSettings }) => {
  const uid = appUser?.uid ?? "";
  const { notify, confirm } = useChatFeedback();
  const [params, setParams] = useSearchParams();

  /* ── Keys ─────────────────────────────────────────────────────────── */
  const [keyStatus, setKeyStatus] = useState<ChatKeyStatus>({ state: "loading" });
  const keys = keyStatus.state === "ready" ? keyStatus.keys : null;

  const loadKeys = useCallback(() => {
    if (!uid) return;
    setKeyStatus({ state: "loading" });
    void resolveChatKeyStatus(uid).then(setKeyStatus);
  }, [uid]);
  useEffect(loadKeys, [loadKeys]);

  /* ── Directory and conversations ──────────────────────────────────── */
  const { collaborators } = useCollaborators();
  const people = useMemo(() => collaborators.filter((c) => c.uid && c.uid !== uid), [collaborators, uid]);
  const profilesByUid = useMemo(() => new Map(collaborators.map((c) => [c.uid, c] as const)), [collaborators]);
  const profileOf = useCallback((id: string) => profilesByUid.get(id), [profilesByUid]);

  const { conversations, loading: loadingConversations } = usePrivateConversations(uid || undefined);
  const visibleConversations = useMemo(
    () => conversations.filter((c) => !c.hiddenFor.includes(uid)),
    [conversations, uid],
  );

  /* ?to=<uid> comes from the "Message" buttons on collaborator cards and
     profiles: open the direct chat with that person (new or existing). */
  const [linkedRecipient] = useState(() => {
    const to = params.get("to");
    return to && uid && to !== uid ? to : null;
  });
  const [selectedId, setSelectedId] = useState<string | undefined>(() =>
    linkedRecipient ? directConversationId(uid, linkedRecipient) : (params.get("c") ?? undefined),
  );
  /** A direct chat picked from the directory before its document exists. */
  const [pendingDirectUid, setPendingDirectUid] = useState<string | null>(linkedRecipient);

  const existing = conversations.find((c) => c.id === selectedId);
  const selected: ChatConversation | undefined = useMemo(() => {
    if (existing) return existing;
    if (!pendingDirectUid || !uid) return undefined;
    const participants = [uid, pendingDirectUid].sort();
    return {
      id: directConversationId(uid, pendingDirectUid),
      type: "direct",
      participants,
      participantNames: {},
      admins: [],
      previewByUser: {},
      readAt: {},
      typingBy: {},
      mutedBy: {},
      hiddenFor: [],
      clearedAtBy: {},
      legacyUnreadCounts: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [existing, pendingDirectUid, uid]);

  /* Keep ?c= in the URL so a notification or reload reopens the same chat. */
  useEffect(() => {
    const current = params.get("c") ?? undefined;
    if (current === selectedId && !params.has("to")) return;
    const next = new URLSearchParams(params);
    next.delete("to");
    if (selectedId) next.set("c", selectedId);
    else next.delete("c");
    setParams(next, { replace: true });
  }, [params, selectedId, setParams]);

  const nameOf = useCallback(
    (id: string) =>
      id === uid ? appUser?.name || "You" : profileOf(id)?.name || selected?.participantNames[id] || "Former collaborator",
    [appUser?.name, profileOf, selected?.participantNames, uid],
  );
  const photoOf = useCallback((id: string) => profileOf(id)?.photo, [profileOf]);

  const isGroup = selected?.type === "group";
  const otherUid = !isGroup ? selected?.participants.find((p) => p !== uid) : undefined;
  const title = selected ? conversationTitle(selected, uid, (id) => profileOf(id)?.name) : "";
  const presence = usePresence(otherUid);
  const online = isPresenceOnline(presence);

  /* ── Messages and decryption ──────────────────────────────────────── */
  const { messages, loading: loadingMessages } = usePrivateMessages(existing?.id);
  const memberKeys = useMemberPublicKeys(selected?.participants ?? []);

  const decodeCache = useRef(new Map<string, Decoded>());
  const [decoded, setDecoded] = useState<Record<string, Decoded>>({});

  /* Decrypts only what's new or changed. Before, every snapshot — including
     each typing ping — re-imported the private key and re-decrypted the lot. */
  useEffect(() => {
    if (!keys || !uid) return;
    let cancelled = false;
    const cache = decodeCache.current;
    const missing = messages.filter((m) => !cache.has(cacheKeyFor(m, uid)));

    const publish = () =>
      setDecoded(
        Object.fromEntries(
          messages.map((m) => [m.id, cache.get(cacheKeyFor(m, uid)) ?? ({ state: "decrypting" } as Decoded)]),
        ),
      );

    if (missing.length === 0) {
      publish();
      return;
    }
    void Promise.all(
      missing.map(async (m) => cache.set(cacheKeyFor(m, uid), await decodeMessage(m, uid, keys.privateKey))),
    ).then(() => !cancelled && publish());
    return () => {
      cancelled = true;
    };
  }, [keys, messages, uid]);

  /* Conversation-list previews, each encrypted for this member. */
  const previewCache = useRef(new Map<string, string>());
  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!keys || !uid) return;
    let cancelled = false;
    void Promise.all(
      visibleConversations.map(async (c) => {
        const payload = c.previewByUser[uid];
        if (!payload) return [c.id, ""] as const;
        const cacheKey = payload.wrappedKeyB64.slice(0, 32);
        let text = previewCache.current.get(cacheKey);
        if (text === undefined) {
          try {
            text = await decryptWithPrivateKey(payload, keys.privateKey);
          } catch {
            text = "Encrypted message";
          }
          previewCache.current.set(cacheKey, text);
        }
        const prefix = c.lastSenderId === uid ? "You: " : c.type === "group" && c.lastSenderId ? `${(profileOf(c.lastSenderId)?.name ?? "").split(" ")[0]}: ` : "";
        return [c.id, text ? `${prefix}${text}` : ""] as const;
      }),
    ).then((entries) => !cancelled && setPreviews(Object.fromEntries(entries)));
    return () => {
      cancelled = true;
    };
  }, [keys, profileOf, uid, visibleConversations]);

  /* What this member should see: not hidden, not cleared, not expired. */
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const searchTerm = messageSearchOpen ? messageSearch.trim() : "";

  const shownMessages = useMemo(() => {
    const clearedAt = Math.max(ms(selected?.clearedAtBy[uid]), ms(selected?.clearedForAllAt));
    const now = Date.now();
    return messages.filter((m) => {
      if (m.hiddenFor.includes(uid)) return false;
      if (clearedAt && ms(m.createdAt) <= clearedAt) return false;
      // TTL deletion runs within ~24h of expiry; don't show what has expired.
      if (m.expiresAt && ms(m.expiresAt) < now) return false;
      return true;
    });
  }, [messages, selected?.clearedAtBy, selected?.clearedForAllAt, uid]);

  const listedMessages = useMemo(() => {
    if (!searchTerm) return shownMessages;
    const needle = searchTerm.toLowerCase();
    return shownMessages.filter((m) => {
      const value = decoded[m.id];
      return (
        value?.state === "ok" &&
        (value.envelope.text.toLowerCase().includes(needle) ||
          value.envelope.attachment?.name.toLowerCase().includes(needle))
      );
    });
  }, [decoded, searchTerm, shownMessages]);

  /* "New messages" divider: where this member's last read point was on open. */
  const [unreadAnchor, setUnreadAnchor] = useState<{ id: string; readAt: number } | null>(null);
  useEffect(() => {
    if (!existing || unreadAnchor?.id === existing.id) return;
    setUnreadAnchor({ id: existing.id, readAt: ms(existing.readAt[uid]) });
  }, [existing, uid, unreadAnchor?.id]);
  /* Fixed when the conversation first paints, so messages that arrive while
     you're watching don't get a "New messages" divider of their own. */
  const [unreadDivider, setUnreadDivider] = useState<{ conversationId: string; messageId?: string } | null>(null);
  const firstUnreadId = unreadDivider?.conversationId === selected?.id ? unreadDivider?.messageId : undefined;

  /* ── Read state ───────────────────────────────────────────────────── */
  const [pageVisible, setPageVisible] = useState(document.visibilityState === "visible");
  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [mobilePane, setMobilePane] = useState<"list" | "chat">(selectedId ? "chat" : "list");
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const chatVisible = !isMobile || mobilePane === "chat";

  useEffect(() => {
    if (!existing || !uid || !keys || !pageVisible || !chatVisible) return;
    if (!isConversationUnread(existing, uid)) return;
    void markConversationRead(existing.id, uid, (existing.legacyUnreadCounts[uid] ?? 0) > 0).catch(() => undefined);
  }, [existing, uid, keys, pageVisible, chatVisible]);

  /* ── Scrolling ────────────────────────────────────────────────────── */
  const paneRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);
  const scrolledFor = useRef<string | undefined>(undefined);
  const lastCount = useRef(0);

  const scrollToBottom = (smooth = false) => {
    const pane = paneRef.current;
    if (pane) pane.scrollTo({ top: pane.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setShowJump(false);
  };

  const jumpTo = (id: string) => {
    const target = document.getElementById(`msg-${id}`);
    if (!target) return notify("That message is no longer loaded.", "info");
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.animate?.([{ background: "rgba(250,204,21,.35)" }, { background: "transparent" }], { duration: 1400 });
  };

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !selected) return;
    const allDecoded = shownMessages.every((m) => decoded[m.id] && decoded[m.id].state !== "decrypting");

    // First paint of a conversation: go to the first unread, else the bottom.
    if (scrolledFor.current !== selected.id) {
      if (loadingMessages || !allDecoded) return;
      scrolledFor.current = selected.id;
      lastCount.current = shownMessages.length;
      const anchor = unreadAnchor?.id === selected.id ? unreadAnchor.readAt : 0;
      const dividerId = anchor
        ? shownMessages.find((m) => m.senderId !== uid && ms(m.createdAt) > anchor)?.id
        : undefined;
      setUnreadDivider({ conversationId: selected.id, messageId: dividerId });
      requestAnimationFrame(() => {
        if (dividerId) document.getElementById(`msg-${dividerId}`)?.scrollIntoView({ block: "start" });
        else scrollToBottom();
      });
      return;
    }

    if (shownMessages.length > lastCount.current) {
      const newest = shownMessages[shownMessages.length - 1];
      const nearBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < NEAR_BOTTOM_PX;
      if (newest?.senderId === uid || nearBottom) requestAnimationFrame(() => scrollToBottom(true));
      else setShowJump(true);
    }
    lastCount.current = shownMessages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownMessages, decoded, loadingMessages, selected?.id]);

  /* ── Composer state ───────────────────────────────────────────────── */
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /* Typing: one write when typing starts (refreshed every 4s), one when it
     stops — not one per pause in every word. */
  const typingSentAt = useRef(0);
  const typingStopTimer = useRef<number>();
  const typingConversation = useRef<string>();

  const stopTyping = useCallback(() => {
    window.clearTimeout(typingStopTimer.current);
    const conversationId = typingConversation.current;
    if (typingSentAt.current && conversationId && uid) {
      void setTypingStatus(conversationId, uid, false).catch(() => undefined);
    }
    typingSentAt.current = 0;
  }, [uid]);

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!existing || editingId) return;
    typingConversation.current = existing.id;
    if (!value.trim()) return stopTyping();
    if (Date.now() - typingSentAt.current > 4000) {
      typingSentAt.current = Date.now();
      void setTypingStatus(existing.id, uid, true).catch(() => undefined);
    }
    window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(stopTyping, 3000);
  };

  /* Switching chats: drop the composer state and the typing flag. */
  useEffect(() => {
    stopTyping();
    setDraft("");
    setFile(null);
    setReplyToId(null);
    setEditingId(null);
    setMessageSearchOpen(false);
    setMessageSearch("");
    setShowJump(false);
    setInfoOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);
  useEffect(() => () => stopTyping(), [stopTyping]);

  /* ── Actions ──────────────────────────────────────────────────────── */
  /* A key that's still loading (undefined) is fetched directly rather than
     reported as missing — sending right after opening a chat used to say
     "hasn't set up secure messaging" for someone who had. */
  const recipientKeys = async (): Promise<{ keysByUid: Record<string, JsonWebKey>; missing: string[] }> => {
    const keysByUid: Record<string, JsonWebKey> = {};
    const missing: string[] = [];
    await Promise.all(
      (selected?.participants ?? []).map(async (member) => {
        const key =
          member === uid
            ? keys?.bundle.publicKeyJwk
            : memberKeys[member] === undefined
              ? await getUserChatPublicKey(member).catch(() => null)
              : memberKeys[member];
        if (key) keysByUid[member] = key;
        else missing.push(member);
      }),
    );
    return { keysByUid, missing };
  };

  const send = async () => {
    if (!selected || !keys || sending) return;
    if (editingId) return void saveEdit();
    const text = draft.trim();
    if ((!text && !file) || text.length > MAX_MESSAGE_LENGTH) return;

    setSending(true);
    try {
      const { keysByUid, missing } = await recipientKeys();
      if (!isGroup && otherUid && !keysByUid[otherUid]) {
        notify(`${nameOf(otherUid)} hasn't set up secure messaging yet. They need to open chat once before you can message them.`, "error");
        return;
      }
      const attachment = file ? await uploadEncryptedFile(file) : undefined;
      const envelope = { text, attachment };
      const [encryptedByUser, previewByUser] = await Promise.all([
        encryptForRecipients(encodeEnvelope(envelope), keysByUid),
        encryptForRecipients(previewText(envelope), keysByUid),
      ]);
      typingSentAt.current = 0; // the batch clears the typing flag
      window.clearTimeout(typingStopTimer.current);

      await sendMessage({
        conversationId: selected.id,
        create: existing
          ? undefined
          : {
              type: "direct",
              participants: selected.participants,
              participantNames: Object.fromEntries(selected.participants.map((p) => [p, nameOf(p)])),
            },
        participants: selected.participants,
        senderId: uid,
        recipientId: isGroup ? undefined : otherUid,
        encryptedByUser,
        previewByUser,
        replyToMessageId: replyToId ?? undefined,
      });

      setDraft("");
      setFile(null);
      setReplyToId(null);
      if (!existing) setPendingDirectUid(null);
      if (isGroup && missing.length > 0) {
        notify(
          `${missing.length === 1 ? nameOf(missing[0]) + " hasn't" : `${missing.length} members haven't`} set up secure messaging yet and won't be able to read this.`,
          "info",
        );
      }
    } catch (error) {
      notify(friendlyError(error, "Your message wasn't sent. Try again."), "error");
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async () => {
    const message = messages.find((m) => m.id === editingId);
    const current = editingId ? decoded[editingId] : undefined;
    if (!selected || !message || current?.state !== "ok") return;
    const text = draft.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) return;
    setSending(true);
    try {
      const { keysByUid } = await recipientKeys();
      await editMessage(
        selected.id,
        message.id,
        await encryptForRecipients(encodeEnvelope({ ...current.envelope, text }), keysByUid),
      );
      setEditingId(null);
      setDraft("");
    } catch (error) {
      notify(friendlyError(error, "Your edit wasn't saved."), "error");
    } finally {
      setSending(false);
    }
  };

  const run = async (action: () => Promise<unknown>, failure: string, success?: string) => {
    try {
      await action();
      if (success) notify(success, "success");
      return true;
    } catch (error) {
      notify(friendlyError(error, failure), "error");
      return false;
    }
  };

  const messageActions = {
    onReply: (id: string) => {
      setEditingId(null);
      setReplyToId(id);
    },
    onEdit: (id: string) => {
      const value = decoded[id];
      if (value?.state !== "ok") return;
      setReplyToId(null);
      setFile(null);
      setEditingId(id);
      setDraft(value.envelope.text);
    },
    onCopy: (id: string) => {
      const value = decoded[id];
      if (value?.state !== "ok") return;
      void navigator.clipboard
        .writeText(value.envelope.text)
        .then(() => notify("Copied to clipboard.", "success"))
        .catch(() => notify("Your browser blocked copying.", "error"));
    },
    onTogglePin: (id: string) => {
      if (!existing) return;
      void run(() => setPinnedMessage(existing.id, existing.pinnedMessageId === id ? null : id), "Couldn't update the pinned message.");
    },
    onDeleteForMe: (id: string) => {
      if (!existing) return;
      void run(() => hideMessageForMe(existing.id, id, uid), "Couldn't delete that message.");
    },
    onDeleteForEveryone: (id: string) => {
      if (!existing) return;
      void run(async () => {
        await deleteMessageForEveryone(existing.id, id);
        if (existing.pinnedMessageId === id) await setPinnedMessage(existing.id, null);
      }, "Couldn't delete that message.");
    },
    onReact: (id: string, emoji: string | null) => {
      if (!existing) return;
      void run(() => setReaction(existing.id, id, uid, emoji), "Couldn't add your reaction.");
    },
    onMoreReactions: (id: string) => setEmojiFor(id),
  };

  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<null | "new" | "add">(null);
  const [listSearch, setListSearch] = useState("");

  const openConversation = (id: string) => {
    setPendingDirectUid(null);
    setSelectedId(id);
    setMobilePane("chat");
    setListSearch("");
  };

  const startDirect = (otherId: string) => {
    if (!uid) return;
    const id = directConversationId(uid, otherId);
    setPendingDirectUid(conversations.some((c) => c.id === id) ? null : otherId);
    setSelectedId(id);
    setMobilePane("chat");
    setListSearch("");
    setPicker(null);
  };

  const closeConversation = () => {
    setSelectedId(undefined);
    setPendingDirectUid(null);
    setMobilePane("list");
  };

  const conversationMenu = async (action: string) => {
    setMenuOpen(false);
    if (!existing) return;
    const ownMessageIds = messages.filter((m) => m.senderId === uid).map((m) => m.id);

    if (action === "mute") {
      const muted = isMuted(existing, uid);
      await run(() => setConversationMuted(existing.id, uid, !muted), "Couldn't change notifications.", muted ? "Notifications on." : "Muted.");
    } else if (action === "clear-me") {
      if (await confirm({ title: "Clear chat history for you?", body: "Other members keep their copy.", confirmLabel: "Clear", danger: true })) {
        await run(() => clearConversationForMe(existing.id, uid), "Couldn't clear this chat.");
      }
    } else if (action === "clear-all") {
      if (
        await confirm({
          title: "Clear this chat for everyone?",
          body: "Your messages are deleted and earlier history is hidden for every member. This can't be undone.",
          confirmLabel: "Clear for everyone",
          danger: true,
        })
      ) {
        await run(() => clearConversationForEveryone(existing.id, ownMessageIds), "Couldn't clear this chat.");
      }
    } else if (action === "hide") {
      if (await confirm({ title: "Delete this chat for you?", body: "It comes back if someone sends a new message.", confirmLabel: "Delete", danger: true })) {
        if (await run(() => hideConversationForMe(existing.id, uid), "Couldn't delete this chat.")) closeConversation();
      }
    }
  };

  const createGroup = async (groupTitle: string, memberIds: string[]) => {
    const names = Object.fromEntries([uid, ...memberIds].map((id) => [id, nameOf(id)]));
    try {
      const id = await createGroupConversation({ creatorId: uid, title: groupTitle, memberIds, participantNames: names });
      setPicker(null);
      openConversation(id);
      notify(`“${groupTitle.trim()}” created.`, "success");
    } catch (error) {
      notify(friendlyError(error, "Couldn't create the group."), "error");
    }
  };

  /* "typing…" and "online" go stale on a timer, not on a data change. */
  useTicker(true, 3000);

  /* ── Render ───────────────────────────────────────────────────────── */
  const shell = immersive ? "h-full" : "h-[680px] overflow-hidden rounded-3xl border border-slate-200 shadow-xl";

  if (!uid) return null;

  if (keyStatus.state !== "ready") {
    return (
      <div className={`${shell} relative bg-slate-50`}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute left-3 top-3 z-10 flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 shadow-sm hover:text-slate-900"
          >
            <ArrowLeft size={16} /> Website
          </button>
        )}
        {keyStatus.state === "loading" ? (
          <div className="grid h-full place-items-center">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-300 border-t-transparent" aria-label="Loading" />
          </div>
        ) : (
          <KeySetup
            uid={uid}
            status={keyStatus}
            onRetry={loadKeys}
            onReady={(ready: ReadyKeys, hasBackup) => setKeyStatus({ state: "ready", keys: ready, hasBackup })}
          />
        )}
      </div>
    );
  }

  const typingNames = selected
    ? Object.entries(selected.typingBy)
        .filter(([id, at]) => id !== uid && isTypingFresh(at))
        .map(([id]) => nameOf(id).split(" ")[0])
    : [];
  const subtitle = !selected
    ? ""
    : typingNames.length
      ? isGroup
        ? `${typingNames.join(", ")} ${typingNames.length === 1 ? "is" : "are"} typing…`
        : "typing…"
      : isGroup
        ? `${selected.participants.length} members`
        : online
          ? "online"
          : presence.lastActiveAt
            ? formatLastSeen(presence.lastActiveAt)
            : "";

  const pinned = existing?.pinnedMessageId ? messages.find((m) => m.id === existing.pinnedMessageId) : undefined;
  const pinnedDecoded = pinned ? decoded[pinned.id] : undefined;
  const replyMessage = replyToId ? messages.find((m) => m.id === replyToId) : undefined;
  const replyDecoded = replyMessage ? decoded[replyMessage.id] : undefined;
  const canClearForAll = existing && (existing.type === "direct" || existing.admins.includes(uid));

  return (
    <div className={`${shell} grid min-h-0 grid-cols-1 overflow-hidden bg-white lg:grid-cols-[340px_minmax(0,1fr)]`}>
      {(!isMobile || mobilePane === "list") && (
        <div className="min-h-0 border-r border-slate-200">
          <ConversationList
            uid={uid}
            conversations={visibleConversations}
            loading={loadingConversations}
            selectedId={selected?.id}
            previews={previews}
            collaborators={people}
            profileOf={profileOf}
            search={listSearch}
            onSearch={setListSearch}
            onSelect={openConversation}
            onStartDirect={startDirect}
            onNewChat={() => setPicker("new")}
            me={{ name: appUser?.name || "You", photo: photoOf(uid) }}
            brand={brand}
            onBack={onBack}
            onOpenSettings={onOpenSettings}
            notice={
              !keyStatus.hasBackup && (
                <p className="m-0 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] leading-relaxed text-amber-900">
                  Your chat key isn't backed up. Reopen chat to create a passphrase, or you'll lose access on other devices.
                </p>
              )
            }
          />
        </div>
      )}

      {chatVisible && (
        <section className="relative flex min-h-0 min-w-0 bg-slate-50" aria-label={title || "Conversation"}>
          {!selected ? (
            <div className="flex min-h-0 flex-1 flex-col">
            <div className="h-16 shrink-0 border-b border-slate-200 bg-white" />
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white" style={{ background: "var(--chat-accent)" }}>
                  <MessageSquarePlus size={24} />
                </span>
                <p className="m-0 mt-4 text-[16px] font-bold text-slate-900">Your messages</p>
                <p className="m-0 mt-1 text-[13.5px] text-slate-500">Pick a conversation, or start a new chat or group.</p>
                <button
                  type="button"
                  onClick={() => setPicker("new")}
                  className="mt-4 h-10 rounded-xl border-0 px-4 text-[13.5px] font-semibold text-white"
                  style={{ background: "var(--chat-accent)" }}
                >
                  New chat
                </button>
              </div>
            </div>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {/* Header */}
              <header className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:px-3">
                {isMobile && (
                  <button type="button" onClick={() => setMobilePane("list")} className={iconButton} aria-label="Back to chats">
                    <ArrowLeft size={19} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInfoOpen((v) => !v)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border-0 bg-transparent p-1 text-left hover:bg-slate-50"
                >
                  <Avatar name={title} photo={otherUid ? photoOf(otherUid) : undefined} size={40} group={isGroup} online={online} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold text-slate-900">{title}</span>
                    <span
                      className="block truncate text-[12.5px] text-slate-500"
                      style={typingNames.length ? { color: "var(--chat-accent)" } : undefined}
                    >
                      {subtitle}
                    </span>
                  </span>
                </button>
                {existing && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMessageSearchOpen((v) => !v)}
                      className={iconButton}
                      aria-label="Search in this chat"
                      aria-pressed={messageSearchOpen}
                    >
                      <Search size={18} />
                    </button>
                    <button type="button" onClick={() => setInfoOpen((v) => !v)} className={`${iconButton} hidden sm:grid`} aria-label="Chat details">
                      <Info size={18} />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        className={iconButton}
                        aria-label="Chat options"
                        aria-expanded={menuOpen}
                      >
                        <MoreVertical size={18} />
                      </button>
                      {menuOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                          <div role="menu" className="absolute right-0 top-11 z-40 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                            {[
                              { id: "mute", label: isMuted(existing, uid) ? "Unmute notifications" : "Mute notifications" },
                              { id: "clear-me", label: "Clear history for me" },
                              ...(canClearForAll ? [{ id: "clear-all", label: "Clear for everyone", danger: true }] : []),
                              { id: "hide", label: "Delete chat for me", danger: true },
                            ].map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                role="menuitem"
                                onClick={() => void conversationMenu(item.id)}
                                className={`block w-full rounded-lg border-0 bg-transparent px-3 py-2 text-left text-[13.5px] font-medium hover:bg-slate-50 ${
                                  "danger" in item && item.danger ? "text-rose-600" : "text-slate-700"
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </header>

              {messageSearchOpen && (
                <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
                  <Search size={15} className="text-slate-400" />
                  <input
                    autoFocus
                    value={messageSearch}
                    onChange={(event) => setMessageSearch(event.target.value)}
                    onKeyDown={(event) => event.key === "Escape" && setMessageSearchOpen(false)}
                    placeholder="Search in this chat"
                    aria-label="Search in this chat"
                    className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-slate-900 outline-none"
                  />
                  {searchTerm && (
                    <span className="text-[12px] text-slate-400">
                      {listedMessages.length} {listedMessages.length === 1 ? "match" : "matches"}
                    </span>
                  )}
                  <button type="button" onClick={() => setMessageSearchOpen(false)} className={iconButton} aria-label="Close search">
                    <X size={16} />
                  </button>
                </div>
              )}

              {pinned && pinnedDecoded && (
                <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5">
                  <Pin size={14} className="shrink-0 text-amber-700" />
                  <button
                    type="button"
                    onClick={() => jumpTo(pinned.id)}
                    className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-[13px] text-amber-900"
                  >
                    <span className="font-semibold">Pinned: </span>
                    {pinnedDecoded.state === "ok"
                      ? pinnedDecoded.envelope.text || pinnedDecoded.envelope.attachment?.name
                      : pinnedDecoded.state === "deleted"
                        ? "Deleted message"
                        : "Encrypted message"}
                  </button>
                  <button type="button" onClick={() => messageActions.onTogglePin(pinned.id)} className={iconButton} aria-label="Unpin">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Messages */}
              <div
                ref={paneRef}
                onScroll={(event) => {
                  const pane = event.currentTarget;
                  if (pane.scrollHeight - pane.scrollTop - pane.clientHeight < NEAR_BOTTOM_PX) setShowJump(false);
                }}
                className="chat-message-pane relative min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2 sm:px-6"
                style={{ backgroundColor: "var(--chat-app)" }}
                aria-live="polite"
                aria-relevant="additions"
              >
                <p className="mx-auto my-3 max-w-sm rounded-xl bg-white/80 px-3 py-2 text-center text-[11.5px] leading-relaxed text-slate-500 shadow-sm">
                  🔒 End-to-end encrypted. Messages disappear 3 days after they're sent.
                </p>
                {existing && loadingMessages ? (
                  <p className="text-center text-[13px] text-slate-400">Loading messages…</p>
                ) : listedMessages.length === 0 ? (
                  <p className="mt-8 text-center text-[13.5px] text-slate-500">
                    {searchTerm ? `Nothing in this chat matches “${searchTerm}”.` : "No messages yet. Say hello 👋"}
                  </p>
                ) : (
                  <MessageList
                    uid={uid}
                    isGroup={isGroup}
                    messages={listedMessages}
                    decoded={decoded}
                    participants={selected.participants}
                    readAt={selected.readAt}
                    nameOf={nameOf}
                    photoOf={photoOf}
                    firstUnreadId={searchTerm ? undefined : firstUnreadId}
                    pinnedMessageId={existing?.pinnedMessageId}
                    searchTerm={searchTerm}
                    jumpTo={jumpTo}
                    {...messageActions}
                  />
                )}
              </div>

              {showJump && (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="absolute bottom-24 right-5 z-20 flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[12.5px] font-semibold text-slate-700 shadow-lg"
                >
                  <ArrowDown size={15} /> New messages
                </button>
              )}

              <Composer
                draft={draft}
                onDraftChange={onDraftChange}
                onSend={() => void send()}
                disabled={!keys}
                sending={sending}
                placeholder={isGroup ? `Message ${title}` : `Message ${title.split(" ")[0] || ""}`.trim()}
                file={file}
                onFileChange={setFile}
                onFileRejected={(message) => notify(message, "error")}
                reply={
                  replyMessage
                    ? {
                        name: replyMessage.senderId === uid ? "yourself" : nameOf(replyMessage.senderId),
                        text:
                          replyDecoded?.state === "ok"
                            ? replyDecoded.envelope.text || `📎 ${replyDecoded.envelope.attachment?.name ?? "File"}`
                            : "Encrypted message",
                      }
                    : undefined
                }
                onCancelReply={() => setReplyToId(null)}
                editing={Boolean(editingId)}
                onCancelEdit={() => {
                  setEditingId(null);
                  setDraft("");
                }}
              />
            </div>
          )}

          {infoOpen && existing && (
            <InfoPanel
              uid={uid}
              conversation={existing}
              title={title}
              online={online}
              muted={isMuted(existing, uid)}
              profileOf={profileOf}
              onClose={() => setInfoOpen(false)}
              onToggleMute={() => void conversationMenu("mute")}
              onRename={async (next) => {
                await run(() => renameGroup(existing.id, next), "Couldn't rename the group.");
              }}
              onAddMembers={() => setPicker("add")}
              onRemoveMember={async (memberId) => {
                if (
                  await confirm({
                    title: `Remove ${nameOf(memberId)}?`,
                    body: "They won't see new messages in this group.",
                    confirmLabel: "Remove",
                    danger: true,
                  })
                ) {
                  await run(() => removeGroupMember(existing.id, memberId), "Couldn't remove that member.");
                }
              }}
              onLeave={async () => {
                if (await confirm({ title: `Leave “${title}”?`, confirmLabel: "Leave", danger: true })) {
                  if (await run(() => leaveGroup(existing.id, uid), "Couldn't leave the group.")) closeConversation();
                }
              }}
            />
          )}
        </section>
      )}

      {picker && (
        <PeoplePicker
          mode={picker}
          people={people}
          exclude={picker === "add" ? existing?.participants : undefined}
          onClose={() => setPicker(null)}
          onDirect={startDirect}
          onCreateGroup={createGroup}
          onAdd={async (memberIds) => {
            if (!existing) return;
            const ok = await run(
              () => addGroupMembers(existing.id, Object.fromEntries(memberIds.map((id) => [id, nameOf(id)]))),
              "Couldn't add those members.",
              memberIds.length === 1 ? `${nameOf(memberIds[0])} added.` : `${memberIds.length} members added.`,
            );
            if (ok) setPicker(null);
          }}
        />
      )}

      {emojiFor && (
        <div className="fixed inset-0 z-[2147482500] grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setEmojiFor(null)}>
          <div onMouseDown={(event) => event.stopPropagation()} className="overflow-hidden rounded-2xl shadow-2xl">
            <Suspense fallback={<div className="grid h-[400px] w-[320px] place-items-center bg-white text-[13px] text-slate-500">Loading…</div>}>
              <EmojiPicker
                onEmojiClick={(emoji) => {
                  messageActions.onReact(emojiFor, emoji.emoji);
                  setEmojiFor(null);
                }}
                width={320}
                height={400}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

const ChatWorkspace: React.FC<ChatWorkspaceProps> = (props) => (
  <ChatFeedbackProvider>
    <Workspace {...props} />
  </ChatFeedbackProvider>
);

export default ChatWorkspace;
