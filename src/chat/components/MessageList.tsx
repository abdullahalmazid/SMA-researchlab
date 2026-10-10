import {
  Check,
  CheckCheck,
  Clock3,
  Copy,
  Download,
  FileText,
  Lock,
  Pencil,
  Pin,
  PinOff,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { isImageAttachment, openAttachment } from "../attachments";
import { formatBytes } from "../../cloudinary";
import type { ChatAttachment, ChatMessage, MessageEnvelope } from "../types";
import RichText from "./RichText";
import { Avatar, formatClock, formatDayLabel, sameDay } from "./chatUi";

export type Decoded =
  | { state: "ok"; envelope: MessageEnvelope }
  | { state: "deleted" }
  /** Encrypted for a key this device doesn't hold. */
  | { state: "locked" }
  | { state: "decrypting" };

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "✅"];
const GROUP_WINDOW_MS = 5 * 60_000;

export interface MessageActions {
  onReply: (id: string) => void;
  onEdit: (id: string) => void;
  onCopy: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDeleteForMe: (id: string) => void;
  onDeleteForEveryone: (id: string) => void;
  onReact: (id: string, emoji: string | null) => void;
  onMoreReactions: (id: string) => void;
}

interface Props extends MessageActions {
  uid: string;
  isGroup: boolean;
  messages: ChatMessage[];
  decoded: Record<string, Decoded>;
  participants: string[];
  readAt: Record<string, string>;
  nameOf: (uid: string) => string;
  photoOf: (uid: string) => string | undefined;
  firstUnreadId?: string;
  pinnedMessageId?: string;
  searchTerm: string;
  jumpTo: (id: string) => void;
}

const ms = (value?: string) => (value ? Date.parse(value) || 0 : 0);

const MessageList: React.FC<Props> = (props) => {
  const { uid, isGroup, messages, decoded, firstUnreadId } = props;
  const [activeId, setActiveId] = useState<string | null>(null);

  if (messages.length === 0) return null;

  return (
    <ol className="m-0 list-none p-0" onMouseLeave={() => setActiveId(null)}>
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const newDay = !previous || !sameDay(previous.createdAt, message.createdAt);
        const joinsPrevious =
          !newDay &&
          previous?.senderId === message.senderId &&
          ms(message.createdAt) - ms(previous.createdAt) < GROUP_WINDOW_MS &&
          message.id !== firstUnreadId;
        const joinsNext =
          next !== undefined &&
          next.senderId === message.senderId &&
          sameDay(next.createdAt, message.createdAt) &&
          ms(next.createdAt) - ms(message.createdAt) < GROUP_WINDOW_MS &&
          next.id !== firstUnreadId;

        return (
          <React.Fragment key={message.id}>
            {newDay && (
              <li className="sticky top-1 z-10 flex justify-center py-2" aria-label={formatDayLabel(message.createdAt)}>
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11.5px] font-semibold text-slate-500 shadow-sm backdrop-blur">
                  {formatDayLabel(message.createdAt)}
                </span>
              </li>
            )}
            {message.id === firstUnreadId && (
              <li className="my-2 flex items-center gap-3" aria-label="New messages">
                <span className="h-px flex-1" style={{ background: "var(--chat-accent)", opacity: 0.4 }} />
                <span className="text-[11.5px] font-semibold" style={{ color: "var(--chat-accent)" }}>
                  New messages
                </span>
                <span className="h-px flex-1" style={{ background: "var(--chat-accent)", opacity: 0.4 }} />
              </li>
            )}
            <MessageRow
              {...props}
              message={message}
              mine={message.senderId === uid}
              decodedValue={decoded[message.id] ?? { state: "decrypting" }}
              showSender={isGroup && message.senderId !== uid && !joinsPrevious}
              showAvatar={isGroup && message.senderId !== uid && !joinsNext}
              compactTop={joinsPrevious}
              active={activeId === message.id}
              onActivate={() => setActiveId((current) => (current === message.id ? null : message.id))}
            />
          </React.Fragment>
        );
      })}
    </ol>
  );
};

const MessageRow: React.FC<
  Props & {
    message: ChatMessage;
    mine: boolean;
    decodedValue: Decoded;
    showSender: boolean;
    showAvatar: boolean;
    compactTop: boolean;
    active: boolean;
    onActivate: () => void;
  }
> = (props) => {
  const {
    uid,
    isGroup,
    message,
    mine,
    decodedValue,
    showSender,
    showAvatar,
    compactTop,
    active,
    onActivate,
    nameOf,
    photoOf,
    decoded,
    pinnedMessageId,
    searchTerm,
    jumpTo,
  } = props;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleted = decodedValue.state === "deleted";
  const envelope = decodedValue.state === "ok" ? decodedValue.envelope : undefined;
  const replied = message.replyToMessageId ? props.messages.find((m) => m.id === message.replyToMessageId) : undefined;
  const repliedDecoded = replied ? decoded[replied.id] : undefined;
  const repliedText =
    !message.replyToMessageId
      ? ""
      : !replied
        ? "Original message unavailable"
        : repliedDecoded?.state === "ok"
          ? repliedDecoded.envelope.text || (repliedDecoded.envelope.attachment ? `📎 ${repliedDecoded.envelope.attachment.name}` : "")
          : repliedDecoded?.state === "deleted"
            ? "Deleted message"
            : "Encrypted message";

  const reactionCounts = Object.values(message.reactions).reduce<Record<string, number>>((acc, emoji) => {
    acc[emoji] = (acc[emoji] ?? 0) + 1;
    return acc;
  }, {});
  const myReaction = message.reactions[uid];

  return (
    <li
      id={`msg-${message.id}`}
      className={`group/msg relative flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${compactTop ? "mt-0.5" : "mt-3"}`}
    >
      {isGroup && !mine && (
        <span className="w-8 shrink-0">{showAvatar && <Avatar name={nameOf(message.senderId)} photo={photoOf(message.senderId)} size={32} />}</span>
      )}

      <div className={`flex max-w-[min(78%,620px)] flex-col ${mine ? "items-end" : "items-start"}`}>
        <div
          className={`chat-message-bubble relative rounded-2xl px-3 py-2 text-[14px] leading-relaxed shadow-sm ${
            mine ? (compactTop ? "rounded-tr-md" : "") : compactTop ? "rounded-tl-md" : ""
          } ${message.id === pinnedMessageId ? "ring-2 ring-amber-300" : ""}`}
          style={{
            background: mine ? "var(--chat-outgoing)" : "var(--chat-incoming)",
            color: "var(--chat-text)",
            border: mine ? "none" : "1px solid var(--chat-border)",
          }}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a,button")) return;
            onActivate();
          }}
        >
          {showSender && (
            <p className="m-0 mb-0.5 text-[12px] font-semibold" style={{ color: "var(--chat-accent)" }}>
              {nameOf(message.senderId)}
            </p>
          )}

          {message.replyToMessageId && !deleted && (
            <button
              type="button"
              onClick={() => replied && jumpTo(replied.id)}
              className="mb-1.5 block w-full rounded-lg border-0 border-l-[3px] bg-black/5 px-2 py-1 text-left"
              style={{ borderLeftColor: "var(--chat-accent)" }}
            >
              <span className="block text-[11.5px] font-semibold" style={{ color: "var(--chat-accent)" }}>
                {replied ? (replied.senderId === uid ? "You" : nameOf(replied.senderId)) : "Reply"}
              </span>
              <span className="block truncate text-[12.5px] opacity-80">{repliedText}</span>
            </button>
          )}

          {deleted ? (
            <p className="m-0 italic opacity-60">This message was deleted</p>
          ) : decodedValue.state === "locked" ? (
            <p className="m-0 flex items-center gap-1.5 italic opacity-60" title="Encrypted for a different key than the one on this device">
              <Lock size={13} /> Can't be read on this device
            </p>
          ) : decodedValue.state === "decrypting" ? (
            <p className="m-0 opacity-50">…</p>
          ) : (
            <>
              {envelope?.attachment && <AttachmentView attachment={envelope.attachment} />}
              {envelope?.text && (
                <div className={envelope.attachment ? "mt-1.5" : undefined}>
                  <RichText text={envelope.text} highlightTerm={searchTerm} />
                </div>
              )}
            </>
          )}

          <span className="ml-3 inline-flex translate-y-1 items-center gap-1 whitespace-nowrap align-bottom text-[10.5px] opacity-60" style={{ float: "right" }}>
            {message.editedAt && !deleted && <span>edited</span>}
            {formatClock(message.createdAt)}
            {mine && !deleted && <Receipt {...props} />}
          </span>
        </div>

        {Object.keys(reactionCounts).length > 0 && (
          <div className={`-mt-1.5 flex flex-wrap gap-1 ${mine ? "mr-2 justify-end" : "ml-2"}`}>
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => props.onReact(message.id, myReaction === emoji ? null : emoji)}
                className={`relative z-[1] flex h-6 items-center gap-1 rounded-full border px-1.5 text-[12px] shadow-sm ${
                  myReaction === emoji ? "" : "border-slate-200 bg-white"
                }`}
                style={myReaction === emoji ? { borderColor: "var(--chat-accent)", background: "var(--chat-surface)" } : undefined}
                aria-label={`${emoji} ${count}${myReaction === emoji ? ", your reaction — tap to remove" : ""}`}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="font-semibold text-slate-500">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!deleted && decodedValue.state !== "decrypting" && (
        <div
          className={`absolute -top-8 z-20 items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1 py-0.5 shadow-md ${
            mine ? "right-2" : isGroup ? "left-12" : "left-2"
          } ${active ? "flex" : "hidden group-hover/msg:flex"}`}
          role="toolbar"
          aria-label="Message actions"
        >
          {confirmingDelete ? (
            <>
              <ToolbarButton label="Delete for me" onClick={() => props.onDeleteForMe(message.id)} text="For me" />
              {mine && (
                <ToolbarButton label="Delete for everyone" onClick={() => props.onDeleteForEveryone(message.id)} text="For everyone" danger />
              )}
              <ToolbarButton label="Cancel" onClick={() => setConfirmingDelete(false)} text="Cancel" />
            </>
          ) : (
            <>
              {decodedValue.state === "ok" &&
                QUICK_REACTIONS.slice(0, 4).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => props.onReact(message.id, myReaction === emoji ? null : emoji)}
                    className={`grid h-7 w-7 place-items-center rounded-full border-0 text-[15px] hover:bg-slate-100 ${myReaction === emoji ? "bg-slate-100" : "bg-transparent"}`}
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              {decodedValue.state === "ok" && (
                <ToolbarButton label="More reactions" onClick={() => props.onMoreReactions(message.id)} icon={<SmilePlus size={15} />} />
              )}
              {decodedValue.state === "ok" && (
                <ToolbarButton label="Reply" onClick={() => props.onReply(message.id)} icon={<Reply size={15} />} />
              )}
              {envelope?.text && <ToolbarButton label="Copy text" onClick={() => props.onCopy(message.id)} icon={<Copy size={14} />} />}
              {mine && envelope && !envelope.attachment && (
                <ToolbarButton label="Edit" onClick={() => props.onEdit(message.id)} icon={<Pencil size={14} />} />
              )}
              <ToolbarButton
                label={message.id === pinnedMessageId ? "Unpin" : "Pin"}
                onClick={() => props.onTogglePin(message.id)}
                icon={message.id === pinnedMessageId ? <PinOff size={14} /> : <Pin size={14} />}
              />
              <ToolbarButton label="Delete" onClick={() => setConfirmingDelete(true)} icon={<Trash2 size={14} />} />
            </>
          )}
        </div>
      )}
    </li>
  );
};

const ToolbarButton: React.FC<{
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  text?: string;
  danger?: boolean;
}> = ({ label, onClick, icon, text, danger }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`flex h-7 items-center justify-center rounded-full border-0 bg-transparent text-[12px] font-semibold hover:bg-slate-100 ${
      text ? "px-2.5" : "w-7"
    } ${danger ? "text-rose-600" : "text-slate-600"}`}
  >
    {icon ?? text}
  </button>
);

/** Clock while sending, one tick when stored, two (accent) once read. */
const Receipt: React.FC<Props & { message: ChatMessage }> = ({ message, uid, participants, readAt, isGroup }) => {
  if (message.pending) return <Clock3 size={12} aria-label="Sending" />;
  const others = participants.filter((p) => p !== uid);
  const readers = others.filter((p) => ms(readAt[p]) >= ms(message.createdAt));
  const readByAll = (others.length > 0 && readers.length === others.length) || Boolean(message.readAt);
  const label = isGroup ? `Read by ${readers.length} of ${others.length}` : readByAll ? "Read" : "Sent";
  return readByAll ? (
    <CheckCheck size={14} aria-label={label} style={{ color: "var(--chat-accent)", opacity: 1 }} />
  ) : readers.length > 0 ? (
    <CheckCheck size={14} aria-label={label} />
  ) : (
    <Check size={13} aria-label={label} />
  );
};

const AttachmentView: React.FC<{ attachment: ChatAttachment }> = ({ attachment }) => {
  const image = isImageAttachment(attachment);
  const [url, setUrl] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const holderRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (url || loading) return url;
    setLoading(true);
    setError("");
    try {
      const objectUrl = await openAttachment(attachment);
      setUrl(objectUrl);
      return objectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open this file.");
      return "";
    } finally {
      setLoading(false);
    }
  };

  /* Images decrypt when they scroll into view, not all at once. */
  useEffect(() => {
    if (!image || !holderRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        void load();
      }
    });
    observer.observe(holderRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, attachment.url]);

  const download = async () => {
    const objectUrl = await load();
    if (!objectUrl) return;
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = attachment.name;
    link.click();
  };

  if (image) {
    return (
      <div ref={holderRef} className="overflow-hidden rounded-xl bg-black/5">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${attachment.name}`}>
            <img src={url} alt={attachment.name} className="max-h-80 w-auto max-w-full object-contain" />
          </a>
        ) : (
          <div className="grid h-40 w-60 max-w-full place-items-center text-[12px] opacity-60">
            {error || "Decrypting image…"}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void download()}
      className="flex w-64 max-w-full items-center gap-3 rounded-xl border-0 bg-black/5 px-3 py-2.5 text-left hover:bg-black/10"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: "var(--chat-accent)" }}>
        <FileText size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{attachment.name}</span>
        <span className="block text-[11.5px] opacity-60">
          {error || (loading ? "Decrypting…" : formatBytes(attachment.size))}
        </span>
      </span>
      <Download size={16} className="shrink-0 opacity-60" />
    </button>
  );
};

export default MessageList;
