import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Toasts and confirm dialogs for the messenger, replacing window.alert and
 * window.confirm — which block the page, can't be styled, and on some mobile
 * browsers are suppressed entirely.
 */
type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
}
interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface FeedbackApi {
  notify: (message: string, kind?: ToastKind) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export const useChatFeedback = () => {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useChatFeedback must be used inside ChatFeedbackProvider");
  return value;
};

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const;
const TONES: Record<ToastKind, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export const ChatFeedbackProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const settle = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[2147483100] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13.5px] font-medium shadow-lg ${TONES[toast.kind]}`}
            >
              <Icon size={17} className="mt-0.5 shrink-0" />
              <p className="m-0 min-w-0 flex-1 leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-0 bg-transparent opacity-60 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {pending && <ConfirmDialog options={pending} onSettle={settle} />}
    </FeedbackContext.Provider>
  );
};

const ConfirmDialog: React.FC<{ options: ConfirmOptions; onSettle: (value: boolean) => void }> = ({
  options,
  onSettle,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSettle(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSettle]);

  return (
    <div
      className="fixed inset-0 z-[2147483050] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={() => onSettle(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="chat-confirm-title"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {options.danger && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600">
              <AlertTriangle size={18} />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="chat-confirm-title" className="m-0 text-[15px] font-bold text-slate-900">
              {options.title}
            </h2>
            {options.body && <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{options.body}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onSettle(false)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onSettle(true)}
            className={`h-9 rounded-lg border-0 px-3.5 text-[13px] font-semibold text-white ${
              options.danger ? "bg-rose-600 hover:bg-rose-700" : ""
            }`}
            style={options.danger ? undefined : { background: "var(--chat-accent)" }}
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};
