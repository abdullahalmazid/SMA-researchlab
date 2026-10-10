import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import React, { useState } from "react";
import RowMenu from "../../admin/components/RowMenu";
import { useConfirm } from "../../admin/components/useConfirm";
import AppIcon from "../../components/AppIcon";
import SideDrawer from "../../components/SideDrawer";
import { db } from "../../firebase/config";
import type { ResearchIdea } from "../../types";
import { Button, EmptyState, Field, Notice, Spinner, TabHeader, areaClass, buttonClass, fieldClass, formatDate } from "./ui";

const SHORT_LIMIT = 200;

const IdeasTab: React.FC<{
  authorId: string;
  authorName: string;
  authorPhoto: string;
  ideas: ResearchIdea[] | null;
  reload: () => Promise<void>;
}> = ({ authorId, authorName, authorPhoto, ideas, reload }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", shortDescription: "", fullDescription: "", tags: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, confirmElement } = useConfirm();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.shortDescription.trim() || !form.fullDescription.trim()) {
      setError("Title, summary and full description are all required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const now = new Date().toISOString();
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
        authorPhoto,
        commentCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      setForm({ title: "", shortDescription: "", fullDescription: "", tags: "" });
      setOpen(false);
      setNotice("Idea posted — it's now on the Research Ideas page.");
      await reload();
    } catch (err) {
      console.error("Idea post failed", err);
      setError("Couldn't post the idea. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (idea: ResearchIdea) => {
    const ok = await confirm({
      title: "Delete this idea?",
      message: `"${idea.title}" and its discussion will be removed from the site.`,
      confirmLabel: "Delete idea",
      danger: true,
    });
    if (!ok) return;
    await deleteDoc(doc(db, "researchIdeas", idea.id));
    setNotice("Idea deleted.");
    await reload();
  };

  return (
    <div className="pb-10">
      <TabHeader
        title="Research ideas"
        description="Open questions you've shared for discussion with the lab."
        action={
          <Button tone="primary" onClick={() => setOpen(true)}>
            + New idea
          </Button>
        }
      />

      {notice && (
        <div className="mb-3">
          <Notice tone="success" onDismiss={() => setNotice("")}>
            {notice}
          </Notice>
        </div>
      )}

      {ideas === null ? (
        <Spinner label="Loading ideas" />
      ) : ideas.length === 0 ? (
        <EmptyState
          title="No ideas yet"
          text="Post a research question or project idea and invite discussion from the lab."
          action={
            <Button tone="primary" onClick={() => setOpen(true)}>
              + New idea
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-[color:var(--site-border)] overflow-hidden rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <a
                  href={`/research-ideas/${idea.id}`}
                  className="line-clamp-1 text-[13.5px] font-semibold text-[color:var(--site-heading)] no-underline hover:underline"
                >
                  {idea.title}
                </a>
                <p className="mt-0.5 line-clamp-1 text-[12px] text-[color:var(--site-text)]">{idea.shortDescription}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[12px] text-[color:var(--site-muted)]">
                <span className="hidden sm:inline">{formatDate(idea.createdAt)}</span>
                <span className="inline-flex items-center gap-1" title="Comments">
                  <AppIcon name="message" size={13} />
                  <span className="sr-only">Comments:</span>
                  {idea.commentCount ?? 0}
                </span>
                <RowMenu
                  label={`Actions for ${idea.title}`}
                  items={[
                    { label: "Open discussion ↗", onClick: () => window.open(`/research-ideas/${idea.id}`, "_blank", "noopener") },
                    { label: "Delete idea…", danger: true, separated: true, onClick: () => void remove(idea) },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <SideDrawer open={open} onClose={() => !submitting && setOpen(false)} eyebrow="Research ideas" title="New idea">
        <form onSubmit={submit} className="mx-auto max-w-2xl space-y-3 p-4 sm:p-6">
          <Field label="Title" htmlFor="ri-title">
            <input
              id="ri-title"
              required
              className={fieldClass}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="A question worth exploring"
            />
          </Field>
          <Field label="Summary" htmlFor="ri-short" hint={`${form.shortDescription.length}/${SHORT_LIMIT} · shown on the card`}>
            <textarea
              id="ri-short"
              required
              rows={2}
              maxLength={SHORT_LIMIT}
              className={areaClass}
              value={form.shortDescription}
              onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
            />
          </Field>
          <Field label="Full description" htmlFor="ri-full" hint="shown on the idea page">
            <textarea
              id="ri-full"
              required
              rows={8}
              className={areaClass}
              value={form.fullDescription}
              onChange={(e) => setForm((f) => ({ ...f, fullDescription: e.target.value }))}
            />
          </Field>
          <Field label="Topics" htmlFor="ri-tags" hint="comma separated">
            <input
              id="ri-tags"
              className={fieldClass}
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="AI, healthcare"
            />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-end gap-2 border-t border-[color:var(--site-border)] pt-3">
            <Button tone="quiet" disabled={submitting} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <button type="submit" disabled={submitting} className={buttonClass("primary")}>
              {submitting ? "Posting…" : "Post idea"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {confirmElement}
    </div>
  );
};

export default IdeasTab;
