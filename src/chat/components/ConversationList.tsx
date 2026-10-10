import { ArrowLeft, BellOff, LockKeyhole, MessageCircle, PenSquare, Search, Settings2, X } from "lucide-react";
import React, { useMemo } from "react";
import type { CollaboratorProfile } from "../../types";
import { conversationTitle, isConversationUnread, isMuted, isTypingFresh } from "../envelope";
import type { ChatConversation } from "../types";
import { Avatar, formatListTime, iconButton } from "./chatUi";

interface Props {
  uid: string;
  conversations: ChatConversation[];
  loading: boolean;
  selectedId?: string;
  previews: Record<string, string>;
  collaborators: CollaboratorProfile[];
  profileOf: (uid: string) => CollaboratorProfile | undefined;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (conversationId: string) => void;
  onStartDirect: (uid: string) => void;
  onNewChat: () => void;
  me: { name: string; photo?: string };
  brand?: { title?: string; logoUrl?: string };
  onBack?: () => void;
  onOpenSettings?: () => void;
  /** Shown above the identity footer, e.g. "your key isn't backed up". */
  notice?: React.ReactNode;
}

const ConversationList: React.FC<Props> = ({
  uid,
  conversations,
  loading,
  selectedId,
  previews,
  collaborators,
  profileOf,
  search,
  onSearch,
  onSelect,
  onStartDirect,
  onNewChat,
  me,
  brand,
  onBack,
  onOpenSettings,
  notice,
}) => {
  const term = search.trim().toLowerCase();
  const nameOf = (id: string) => profileOf(id)?.name;

  const matchingConversations = useMemo(
    () =>
      term
        ? conversations.filter((c) =>
            conversationTitle(c, uid, (id) => profileOf(id)?.name).toLowerCase().includes(term),
          )
        : conversations,
    [conversations, term, uid, profileOf],
  );

  /** When searching, also offer people you haven't messaged yet. */
  const matchingPeople = useMemo(() => {
    if (!term) return [];
    const withDirect = new Set(
      conversations.filter((c) => c.type === "direct").flatMap((c) => c.participants),
    );
    return collaborators.filter(
      (person) =>
        person.uid !== uid &&
        !withDirect.has(person.uid) &&
        [person.name, person.email, person.affiliation, person.designation]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
    );
  }, [collaborators, conversations, term, uid]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Same height as the conversation header, so the two read as one bar. */}
      <div className="flex h-16 shrink-0 items-center gap-1.5 border-b border-slate-200 px-2.5">
        {onBack && (
          <button type="button" onClick={onBack} className={iconButton} aria-label="Back to website" title="Back to website">
            <ArrowLeft size={18} />
          </button>
        )}
        <span
          className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg text-white"
          style={{ background: brand?.logoUrl ? "#fff" : "var(--chat-accent)" }}
        >
          {brand?.logoUrl ? (
            <img src={brand.logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <MessageCircle size={17} />
          )}
        </span>
        <div className="ml-1 min-w-0 flex-1">
          <h2 className="m-0 truncate text-[15px] font-bold leading-tight text-slate-900">Messenger</h2>
          {brand?.title && <p className="m-0 truncate text-[11.5px] leading-tight text-slate-400">{brand.title}</p>}
        </div>
        {onOpenSettings && (
          <button type="button" onClick={onOpenSettings} className={iconButton} aria-label="Chat settings" title="Chat settings">
            <Settings2 size={18} />
          </button>
        )}
        <button type="button" onClick={onNewChat} className={iconButton} aria-label="New chat or group" title="New chat or group">
          <PenSquare size={18} />
        </button>
      </div>

      <div className="px-3 pb-2 pt-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search chats and people"
            aria-label="Search chats and people"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-[13.5px] text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-100 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md border-0 bg-transparent text-slate-400 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="grid gap-1 px-1 pt-1" aria-busy="true" aria-label="Loading chats">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
                <span className="h-11 w-11 animate-pulse rounded-full bg-slate-100" />
                <span className="grid flex-1 gap-2">
                  <span className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                  <span className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {matchingConversations.length === 0 && matchingPeople.length === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="m-0 text-[14px] font-semibold text-slate-700">
                  {term ? "No chats or people match" : "No conversations yet"}
                </p>
                {!term && (
                  <button
                    type="button"
                    onClick={onNewChat}
                    className="mt-3 h-9 rounded-lg border-0 px-3.5 text-[13px] font-semibold text-white"
                    style={{ background: "var(--chat-accent)" }}
                  >
                    Start a conversation
                  </button>
                )}
              </div>
            )}

            <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label="Conversations">
              {matchingConversations.map((conversation) => {
                const other = conversation.participants.find((p) => p !== uid);
                const profile = other ? profileOf(other) : undefined;
                const title = conversationTitle(conversation, uid, nameOf);
                const unread = isConversationUnread(conversation, uid);
                const muted = isMuted(conversation, uid);
                const typingUid = Object.entries(conversation.typingBy).find(
                  ([id, at]) => id !== uid && isTypingFresh(at),
                )?.[0];
                const preview = typingUid
                  ? conversation.type === "group"
                    ? `${(nameOf(typingUid) ?? "Someone").split(" ")[0]} is typing…`
                    : "typing…"
                  : previews[conversation.id] ?? "";
                const active = conversation.id === selectedId;

                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl border-0 p-2.5 text-left transition ${
                        active ? "bg-slate-100" : "bg-transparent hover:bg-slate-50"
                      }`}
                    >
                      <Avatar name={title} photo={profile?.photo} size={44} group={conversation.type === "group"} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={`min-w-0 flex-1 truncate text-[14px] text-slate-900 ${unread ? "font-bold" : "font-semibold"}`}>
                            {title}
                          </span>
                          <span
                            className={`shrink-0 text-[11.5px] ${unread && !muted ? "font-semibold" : "text-slate-400"}`}
                            style={unread && !muted ? { color: "var(--chat-accent)" } : undefined}
                          >
                            {formatListTime(conversation.lastMessageAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span
                            className={`min-w-0 flex-1 truncate text-[13px] ${unread ? "font-medium text-slate-700" : "text-slate-500"}`}
                            style={typingUid ? { color: "var(--chat-accent)" } : undefined}
                          >
                            {preview || (conversation.lastMessageAt ? "Message" : "No messages yet")}
                          </span>
                          {muted && <BellOff size={13} className="shrink-0 text-slate-400" aria-label="Muted" />}
                          {unread && (
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: muted ? "#94a3b8" : "var(--chat-accent)" }}
                              aria-label="Unread"
                            />
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {matchingPeople.length > 0 && (
              <>
                <p className="m-0 px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  People
                </p>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label="People">
                  {matchingPeople.map((person) => (
                    <li key={person.uid}>
                      <button
                        type="button"
                        onClick={() => onStartDirect(person.uid)}
                        className="flex w-full items-center gap-3 rounded-xl border-0 bg-transparent p-2.5 text-left hover:bg-slate-50"
                      >
                        <Avatar name={person.name} photo={person.photo} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-slate-900">{person.name}</span>
                          <span className="block truncate text-[12.5px] text-slate-500">
                            {person.designation || person.affiliation || "Collaborator"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {notice}
      <div className="flex shrink-0 items-center gap-2.5 border-t border-slate-200 px-3.5 py-2.5">
        <Avatar name={me.name} photo={me.photo} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-slate-800">{me.name}</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <LockKeyhole size={10} /> End-to-end encrypted
          </span>
        </span>
      </div>
    </div>
  );
};

export default ConversationList;
