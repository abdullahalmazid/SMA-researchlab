import { addDoc, collection } from "firebase/firestore";
import React, { useState } from "react";
import AppIcon from "../components/AppIcon";
import EditableText from "../components/EditableText";
import IdeaCard from "../components/IdeaCard";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { useResearchIdeas, useSiteContent } from "../firebase/hooks";

const ResearchIdeas: React.FC = () => {
  const { ideas, loading } = useResearchIdeas();
  const { content } = useSiteContent();
  const { role, appUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const canPost = role === "collaborator" || role === "lab_head";

  const filtered = ideas.filter(
    (i) =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.shortDescription.toLowerCase().includes(search.toLowerCase()) ||
      i.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

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

  return (
    <div>
      {/* Hero */}
      <section
        className="relative min-h-[320px] overflow-hidden py-20 text-center px-4 flex items-center justify-center"
        style={{ background: "var(--color-primary)" }}
      >
        {content["ideas.bannerUrl"] && (
          <img
            src={content["ideas.bannerUrl"]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.45)" }}
          />
        )}

        <div className="relative z-10">
          <h1
            className="font-black text-white mb-4"
            style={{
              fontSize: "clamp(2rem,4vw,3rem)",
              fontFamily: "var(--font-heading)",
            }}
          >
            <EditableText
              id="ideas.pageTitle"
              defaultValue={content["ideas.pageTitle"] ?? "Research Ideas"}
              className="text-white font-black"
              block
            />
          </h1>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            <EditableText
              id="ideas.pageSubtitle"
              defaultValue={
                content["ideas.pageSubtitle"] ??
                "Explore and discuss cutting-edge research ideas from our collaborators."
              }
              className="text-white"
              block
            />
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ideas, tags..."
            className="text-sm px-4 py-2.5 rounded-xl border outline-none w-full sm:w-72"
            style={{ borderColor: "#d1d5db" }}
          />
          {canPost && (
            <button
              onClick={() => setShowModal(true)}
              className="font-bold text-sm px-6 py-2.5 rounded-xl text-white whitespace-nowrap"
              style={{
                background: "var(--color-primary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <EditableText
                id="ideas.postButton"
                defaultValue={content["ideas.postButton"] ?? "+ Post Idea"}
                className="text-white font-bold"
                block
              />
            </button>
          )}
          {!role && (
            <p className="text-xs text-gray-400 italic">
              <EditableText
                id="ideas.guestMsg"
                defaultValue="Only collaborators can post ideas."
                className="inline"
              />
            </p>
          )}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-4 inline-flex text-gray-400">
              <AppIcon name="ideas" size={42} />
            </div>
            <p className="text-gray-400 text-base">
              <EditableText
                id="ideas.emptyText"
                defaultValue={
                  content["ideas.emptyText"] ?? "No research ideas posted yet."
                }
                className="inline"
              />
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        )}
      </div>

      {showModal && appUser && (
        <PostIdeaModal
          authorId={appUser.uid}
          authorName={appUser.name}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// ── Post Idea Modal ────────────────────────────────────────────
interface PostIdeaModalProps {
  authorId: string;
  authorName: string;
  onClose: () => void;
}

const PostIdeaModal: React.FC<PostIdeaModalProps> = ({
  authorId,
  authorName,
  onClose,
}) => {
  const [form, setForm] = useState({
    title: "",
    shortDescription: "",
    fullDescription: "",
    tags: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.shortDescription || !form.fullDescription) {
      setError("Please fill all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "researchIdeas"), {
        title: form.title.trim(),
        shortDescription: form.shortDescription.trim(),
        fullDescription: form.fullDescription.trim(),
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        authorId,
        authorName,
        authorPhoto: "",
        commentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch {
      setError("Failed to post idea. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inp = "w-full px-3 py-2.5 text-sm rounded-lg border outline-none";
  const inpStyle = { borderColor: "#d1d5db", fontFamily: "var(--font-body)" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: "var(--color-primary)" }}
        >
          <h2 className="text-white font-black text-lg">
            <EditableText
              id="ideas.modalTitle"
              defaultValue="Post a Research Idea"
              className="inline"
            />
          </h2>
          <button
            onClick={onClose}
            className="text-white text-2xl bg-transparent border-none cursor-pointer leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <EditableText
                id="ideas.modalLabelTitle"
                defaultValue="Title *"
                className="inline"
              />
            </label>
            <input
              required
              className={inp}
              style={inpStyle}
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
              placeholder="e.g. Federated Learning for Healthcare Privacy"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <EditableText
                id="ideas.modalLabelShortDesc"
                defaultValue="Short Description *"
                className="inline"
              />{" "}
              <span className="text-gray-400 font-normal">(shown on card)</span>
            </label>
            <textarea
              required
              rows={2}
              className={inp}
              style={{ ...inpStyle, resize: "none" }}
              value={form.shortDescription}
              onChange={(e) =>
                setForm((p) => ({ ...p, shortDescription: e.target.value }))
              }
              placeholder="One or two sentences summarising the idea..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <EditableText
                id="ideas.modalLabelFullDesc"
                defaultValue="Full Description *"
                className="inline"
              />{" "}
              <span className="text-gray-400 font-normal">
                (shown on detail page)
              </span>
            </label>
            <textarea
              required
              rows={6}
              className={inp}
              style={{ ...inpStyle, resize: "vertical" }}
              value={form.fullDescription}
              onChange={(e) =>
                setForm((p) => ({ ...p, fullDescription: e.target.value }))
              }
              placeholder="Detailed description of the research idea, motivation, methods, expected outcomes..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <EditableText
                id="ideas.modalLabelTags"
                defaultValue="Tags"
                className="inline"
              />{" "}
              <span className="text-gray-400 font-normal">
                (comma separated)
              </span>
            </label>
            <input
              className={inp}
              style={inpStyle}
              value={form.tags}
              onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
              placeholder="AI, healthcare, NLP, federated learning"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold px-5 py-2 rounded-lg border cursor-pointer"
              style={{
                borderColor: "#d1d5db",
                background: "white",
                color: "#374151",
              }}
            >
              <EditableText
                id="ideas.modalCancelBtn"
                defaultValue="Cancel"
                className="inline"
              />
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm font-bold px-6 py-2 rounded-lg text-white disabled:opacity-60"
              style={{
                background: "var(--color-primary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {submitting ? (
                "Posting..."
              ) : (
                <EditableText
                  id="ideas.modalSubmitBtn"
                  defaultValue="Post Idea"
                  className="inline"
                />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResearchIdeas;
