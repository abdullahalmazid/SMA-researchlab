import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatWorkspace } from "../chat";
import ChatSettingsDrawer from "../chat/components/ChatSettingsDrawer";
import { ChatThemeProvider, useChatTheme } from "../chat/theme/ChatThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useSiteContent } from "../firebase/hooks";
import type { User } from "../types";

/**
 * Full-screen messenger. There's no separate top bar: back-to-website,
 * branding and settings live in the conversation sidebar's header, which
 * lines up with the open conversation's header — one row instead of two.
 */
export const ChatShell: React.FC<{ appUser: User | null; onBack: () => void }> = ({ appUser, onBack }) => {
  const { content } = useSiteContent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { appearance, tokens } = useChatTheme();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className={`chat-app-theme fixed inset-0 z-[2147482000] flex min-h-0 flex-col ${
        appearance.density === "compact" ? "chat-density-compact" : ""
      } ${appearance.pattern ? "chat-pattern-enabled" : ""} ${appearance.reduceMotion ? "chat-reduce-motion" : ""}`}
      style={
        {
          background: tokens.app,
          color: tokens.text,
          "--chat-app": tokens.app,
          "--chat-surface": tokens.surface,
          "--chat-surface-alt": tokens.surfaceAlt,
          "--chat-sidebar": tokens.sidebar,
          "--chat-border": tokens.border,
          "--chat-text": tokens.text,
          "--chat-muted": tokens.muted,
          "--chat-accent": tokens.accent,
          "--chat-outgoing": tokens.outgoing,
          "--chat-incoming": tokens.incoming,
          "--chat-danger": tokens.danger,
        } as React.CSSProperties
      }
    >
      <main className="min-h-0 flex-1 overflow-hidden">
        <ChatWorkspace
          appUser={appUser}
          immersive
          brand={{ title: content["branding.labName"] ?? "Research Lab", logoUrl: content["branding.logoUrl"] || undefined }}
          onBack={onBack}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </main>
      <ChatSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

const ChatContent: React.FC = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const backToWebsite = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  };
  return <ChatShell appUser={appUser} onBack={backToWebsite} />;
};

const Chat: React.FC = () => (
  <ChatThemeProvider>
    <ChatContent />
  </ChatThemeProvider>
);

export default Chat;
