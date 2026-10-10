import { Users } from "lucide-react";
import React, { useState } from "react";

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const Avatar: React.FC<{
  name: string;
  photo?: string;
  size?: number;
  group?: boolean;
  online?: boolean;
}> = ({ name, photo, size = 40, group = false, online = false }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, minWidth: size };
  return (
    <span className="relative inline-block shrink-0" style={style}>
      {photo && !failed ? (
        <img
          src={photo}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-full w-full place-items-center rounded-full font-bold text-white"
          style={{
            background: group ? "var(--chat-accent)" : "linear-gradient(135deg, #64748b, #334155)",
            fontSize: Math.max(11, Math.round(size * 0.36)),
          }}
        >
          {group ? <Users size={Math.round(size * 0.45)} /> : initialsOf(name)}
        </span>
      )}
      {online && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-2 ring-white"
          style={{ width: Math.max(9, size * 0.26), height: Math.max(9, size * 0.26) }}
        />
      )}
    </span>
  );
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const DAY = 86_400_000;

export const formatClock = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/** "14:05", "Yesterday", "Mon", "12 Oct" — as conversation lists do. */
export const formatListTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);
  if (days <= 0) return formatClock(value);
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
};

/** "last seen today at 7:35 PM", "…yesterday at…", "…Mon at…", "…Jul 14". */
export const formatLastSeen = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);
  const clock = formatClock(value);
  if (days <= 0) return `last seen today at ${clock}`;
  if (days === 1) return `last seen yesterday at ${clock}`;
  if (days < 7) return `last seen ${date.toLocaleDateString([], { weekday: "short" })} at ${clock}`;
  return `last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
};

export const formatDayLabel = (value: string) => {
  const date = new Date(value);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
};

export const sameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));

export const iconButton =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--chat-accent)] disabled:opacity-40";
