import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../firebase/config";
import { normalizePublication } from "../firebase/hooks";
import type { Publication, PublicationAuthorEntry } from "../types";

const PublicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    return onSnapshot(doc(db, "publications", id), (snapshot) => {
      setPublication(snapshot.exists() ? normalizePublication(snapshot.id, snapshot.data()) : null);
      setLoading(false);
    }, () => setLoading(false));
  }, [id]);
  if (loading) return <div className="grid min-h-[60vh] place-items-center text-sm font-bold text-slate-400">Loading publication…</div>;
  if (!publication) return <div className="mx-auto max-w-3xl px-4 py-24 text-center"><h1 className="text-2xl font-black">Publication not found</h1><Link to="/publications" className="mt-5 inline-block font-bold" style={{ color: "var(--color-secondary)" }}>Back to publications</Link></div>;
  const authors: PublicationAuthorEntry[] = publication.authorEntries?.length ? publication.authorEntries : publication.authors.split(",").map((name): PublicationAuthorEntry => ({ type: "external", name: name.trim() })).filter((item) => Boolean(item.name));
  const paperUrl = publication.url || (publication.doi ? `https://doi.org/${publication.doi}` : "");
  return <main className="min-h-screen" style={{ background: "var(--color-bg)" }}>
    <header className="border-b border-white/10 px-4 py-14 text-white" style={{ background: "var(--color-primary)" }}><div className="mx-auto max-w-5xl"><Link to="/publications" className="text-sm font-bold text-white/70 hover:text-white">← Publications</Link><div className="mt-8 flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest">{publication.type === "ongoing" ? "Ongoing research" : "Published"}</span><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest">{publication.year}</span></div><h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight md:text-5xl">{publication.title}</h1><p className="mt-5 max-w-3xl text-base leading-7 text-white/70">{publication.journal}</p></div></header>
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_280px]">
      <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-9"><p className="text-[11px] font-black uppercase tracking-[.18em] text-slate-400">Abstract</p><p className="mt-5 whitespace-pre-line text-[15px] leading-8 text-slate-700">{publication.abstract || "No abstract has been provided for this publication."}</p>{publication.tags?.length > 0 && <div className="mt-8 flex flex-wrap gap-2 border-t border-slate-100 pt-6">{publication.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{tag}</span>)}</div>}</article>
      <aside className="h-fit rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24"><h2 className="font-black text-slate-900">Publication record</h2><dl className="mt-5 grid gap-5 text-sm"><div><dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authors</dt><dd className="mt-2 grid gap-2 font-semibold text-slate-700">{authors.map((author, index) => <span key={`${author.name}-${index}`}>{author.name}</span>)}</dd></div>{publication.doi && <div><dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">DOI</dt><dd className="mt-1 break-all font-semibold text-slate-700">{publication.doi}</dd></div>}<div><dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">Year</dt><dd className="mt-1 font-semibold text-slate-700">{publication.year}</dd></div></dl>{paperUrl && <a href={paperUrl} target="_blank" rel="noreferrer" className="mt-7 block rounded-xl px-4 py-3 text-center text-sm font-black text-white" style={{ background: "var(--color-secondary)" }}>Open full paper ↗</a>}</aside>
    </div>
  </main>;
};
export default PublicationDetail;
