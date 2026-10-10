import { Check, Search, Users, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type { CollaboratorProfile } from "../../types";
import { MAX_GROUP_MEMBERS } from "../service";
import { Avatar, iconButton } from "./chatUi";

type Mode = "new" | "add";

/**
 * "new": start a direct chat with one tap, or switch to group mode and pick
 * several people plus a name. "add": pick people to add to an existing group.
 */
const PeoplePicker: React.FC<{
  mode: Mode;
  people: CollaboratorProfile[];
  /** Already in the group (add mode). */
  exclude?: string[];
  onClose: () => void;
  onDirect?: (uid: string) => void;
  onCreateGroup?: (title: string, memberIds: string[]) => Promise<void>;
  onAdd?: (memberIds: string[]) => Promise<void>;
}> = ({ mode, people, exclude = [], onClose, onDirect, onCreateGroup, onAdd }) => {
  const [grouping, setGrouping] = useState(mode === "add");
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const term = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      people.filter(
        (person) =>
          !exclude.includes(person.uid) &&
          (!term ||
            [person.name, person.email, person.affiliation, person.designation]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(term)),
      ),
    [people, exclude, term],
  );

  const limit = mode === "add" ? MAX_GROUP_MEMBERS - exclude.length : MAX_GROUP_MEMBERS - 1;
  const toggle = (uid: string) =>
    setSelected((current) =>
      current.includes(uid) ? current.filter((id) => id !== uid) : current.length >= limit ? current : [...current, uid],
    );

  const canSubmit = mode === "add" ? selected.length > 0 : selected.length > 0 && title.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (mode === "add") await onAdd?.(selected);
      else await onCreateGroup?.(title, selected);
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === "add" ? "Add members" : grouping ? "New group" : "New chat";

  return (
    <div
      className="fixed inset-0 z-[2147482500] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="flex max-h-[min(640px,90vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="m-0 flex-1 text-[16px] font-bold text-slate-900">{heading}</h2>
          <button type="button" onClick={onClose} className={iconButton} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-2 px-4 pt-3">
          {grouping && mode === "new" && (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 80))}
              placeholder="Group name, e.g. Supply-chain project"
              aria-label="Group name"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none focus:ring-4 focus:ring-slate-100"
              autoFocus
            />
          )}
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13.5px] text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100"
              autoFocus={!grouping}
            />
          </div>
          {mode === "new" && !grouping && (
            <button
              type="button"
              onClick={() => setGrouping(true)}
              className="flex items-center gap-3 rounded-xl border-0 bg-transparent p-2 text-left hover:bg-slate-50"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: "var(--chat-accent)" }}>
                <Users size={18} />
              </span>
              <span className="text-[14px] font-semibold text-slate-900">New group</span>
            </button>
          )}
          {grouping && (
            <p className="m-0 text-[12px] text-slate-400">
              {selected.length} selected · up to {MAX_GROUP_MEMBERS} members per group
            </p>
          )}
        </div>

        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-2">
          {visible.length === 0 && <li className="px-3 py-8 text-center text-[13.5px] text-slate-500">No one matches.</li>}
          {visible.map((person) => {
            const checked = selected.includes(person.uid);
            return (
              <li key={person.uid}>
                <button
                  type="button"
                  onClick={() => (grouping ? toggle(person.uid) : onDirect?.(person.uid))}
                  aria-pressed={grouping ? checked : undefined}
                  className="flex w-full items-center gap-3 rounded-xl border-0 bg-transparent p-2 text-left hover:bg-slate-50"
                >
                  <Avatar name={person.name} photo={person.photo} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-slate-900">{person.name}</span>
                    <span className="block truncate text-[12.5px] text-slate-500">
                      {person.designation || person.affiliation || "Collaborator"}
                    </span>
                  </span>
                  {grouping && (
                    <span
                      aria-hidden="true"
                      className={`grid h-5 w-5 place-items-center rounded-md border ${checked ? "border-transparent text-white" : "border-slate-300"}`}
                      style={checked ? { background: "var(--chat-accent)" } : undefined}
                    >
                      {checked && <Check size={13} strokeWidth={3} />}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {grouping && (
          <div className="border-t border-slate-200 p-3">
            <button
              type="button"
              disabled={!canSubmit || busy}
              onClick={() => void submit()}
              className="h-10 w-full rounded-xl border-0 text-[14px] font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--chat-accent)" }}
            >
              {busy ? "Working…" : mode === "add" ? `Add ${selected.length || ""}`.trim() : "Create group"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PeoplePicker;
