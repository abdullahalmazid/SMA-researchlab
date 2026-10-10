import { addDoc, collection } from "firebase/firestore";
import React, { useState } from "react";
import AppIcon from "../components/AppIcon";
import EditableText from "../components/EditableText";
import IdeaCard from "../components/IdeaCard";
import PageHero from "../components/PageHero";
import PageSearchBar from "../components/PageSearchBar";
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
      <PageHero
        bannerUrl={content["ideas.bannerUrl"]}
        eyebrow={
          <EditableText id="ideas.eyebrow" defaultValue={content["ideas.eyebrow"] ?? "Open questions"} className="inline" />
        }
        title={
          <EditableText
            id="ideas.pageTitle"
            defaultValue={content["ideas.pageTitle"] ?? "Research Ideas"}
            className="inline"
          />
        }
        subtitle={
          <EditableText
            id="ideas.pageSubtitle"
            defaultValue={
              content["ideas.pageSubtitle"] ??
              "Explore and discuss cutting-edge research ideas from our collaborators."
            }
            className="inline"
          />
        }
      />

      <PageSearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search research ideas by title, description or tag"
        status={
          search
            ? `${filtered.length} of ${ideas.length}`
            : `${ideas.length} ${ideas.length === 1 ? "idea" : "ideas"}`
        }
        action={
          canPost ? (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="h-10 whitespace-nowrap rounded-lg px-4 text-[13px] font-bold text-[color:var(--hero-text)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2"
              style={{ background: "var(--color-primary)" }}
            >
              <EditableText
                id="ideas.postButton"
                defaultValue={content["ideas.postButton"] ?? "+ Post Idea"}
                className="inline"
              />
            </button>
          ) : !role ? (
            <p className="whitespace-nowrap text-[12px] italic text-slate-400">
              <EditableText
                id="ideas.guestMsg"
                defaultValue="Only collaborators can post ideas."
                className="inline"
              />
            </p>
          ) : null
        }
      />

      <div className="max-w-6xl mx-auto px-4 pb-16 pt-8">
        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-4 inline-flex text-gray-400">
              <AppIcon name="ideas" size={42} />
            </div>
            <p className="text-gray-400 text-base">
              {ideas.length > 0 ? (
                <>No ideas match “{search}”.</>
              ) : (
                <EditableText
                  id="ideas.emptyText"
                  defaultValue={
                    content["ideas.emptyText"] ?? "No research ideas posted yet."
                  }
                  className="inline"
                />
              )}
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
  const inpStyle = { borderColor: "var(--site-border)", fontFamily: "var(--font-body)" };

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
          <h2 className="text-[color:var(--hero-text)] font-black text-lg">
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
                borderColor: "var(--site-border)",
                background: "white",
                color: "var(--site-text)",
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
              className="text-sm font-bold px-6 py-2 rounded-lg text-[color:var(--hero-text)] disabled:opacity-60"
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
