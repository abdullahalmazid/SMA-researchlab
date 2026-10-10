import React, { useCallback, useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Information only — a single OK button. */
  info?: boolean;
}

/**
 * `await confirm({...})` in place of window.confirm, rendered with the
 * admin's own dialog. Render `confirmElement` once in the component.
 */
export const useConfirm = () => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  const confirmElement = (
    <ConfirmDialog
      open={Boolean(options)}
      title={options?.title ?? ""}
      message={options?.message ?? ""}
      confirmLabel={options?.confirmLabel}
      danger={options?.danger}
      hideCancel={options?.info}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  /** window.alert replacement: resolves when dismissed. */
  const inform = useCallback(
    (title: string, message: string) => confirm({ title, message, confirmLabel: "OK", info: true }).then(() => undefined),
    [confirm],
  );

  return { confirm, inform, confirmElement };
};

/** Inline, dismissible message — replaces window.alert. */
export const InlineNotice: React.FC<{ notice: { type: "error" | "success"; text: string } | null; onDismiss: () => void }> = ({
  notice,
  onDismiss,
}) =>
  notice ? (
    <div
      role={notice.type === "error" ? "alert" : "status"}
      className={`mb-3 flex items-start gap-3 rounded-lg border px-3 py-2 text-[13px] font-semibold ${
        notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      <span className="flex-1">{notice.text}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        ×
      </button>
    </div>
  ) : null;
