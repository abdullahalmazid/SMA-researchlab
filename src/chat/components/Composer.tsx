import { FileText, Paperclip, Pencil, Reply, SendHorizontal, X } from "lucide-react";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { attachmentsAvailable, MAX_ATTACHMENT_BYTES } from "../attachments";
import { formatBytes } from "../../cloudinary";
import { iconButton } from "./chatUi";

export const MAX_MESSAGE_LENGTH = 4000;

interface Props {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  sending: boolean;
  placeholder: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onFileRejected: (message: string) => void;
  reply?: { name: string; text: string };
  onCancelReply: () => void;
  editing: boolean;
  onCancelEdit: () => void;
}

const Composer: React.FC<Props> = ({
  draft,
  onDraftChange,
  onSend,
  disabled,
  sending,
  placeholder,
  file,
  onFileChange,
  onFileRejected,
  reply,
  onCancelReply,
  editing,
  onCancelEdit,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Grow with the text up to ~6 lines, then scroll. */
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    if ((reply || editing) && !disabled) textareaRef.current?.focus();
  }, [reply, editing, disabled]);

  const pickFile = (picked: File | undefined | null) => {
    if (!picked) return;
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      onFileRejected(`“${picked.name}” is ${formatBytes(picked.size)} — files can be up to 15 MB.`);
      return;
    }
    onFileChange(picked);
  };

  const canSend = !disabled && !sending && (draft.trim().length > 0 || Boolean(file)) && draft.length <= MAX_MESSAGE_LENGTH;

  return (
    <div
      className="border-t border-slate-200 bg-white px-3 pb-3 pt-2"
      onDragOver={(event) => {
        if (attachmentsAvailable && !editing && event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!attachmentsAvailable || editing) return;
        event.preventDefault();
        pickFile(event.dataTransfer.files?.[0]);
      }}
    >
      {(reply || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <span style={{ color: "var(--chat-accent)" }}>{editing ? <Pencil size={15} /> : <Reply size={15} />}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold" style={{ color: "var(--chat-accent)" }}>
              {editing ? "Editing message" : `Replying to ${reply?.name}`}
            </span>
            {reply && !editing && <span className="block truncate text-[12.5px] text-slate-500">{reply.text}</span>}
          </span>
          <button
            type="button"
            onClick={editing ? onCancelEdit : onCancelReply}
            className={iconButton}
            aria-label={editing ? "Cancel editing" : "Cancel reply"}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {file && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: "var(--chat-accent)" }}>
            <FileText size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-slate-800">{file.name}</span>
            <span className="block text-[11.5px] text-slate-500">
              {formatBytes(file.size)} · encrypted before upload
            </span>
          </span>
          <button type="button" onClick={() => onFileChange(null)} className={iconButton} aria-label="Remove attachment">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        {attachmentsAvailable && !editing && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                pickFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className={`${iconButton} mb-0.5 h-10 w-10`}
              aria-label="Attach a file"
              title="Attach a file (up to 15 MB)"
            >
              <Paperclip size={19} />
            </button>
          </>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          disabled={disabled}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSend();
            }
            if (event.key === "Escape") {
              if (editing) onCancelEdit();
              else if (reply) onCancelReply();
            }
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.files?.[0];
            if (pasted && attachmentsAvailable && !editing) {
              event.preventDefault();
              pickFile(pasted);
            }
          }}
          placeholder={placeholder}
          aria-label="Message"
          className="min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14px] leading-snug text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
        />

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border-0 text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--chat-accent)" }}
          aria-label={editing ? "Save edit" : "Send message"}
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <SendHorizontal size={18} />
          )}
        </button>
      </div>

      {draft.length > MAX_MESSAGE_LENGTH * 0.9 && (
        <p className={`m-0 mt-1 text-right text-[11px] ${draft.length > MAX_MESSAGE_LENGTH ? "text-rose-600" : "text-slate-400"}`}>
          {draft.length} / {MAX_MESSAGE_LENGTH}
        </p>
      )}
    </div>
  );
};

export default Composer;
