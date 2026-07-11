import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { ADMIN_LAYERS } from "../core/adminLayers";

const AdminModal: React.FC<React.PropsWithChildren<{ open: boolean; title: string; description?: string; onClose: () => void; width?: string; footer?: React.ReactNode }>> = ({ open, title, description, onClose, width = "720px", footer, children }) => {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", key); };
  }, [onClose, open]);
  if (!open) return null;
  return createPortal(<div className="fixed inset-0 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" style={{ zIndex: ADMIN_LAYERS.backdrop }} onMouseDown={onClose}><section role="dialog" aria-modal="true" aria-labelledby="admin-modal-title" className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl" style={{ maxWidth: width, zIndex: ADMIN_LAYERS.modal }} onMouseDown={(event) => event.stopPropagation()}><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5"><div><h2 id="admin-modal-title" className="text-xl font-black text-slate-900">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div><button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-500">×</button></header><div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>{footer && <footer className="border-t border-slate-100 bg-slate-50 px-6 py-4">{footer}</footer>}</section></div>, document.body);
};
export default AdminModal;
