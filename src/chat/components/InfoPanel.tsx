import { Bell, BellOff, LogOut, Pencil, UserMinus, UserPlus, X } from "lucide-react";
import { PersonLink } from "../../components/PersonDrawer";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { CollaboratorProfile } from "../../types";
import { CHAT_TTL_HOURS } from "../service";
import type { ChatConversation } from "../types";
import { Avatar, iconButton } from "./chatUi";

const rowButton =
  "flex w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50";

const InfoPanel: React.FC<{
  uid: string;
  conversation: ChatConversation;
  title: string;
  online: boolean;
  muted: boolean;
  profileOf: (uid: string) => CollaboratorProfile | undefined;
  onClose: () => void;
  onToggleMute: () => void;
  onRename: (title: string) => Promise<void>;
  onAddMembers: () => void;
  onRemoveMember: (uid: string) => void;
  onLeave: () => void;
}> = ({
  uid,
  conversation,
  title,
  online,
  muted,
  profileOf,
  onClose,
  onToggleMute,
  onRename,
  onAddMembers,
  onRemoveMember,
  onLeave,
}) => {
  const isGroup = conversation.type === "group";
  const isAdmin = isGroup && conversation.admins.includes(uid);
  const other = isGroup ? undefined : conversation.participants.find((p) => p !== uid);
  const person = other ? profileOf(other) : undefined;
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  const saveTitle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draftTitle.trim()) return;
    await onRename(draftTitle);
    setRenaming(false);
  };

  return (
    <aside
      aria-label="Conversation details"
      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[340px] flex-col border-l border-slate-200 bg-white shadow-2xl xl:static xl:shadow-none"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="m-0 flex-1 text-[15px] font-bold text-slate-900">{isGroup ? "Group info" : "Contact info"}</h2>
        <button type="button" onClick={onClose} className={iconButton} aria-label="Close details">
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-5 pb-5 pt-6 text-center">
          <Avatar name={title} photo={person?.photo} size={84} group={isGroup} />
          {renaming ? (
            <form onSubmit={saveTitle} className="mt-4 flex w-full gap-2">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value.slice(0, 80))}
                aria-label="Group name"
                autoFocus
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none focus:ring-4 focus:ring-slate-100"
              />
              <button type="submit" className="h-9 rounded-lg border-0 px-3 text-[13px] font-semibold text-white" style={{ background: "var(--chat-accent)" }}>
                Save
              </button>
            </form>
          ) : (
            <h3 className="m-0 mt-4 flex items-center gap-1.5 text-[18px] font-bold text-slate-900">
              {title}
              {isAdmin && (
                <button type="button" onClick={() => setRenaming(true)} className={iconButton} aria-label="Rename group">
                  <Pencil size={14} />
                </button>
              )}
            </h3>
          )}
          <p className="m-0 mt-1 text-[13px] text-slate-500">
            {isGroup
              ? `${conversation.participants.length} members`
              : [person?.designation, online ? "online" : null].filter(Boolean).join(" · ") || "Collaborator"}
          </p>
          {person?.affiliation && <p className="m-0 mt-0.5 text-[12.5px] text-slate-400">{person.affiliation}</p>}
        </div>

        {person?.bio && (
          <p className="m-0 border-t border-slate-100 px-5 py-4 text-[13.5px] leading-relaxed text-slate-600">{person.bio}</p>
        )}
        {person && (person.researchInterests?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pb-4">
            {person.researchInterests.slice(0, 8).map((interest) => (
              <span key={interest} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-medium text-slate-600">
                {interest}
              </span>
            ))}
          </div>
        )}
        {person && other && (
          <div className="px-4 pb-3">
            <PersonLink
              uid={other}
              className="block rounded-xl border border-slate-200 px-3 py-2.5 text-center text-[13px] font-semibold text-slate-700 no-underline hover:bg-slate-50"
            >
              View full profile
            </PersonLink>
          </div>
        )}

        <div className="border-t border-slate-100 p-2">
          <button type="button" onClick={onToggleMute} className={rowButton}>
            {muted ? <Bell size={17} /> : <BellOff size={17} />}
            {muted ? "Unmute notifications" : "Mute notifications"}
          </button>
          <p className="m-0 px-3 pb-2 pt-1 text-[12px] leading-relaxed text-slate-400">
            Messages are end-to-end encrypted and disappear {CHAT_TTL_HOURS / 24} days after they're sent.
          </p>
        </div>

        {isGroup && (
          <div className="border-t border-slate-100 p-2">
            <p className="m-0 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Members</p>
            {isAdmin && (
              <button type="button" onClick={onAddMembers} className={rowButton}>
                <UserPlus size={17} /> Add members
              </button>
            )}
            <ul className="m-0 list-none p-0">
              {conversation.participants.map((memberId) => {
                const member = profileOf(memberId);
                const name = member?.name || conversation.participantNames[memberId] || "Former collaborator";
                return (
                  <li key={memberId} className="group/member flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50">
                    <Avatar name={name} photo={member?.photo} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-slate-900">
                        {name}
                        {memberId === uid && <span className="font-normal text-slate-400"> (you)</span>}
                      </span>
                      {conversation.admins.includes(memberId) && (
                        <span className="text-[11.5px] font-medium" style={{ color: "var(--chat-accent)" }}>
                          Group admin
                        </span>
                      )}
                    </span>
                    {isAdmin && memberId !== uid && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(memberId)}
                        className={`${iconButton} opacity-100 sm:opacity-0 sm:group-hover/member:opacity-100`}
                        aria-label={`Remove ${name}`}
                      >
                        <UserMinus size={15} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={onLeave}
              className="mt-1 flex w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left text-[13.5px] font-semibold text-rose-600 hover:bg-rose-50"
            >
              <LogOut size={17} /> Leave group
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default InfoPanel;
