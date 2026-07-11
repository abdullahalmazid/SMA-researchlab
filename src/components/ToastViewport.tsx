import { CheckCircle2, X, XCircle } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";

interface ToastViewportProps {
  message: string;
  type?: "success" | "error";
  onDismiss?: () => void;
}

const ToastViewport: React.FC<ToastViewportProps> = ({
  message,
  type = "success",
  onDismiss,
}) => {
  if (typeof document === "undefined") return null;
  const success = type === "success";

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-4 flex justify-center px-4"
      style={{ zIndex: 2147483000 }}
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl"
        style={{
          background: success ? "rgba(240,253,244,.98)" : "rgba(254,242,242,.98)",
          borderColor: success ? "#86efac" : "#fca5a5",
          color: success ? "#166534" : "#991b1b",
        }}
      >
        {success ? (
          <CheckCircle2 className="mt-0.5 shrink-0" size={19} />
        ) : (
          <XCircle className="mt-0.5 shrink-0" size={19} />
        )}
        <p className="min-w-0 flex-1 font-semibold leading-relaxed">{message}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-0 bg-black/5"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ToastViewport;
