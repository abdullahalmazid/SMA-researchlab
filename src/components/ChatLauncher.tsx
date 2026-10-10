import { MessageCircleMore } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useChatNotifications } from "../chat/useChatNotifications";
import { useAuth } from "../context/AuthContext";
import { useCollaborators } from "../firebase/hooks";

/** The floating messenger tab, plus site-wide unread tracking for chat members. */
const ChatLauncher: React.FC = () => {
  const { appUser } = useAuth();
  const allowed = appUser?.role === "collaborator" || appUser?.role === "lab_head";
  return allowed && appUser ? <Launcher uid={appUser.uid} /> : null;
};

const Launcher: React.FC<{ uid: string }> = ({ uid }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { collaborators } = useCollaborators();
  const names = useMemo(() => new Map(collaborators.map((c) => [c.uid, c.name] as const)), [collaborators]);
  const nameOf = useCallback((id: string) => names.get(id), [names]);
  const { unreadCount } = useChatNotifications(uid, nameOf);

  if (location.pathname === "/chat" || location.pathname.startsWith("/admin")) return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/chat")}
      className="group fixed right-0 top-1/2 z-[2147480000] flex -translate-y-1/2 items-center gap-2 rounded-l-2xl border border-r-0 border-white/20 bg-slate-950 px-3 py-4 text-white shadow-2xl transition hover:pr-5"
      aria-label={`Open team messenger${unreadCount ? `, ${unreadCount} unread ${unreadCount === 1 ? "chat" : "chats"}` : ""}`}
    >
      <MessageCircleMore size={21} />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-black opacity-0 transition-all group-hover:max-w-28 group-hover:opacity-100">
        Messenger
      </span>
      {unreadCount > 0 && (
        <span className="absolute -left-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black ring-2 ring-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default ChatLauncher;
