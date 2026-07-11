import React, { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAdminPreview } from "../context/AdminPreviewContext";
import { useEditableContent } from "../hooks/useEditableContent";

interface Props {
  id: string;
  tag?: keyof JSX.IntrinsicElements;
  wrapperTag?: keyof JSX.IntrinsicElements;
  defaultValue: string;
  className?: string;
  multiline?: boolean;
  onSave?: (value: string) => Promise<void> | void;
  wrapperClassName?: string;
  block?: boolean;
}

export default function EditableText({ id, tag = "span", wrapperTag = "span", defaultValue, className, multiline = false, onSave, wrapperClassName = "", block = false }: Props) {
  const { role } = useAuth();
  const { mode } = useAdminPreview();
  const { value, save } = useEditableContent(id, defaultValue);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const isAdmin = role === "admin" && mode === "admin";

  const finish = async () => {
    if (!editing) return;
    const next = ref.current?.innerText.trim() || defaultValue;
    await (onSave ? onSave(next) : save(next));
    setEditing(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const editable = React.createElement(block ? "div" : tag, {
    ref,
    className,
    contentEditable: isAdmin && editing,
    suppressContentEditableWarning: true,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (!multiline && event.key === "Enter") { event.preventDefault(); void finish(); }
      if (event.key === "Escape") setEditing(false);
    },
    onBlur: () => void finish(),
    style: editing ? { outline: "2px dashed var(--color-secondary)", borderRadius: 6, minWidth: 40 } : undefined,
    children: value,
  });

  return React.createElement(
    wrapperTag,
    { className: `relative group ${wrapperClassName}`.trim() },
    editable,
    isAdmin && !editing && React.createElement("button", {
      type: "button",
      className: "ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100",
      title: "Edit this text",
      "aria-label": `Edit ${id}`,
      onClick: (event: React.MouseEvent) => {
        event.preventDefault(); event.stopPropagation(); setEditing(true);
        window.setTimeout(() => ref.current?.focus(), 0);
      },
      children: React.createElement(Pencil, { size: 12 }),
    }),
    saved && React.createElement("span", { className: "ml-2 text-xs font-semibold text-emerald-600", children: "Saved" }),
  );
}
