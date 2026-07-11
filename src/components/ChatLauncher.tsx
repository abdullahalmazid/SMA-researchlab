import { MessageCircleMore } from "lucide-react";
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePrivateConversations } from "../chat/hooks";
import { useAuth } from "../context/AuthContext";

const ChatLauncher: React.FC = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const allowed = appUser?.role === "collaborator" || appUser?.role === "lab_head";
  const { conversations } = usePrivateConversations(allowed ? appUser?.uid : undefined);
  if (!allowed || location.pathname === "/chat" || location.pathname.startsWith("/admin")) return null;
  const unread = conversations.reduce((sum, conversation) => sum + Number(conversation.unreadCounts?.[appUser?.uid || ""] || 0), 0);
  return <button type="button" onClick={() => navigate("/chat")} className="group fixed right-0 top-1/2 z-[2147480000] flex -translate-y-1/2 items-center gap-2 rounded-l-2xl border border-r-0 border-white/20 bg-slate-950 px-3 py-4 text-white shadow-2xl transition hover:pr-5" aria-label={`Open team messenger${unread ? `, ${unread} unread` : ""}`}><MessageCircleMore size={21} /><span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-black opacity-0 transition-all group-hover:max-w-28 group-hover:opacity-100">Messenger</span>{unread > 0 && <span className="absolute -left-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black ring-2 ring-white">{unread > 99 ? "99+" : unread}</span>}</button>;
};
export default ChatLauncher;
