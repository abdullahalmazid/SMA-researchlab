import { doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";

type Section = { id: string; title: string; body: string; order: number; visible: boolean };

const LabHeadCustomSections: React.FC = () => {
  const { appUser } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const canEdit = appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator" || appUser?.role === "admin";
  useEffect(() => onSnapshot(doc(db, "siteContent", "content"), (snap) => {
    const value = snap.data()?.labHeadCustomSections;
    setSections(Array.isArray(value) ? [...value].sort((a, b) => a.order - b.order) : []);
  }), []);
  const save = (next: Section[]) => setDoc(doc(db, "siteContent", "content"), { labHeadCustomSections: next.map((item, index) => ({ ...item, order: index })) }, { merge: true });
  return <>
    {sections.filter((item) => item.visible || canEdit).map((section, index) => <section key={section.id} className="border-y px-4 py-12" style={{ background: index % 2 ? "color-mix(in srgb, var(--color-secondary) 6%, var(--color-bg))" : "var(--color-bg)", borderColor: "color-mix(in srgb, var(--color-primary) 12%, transparent)", opacity: section.visible ? 1 : .55 }}><div className="mx-auto max-w-7xl"><div className="flex items-start justify-between gap-4"><div className="max-w-4xl"><h2 className="text-2xl font-black" style={{ color: "var(--color-primary)", fontFamily: "var(--font-heading)" }}>{section.title}</h2><div className="mt-3 h-1 w-14 rounded-full" style={{ background: "var(--color-accent)" }} /><p className="mt-5 whitespace-pre-line leading-8 text-slate-600">{section.body}</p></div>{canEdit && <div className="flex gap-1"><button onClick={() => void save(sections.map((item) => item.id === section.id ? { ...item, visible: !item.visible } : item))} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{section.visible ? "Hide" : "Show"}</button><button onClick={() => { const next = [...sections]; if (index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]]; void save(next); }} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">↑</button><button onClick={() => void save(sections.filter((item) => item.id !== section.id))} className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">Delete</button></div>}</div></div></section>)}
    {canEdit && <section className="border-y border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-8"><form className="mx-auto grid max-w-4xl gap-3 rounded-2xl bg-white p-5 shadow-sm" onSubmit={(event) => { event.preventDefault(); if (!draft.title.trim() || !draft.body.trim()) return; void save([...sections, { id: crypto.randomUUID(), title: draft.title.trim(), body: draft.body.trim(), order: sections.length, visible: true }]); setDraft({ title: "", body: "" }); }}><p className="text-xs font-black uppercase tracking-wider text-indigo-700">Add Lab Head section</p><input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Section title" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /><textarea value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Section content" rows={4} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm" /><button className="w-fit rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white">Add section</button></form></section>}
  </>;
};
export default LabHeadCustomSections;
