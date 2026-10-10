import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { db, isFirebaseConfigured } from "../firebase/config";
import { normalizeResearchIdea } from "../firebase/hooks";
import { useCanonicalCollaborator } from "../hooks/useCanonicalCollaborator";
import type { ResearchIdea } from "../types";
import CommentSection from "./CommentSection";
import EditableText from "./EditableText";
import { PersonLink } from "./PersonDrawer";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/** One research idea with its discussion, sized for a split view or a sheet. */
const IdeaView: React.FC<{ id: string; onLoaded?: (idea: ResearchIdea | null) => void }> = ({ id, onLoaded }) => {
  const [idea, setIdea] = useState<ResearchIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgErr, setImgErr] = useState(false);
  const author = useCanonicalCollaborator(idea?.authorId, { name: idea?.authorName, photo: idea?.authorPhoto });

  useEffect(() => {
    setLoading(true);
    setIdea(null);
    if (!id || !isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    let live = true;
    getDoc(doc(db, "researchIdeas", id))
      .then((snap) => {
        if (!live) return;
        const next = snap.exists() ? normalizeResearchIdea(snap.id, snap.data()) : null;
        setIdea(next);
        onLoaded?.(next);
      })
      .catch((error) => console.error("Idea detail error:", error))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 p-5 motion-safe:animate-pulse" role="status" aria-busy="true">
        <span className="sr-only">Loading idea</span>
        <div className="h-36 rounded-2xl bg-slate-200" />
        <div className="h-48 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (!idea) {
    return (
      <p className="px-5 py-16 text-center text-[14px] text-slate-500">
        <EditableText id="ideaDetail.notFound" defaultValue="Idea not found." className="inline" />
      </p>
    );
  }

  const initials = (author.name || "Researcher")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const byline = (
    <span className="flex items-center gap-2.5">
      {author.photo && !imgErr ? (
        <img src={author.photo} alt="" onError={() => setImgErr(true)} className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-full text-[12px] font-black"
          style={{ background: "var(--color-secondary)", color: "var(--on-secondary)" }}
        >
          {initials}
        </span>
      )}
      <span>
        <span className="block text-[13.5px] font-bold">{author.name}</span>
        <span className="block text-[11.5px] opacity-70">
          Posted {fmt(idea.createdAt)}
          {idea.updatedAt && idea.updatedAt !== idea.createdAt ? ` · updated ${new Date(idea.updatedAt).toLocaleDateString()}` : ""}
        </span>
      </span>
    </span>
  );

  return (
    <div>
      <header className="px-5 py-6 md:px-7" style={{ background: "var(--color-primary)", color: "var(--hero-text)" }}>
        {idea.tags?.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {idea.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{ background: "color-mix(in srgb, var(--hero-text) 15%, transparent)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <h2 className="text-[clamp(1.35rem,2.4vw,1.9rem)] font-black leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
          {idea.title}
        </h2>
        <div className="mt-4">
          {idea.authorId ? (
            <PersonLink uid={idea.authorId} name={author.name} className="inline-block rounded-lg no-underline" style={{ color: "var(--hero-text)" }}>
              {byline}
            </PersonLink>
          ) : (
            byline
          )}
        </div>
      </header>

      <div className="space-y-4 px-5 py-5 md:px-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <EditableText id="ideaDetail.descriptionLabel" defaultValue="Description" className="inline" />
          </h3>
          <p className="whitespace-pre-line text-[15px] leading-[1.8] text-slate-700">{idea.fullDescription}</p>
        </section>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-slate-500">
          <span>
            <EditableText id="ideaDetail.dateLabel" defaultValue="Date" className="inline" />: <b className="text-slate-700">{fmt(idea.createdAt)}</b>
          </span>
          <span>
            <EditableText id="ideaDetail.commentsLabel" defaultValue="Comments" className="inline" />:{" "}
            <b className="text-slate-700">{idea.commentCount ?? 0}</b>
          </span>
        </div>

        <section>
          <CommentSection ideaId={id} />
        </section>
      </div>
    </div>
  );
};

export default IdeaView;
