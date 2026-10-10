import { BellRing, Check, RotateCcw, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useChatTheme } from "../theme/ChatThemeProvider";
import type { ChatThemeMode } from "../theme/chatThemes";
import { notificationsSupported } from "../useChatNotifications";

const MODES: { id: ChatThemeMode; label: string; colors: string[] }[] = [
  { id: "lab", label: "Follow Lab Theme", colors: ["var(--color-primary)", "var(--color-secondary)"] },
  { id: "light", label: "Clean Light", colors: ["#fff", "#0284c7"] },
  { id: "dark", label: "Dark", colors: ["#111827", "#38bdf8"] },
  { id: "monochrome", label: "Monochrome", colors: ["#fff", "#262626"] },
  { id: "midnight", label: "Midnight", colors: ["#050816", "#818cf8"] },
  { id: "soft-blue", label: "Soft Blue", colors: ["#edf5fb", "#2583c5"] },
];

const ChatSettingsDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { appearance, setAppearance, reset } = useChatTheme();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    notificationsSupported() ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const enableNotifications = async () => {
    if (!notificationsSupported()) return;
    setPermission(await Notification.requestPermission());
  };

  return (
    <div className="fixed inset-0 z-[2147483300] bg-slate-950/55 backdrop-blur-sm" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Chat settings"
        className="ml-auto h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="m-0 text-[10px] font-black uppercase tracking-widest text-sky-600">Personal preference</p>
            <h2 className="m-0 mt-1 text-2xl font-black text-slate-900">Chat settings</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings" className="grid h-10 w-10 place-items-center rounded-full border-0 bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
              <BellRing size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-black text-slate-800">Desktop notifications</p>
              <p className="m-0 mt-1 text-[12.5px] leading-5 text-slate-500">
                {permission === "granted"
                  ? "On. You'll be notified of new messages while the site is open in a tab, even in the background."
                  : permission === "denied"
                    ? "Blocked in your browser. Allow notifications for this site in the browser's site settings to turn them on."
                    : permission === "unsupported"
                      ? "This browser doesn't support notifications."
                      : "Get a notification when a message arrives while chat isn't in front of you."}
              </p>
            </div>
          </div>
          {permission === "default" && (
            <button
              type="button"
              onClick={() => void enableNotifications()}
              className="mt-3 w-full rounded-xl border-0 bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700"
            >
              Turn on notifications
            </button>
          )}
        </section>

        <p className="m-0 mt-6 text-sm leading-6 text-slate-500">
          Appearance settings apply only on this device. Follow Lab Theme updates automatically with the admin theme.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setAppearance((current) => ({ ...current, mode: mode.id }))}
              className={`rounded-2xl border bg-white p-3 text-left ${appearance.mode === mode.id ? "border-sky-500 ring-4 ring-sky-100" : "border-slate-200"}`}
              aria-pressed={appearance.mode === mode.id}
            >
              <div className="flex h-10 overflow-hidden rounded-xl">
                {mode.colors.map((color, index) => (
                  <span key={index} className="flex-1" style={{ background: color }} />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-black text-slate-700">{mode.label}</span>
                {appearance.mode === mode.id && <Check size={15} className="text-sky-600" />}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
          <Setting
            label="Compact message spacing"
            checked={appearance.density === "compact"}
            onChange={(checked) => setAppearance((current) => ({ ...current, density: checked ? "compact" : "comfortable" }))}
          />
          <Setting
            label="Conversation background pattern"
            checked={appearance.pattern}
            onChange={(pattern) => setAppearance((current) => ({ ...current, pattern }))}
          />
          <Setting
            label="Reduce motion"
            checked={appearance.reduceMotion}
            onChange={(reduceMotion) => setAppearance((current) => ({ ...current, reduceMotion }))}
          />
        </div>

        <button
          type="button"
          onClick={reset}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-slate-100 px-4 py-3 text-sm font-black text-slate-600"
        >
          <RotateCcw size={16} />
          Reset appearance
        </button>
      </aside>
    </div>
  );
};

const Setting: React.FC<{ label: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-700">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-sky-600" />
  </label>
);

export default ChatSettingsDrawer;
