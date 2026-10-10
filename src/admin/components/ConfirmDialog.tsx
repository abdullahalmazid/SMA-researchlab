import React from "react";
import AdminModal from "./AdminModal";

const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
  /** Information only: a single OK button. */
  hideCancel?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ open, title, message, confirmLabel = "Confirm", busy, danger, hideCancel, onCancel, onConfirm }) => (
  <AdminModal
    open={open}
    title={title}
    onClose={onCancel}
    width="440px"
    footer={
      <div className="flex justify-end gap-2">
        {!hideCancel && (
          <button onClick={onCancel} disabled={busy} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700">
            Cancel
          </button>
        )}
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`h-9 rounded-lg px-4 text-[13px] font-semibold text-white ${danger ? "bg-rose-600" : "bg-indigo-600"}`}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    }
  >
    <p className="m-0 text-sm leading-6 text-slate-600">{message}</p>
  </AdminModal>
);

export default ConfirmDialog;
