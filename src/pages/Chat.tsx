import { ArrowLeft, LockKeyhole, MessageCircleMore, Palette } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatWorkspace } from "../chat";
import { useAuth } from "../context/AuthContext";
import { useSiteContent } from "../firebase/hooks";
import { useCollaborators } from "../firebase/hooks";
import ChatSettingsDrawer from "../chat/components/ChatSettingsDrawer";
import { ChatThemeProvider, useChatTheme } from "../chat/theme/ChatThemeProvider";

const ChatContent: React.FC = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const { content } = useSiteContent();
  const logoUrl = content["branding.logoUrl"] ?? "";
  const { collaborators } = useCollaborators();
  const currentProfile = collaborators.find((profile) => profile.uid === appUser?.uid);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { appearance, tokens } = useChatTheme();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const backToWebsite = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  };

  return (
    <div className={`chat-app-theme fixed inset-0 z-[2147482000] flex min-h-0 flex-col ${appearance.density === "compact" ? "chat-density-compact" : ""} ${appearance.pattern ? "chat-pattern-enabled" : ""} ${appearance.reduceMotion ? "chat-reduce-motion" : ""}`} style={{ background: tokens.app, color: tokens.text, ["--chat-app" as string]:tokens.app, ["--chat-surface" as string]:tokens.surface, ["--chat-surface-alt" as string]:tokens.surfaceAlt, ["--chat-sidebar" as string]:tokens.sidebar, ["--chat-border" as string]:tokens.border, ["--chat-text" as string]:tokens.text, ["--chat-muted" as string]:tokens.muted, ["--chat-accent" as string]:tokens.accent, ["--chat-outgoing" as string]:tokens.outgoing, ["--chat-incoming" as string]:tokens.incoming, ["--chat-danger" as string]:tokens.danger } as React.CSSProperties}>
      <style>{`
        @keyframes chatBorderSpin { to { transform: rotate(360deg); } }
        @keyframes chatGlowPulse { 0%,100% { box-shadow: 0 0 12px rgba(56,189,248,.28); } 50% { box-shadow: 0 0 23px rgba(168,85,247,.42); } }
        .chat-back-glow { position:relative; isolation:isolate; overflow:hidden; }
        .chat-back-glow::before { content:""; position:absolute; z-index:-2; inset:-140%; background:conic-gradient(from 0deg,#38bdf8,#818cf8,#d946ef,#fb7185,#facc15,#34d399,#38bdf8); animation:chatBorderSpin 3.4s linear infinite; }
        .chat-back-glow::after { content:""; position:absolute; z-index:-1; inset:2px; border-radius:999px; background:#0f172a; }
        .chat-back-glow { animation:chatGlowPulse 2.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .chat-back-glow,.chat-back-glow::before { animation:none; } }
      `}</style>

      <header className="flex h-[68px] shrink-0 items-center gap-3 border-b border-white/10 bg-slate-950 px-3 text-white md:px-5">
        <button type="button" onClick={backToWebsite} className="chat-back-glow flex h-11 shrink-0 items-center gap-2 rounded-full border-0 px-4 text-xs font-black text-white md:px-5" aria-label="Back to main website">
          <ArrowLeft size={17} />
          <span className="hidden sm:inline">Back to Website</span>
        </button>
        <div className="mx-1 h-7 w-px bg-white/10" />
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">{logoUrl ? <img src={logoUrl} alt="Lab logo" className="h-full w-full bg-white object-contain" /> : <MessageCircleMore size={21} />}</span>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-sm font-black md:text-base">Syed Lab Messenger</h1>
          <p className="m-0 flex items-center gap-1 text-[10px] font-semibold text-slate-400"><LockKeyhole size={11} /> Private team communication</p>
        </div>
        <div className="hidden min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:flex">
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[10px] font-black">{currentProfile?.photo ? <img src={currentProfile.photo} alt={currentProfile.name} className="h-full w-full object-cover" /> : appUser?.name?.charAt(0).toUpperCase() || "U"}</span>
          <span className="max-w-[140px] truncate text-xs font-bold text-slate-200">{appUser?.name || "Team member"}</span>
        </div>
        <button type="button" onClick={() => setSettingsOpen(true)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" aria-label="Chat appearance settings"><Palette size={18}/></button>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden bg-slate-100">
        <ChatWorkspace appUser={appUser} immersive />
      </main>
      <ChatSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

const Chat: React.FC = () => <ChatThemeProvider><ChatContent /></ChatThemeProvider>;

export default Chat;
