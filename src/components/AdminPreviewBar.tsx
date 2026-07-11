import { ChevronLeft, Eye, GripVertical, ShieldCheck, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminPreview, type PreviewMode } from "../context/AdminPreviewContext";
import { useAuth } from "../context/AuthContext";

const DRAWER_WIDTH = 236;
const HANDLE_WIDTH = 38;
const options: Array<{ mode: PreviewMode; label: string; hint: string; path: string }> = [
  { mode: "admin", label: "Admin", hint: "Manage website", path: "/admin" },
  { mode: "lab_head", label: "Lab head", hint: "Read-only preview", path: "/" },
  { mode: "collaborator", label: "Collaborator", hint: "Read-only preview", path: "/collaborators" },
];

const AdminPreviewBar: React.FC = () => {
  const { role } = useAuth();
  const { mode, setMode } = useAdminPreview();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => sessionStorage.getItem("syedlab_preview_drawer") === "open");
  const [dragOffset, setDragOffset] = useState(0);
  const drag = useRef<{ startX: number; startedOpen: boolean } | null>(null);

  useEffect(() => {
    sessionStorage.setItem("syedlab_preview_drawer", open ? "open" : "closed");
  }, [open]);

  if (role !== "admin") return null;

  const selectMode = (nextMode: PreviewMode, path: string) => {
    setMode(nextMode);
    setOpen(false);
    navigate(path);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = { startX: event.clientX, startedOpen: open };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const delta = drag.current.startX - event.clientX;
    setDragOffset(Math.max(-DRAWER_WIDTH, Math.min(DRAWER_WIDTH, delta)));
  };
  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const delta = drag.current.startX - event.clientX;
    if (Math.abs(delta) < 8) setOpen((current) => !current);
    else if (drag.current.startedOpen) setOpen(delta > 70);
    else setOpen(delta > 45);
    setDragOffset(0);
    drag.current = null;
  };

  const baseTranslate = open ? 0 : DRAWER_WIDTH - HANDLE_WIDTH;
  const translated = open
    ? Math.max(0, baseTranslate + Math.max(0, -dragOffset))
    : Math.max(0, Math.min(DRAWER_WIDTH - HANDLE_WIDTH, baseTranslate - Math.max(0, dragOffset)));

  return (
    <aside
      className="fixed right-0 top-24 z-[45] flex overflow-hidden rounded-l-2xl border border-r-0 border-slate-200 bg-white shadow-2xl"
      style={{ width: DRAWER_WIDTH, transform: `translateX(${translated}px)`, transition: drag.current ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1)" }}
      aria-label="Admin preview controls"
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; setDragOffset(0); }}
        className="flex w-[38px] shrink-0 touch-none select-none flex-col items-center justify-center gap-1 border-0 border-r border-slate-200 bg-slate-900 py-3 text-white cursor-ew-resize"
        title={open ? "Drag right to collapse" : "Drag left to open admin views"}
        aria-label={open ? "Collapse admin view drawer" : "Expand admin view drawer"}
        aria-expanded={open}
      >
        <ChevronLeft size={15} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        <GripVertical size={14} className="text-slate-400" />
        <span className="mt-1 [writing-mode:vertical-rl] rotate-180 text-[9px] font-black uppercase tracking-[0.16em]">Views</span>
      </button>

      <div className="min-w-0 flex-1 p-3">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              {mode === "admin" ? <ShieldCheck size={16} /> : <Eye size={16} />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-900">Admin views</p>
              <p className="truncate text-[10px] text-slate-500">{mode === "admin" ? "Editing enabled" : "Read-only mode"}</p>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-0 bg-slate-100 text-slate-500" aria-label="Close admin views"><X size={14} /></button>
        </div>

        <div className="space-y-1.5">
          {options.map((item) => (
            <button
              type="button"
              key={item.mode}
              onClick={() => selectMode(item.mode, item.path)}
              className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${mode === item.mode ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${mode === item.mode ? "bg-amber-500" : "bg-slate-300"}`} />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-slate-800">{item.label}</span>
                <span className="block truncate text-[9px] text-slate-500">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default AdminPreviewBar;
