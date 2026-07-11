import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CommentSection from "../components/CommentSection";
import EditableText from "../components/EditableText";
import { db, isFirebaseConfigured } from "../firebase/config";
import { normalizeResearchIdea } from "../firebase/hooks";
import type { ResearchIdea } from "../types";
import { useCanonicalCollaborator } from "../hooks/useCanonicalCollaborator";

const IdeaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [idea, setIdea] = useState<ResearchIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgErr, setImgErr] = useState(false);
  const author = useCanonicalCollaborator(idea?.authorId, { name: idea?.authorName, photo: idea?.authorPhoto });

  useEffect(() => {
    if (!id || !isFirebaseConfigured) { setLoading(false); return; }
    getDoc(doc(db, "researchIdeas", id))
      .then((snap) => { if (snap.exists()) setIdea(normalizeResearchIdea(snap.id, snap.data())); })
      .catch((error) => console.error("Idea detail error:", error))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{
            borderColor: "var(--color-primary)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );

  if (!idea)
    return (
      <div className="text-center py-24">
        <p className="text-gray-400 text-lg">
          <EditableText
            id="ideaDetail.notFound"
            defaultValue="Idea not found."
            className="text-gray-400 text-lg"
          />
        </p>
        <button
          onClick={() => navigate("/research-ideas")}
          className="mt-4 text-sm font-bold bg-transparent border-none cursor-pointer"
          style={{ color: "var(--color-secondary)" }}
        >
          <EditableText
            id="ideaDetail.backToIdeas"
            defaultValue="← Back to Ideas"
            className="text-sm font-bold"
          />
        </button>
      </div>
    );

  const initials = (author.name || "Researcher")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      {/* Hero */}
      <section
        className="py-16 px-4"
        style={{ background: "var(--color-primary)" }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {idea.tags?.map((t) => (
              <span
                key={t}
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {t}
              </span>
            ))}
          </div>

          <h1
            className="text-white font-black leading-tight mb-6"
            style={{
              fontSize: "clamp(1.6rem,4vw,2.6rem)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {idea.title}
          </h1>

          {/* Author */}
          <div className="flex items-center gap-3">
            {author.photo && !imgErr ? (
              <img
                src={author.photo}
                alt={author.name}
                onError={() => setImgErr(true)}
                className="rounded-full object-cover"
                style={{ width: 44, height: 44 }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center text-white text-sm font-black"
                style={{
                  width: 44,
                  height: 44,
                  background: "var(--color-secondary)",
                }}
              >
                {initials}
              </div>
            )}
            <div>
              <p className="text-white font-bold text-sm">{author.name}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                Posted{" "}
                {new Date(idea.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                {idea.updatedAt !== idea.createdAt && (
                  <>
                    {" "}
                    · Updated {new Date(idea.updatedAt).toLocaleDateString()}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate("/research-ideas")}
          className="text-sm font-bold mb-6 bg-transparent border-none cursor-pointer block"
          style={{ color: "var(--color-secondary)" }}
        >
          <EditableText
            id="ideaDetail.backToResearchIdeas"
            defaultValue="← Back to Research Ideas"
            className="text-sm font-bold"
          />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div
              className="bg-white rounded-2xl p-8 shadow-sm border mb-8"
              style={{ borderColor: "#e5e7eb" }}
            >
              <h2
                className="font-black text-xl mb-5"
                style={{
                  color: "var(--color-primary)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                <EditableText
                  id="ideaDetail.descriptionLabel"
                  defaultValue="Description"
                  className="font-black text-xl mb-5"
                />
              </h2>
              <p
                className="text-gray-700 leading-relaxed text-base"
                style={{ whiteSpace: "pre-line" }}
              >
                {idea.fullDescription}
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div
              className="bg-white rounded-2xl p-6 shadow-sm border sticky top-24"
              style={{ borderColor: "#e5e7eb" }}
            >
              <h3
                className="font-black text-lg mb-5"
                style={{
                  color: "var(--color-primary)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                <EditableText
                  id="ideaDetail.aboutLabel"
                  defaultValue="About this Idea"
                  className="font-black text-lg mb-5"
                />
              </h3>

              <div className="space-y-4 text-sm">
                <div
                  className="flex items-center gap-3 pb-4 border-b"
                  style={{ borderColor: "#edf2f7" }}
                >
                  {author.photo && !imgErr ? <img src={author.photo} alt={author.name} onError={() => setImgErr(true)} className="h-10 w-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))" }}>{initials}</div>}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                      <EditableText
                        id="ideaDetail.postedByLabel"
                        defaultValue="Posted by"
                        className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5"
                      />
                    </p>
                    <p className="font-semibold text-gray-800 leading-tight">
                      {author.name}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-xl border p-3"
                    style={{ borderColor: "#edf2f7" }}
                  >
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      <EditableText
                        id="ideaDetail.dateLabel"
                        defaultValue="Date"
                        className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1"
                      />
                    </p>
                    <p className="text-gray-700 font-semibold leading-snug">
                      {new Date(idea.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <div
                    className="rounded-xl border p-3"
                    style={{ borderColor: "#edf2f7" }}
                  >
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      <EditableText
                        id="ideaDetail.commentsLabel"
                        defaultValue="Comments"
                        className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1"
                      />
                    </p>
                    <p
                      className="font-black text-2xl leading-none"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {idea.commentCount ?? 0}
                    </p>
                  </div>
                </div>

                {idea.tags?.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      <EditableText
                        id="ideaDetail.tagsLabel"
                        defaultValue="Tags"
                        className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
                      />
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {idea.tags.map((t) => (
                        <span
                          key={t}
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: "#eff6ff", color: "#1d4ed8" }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Comments */}
        {id && (
          <section className="mt-12">
            <CommentSection ideaId={id} />
          </section>
        )}
      </div>
    </div>
  );
};

export default IdeaDetail;
