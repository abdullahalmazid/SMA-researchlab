import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppIcon from "../components/AppIcon";
import { db } from "../firebase/config";
import type { Announcement } from "../types";

/* `linkLabel` exists so the drawer's button can say "Read the paper" or "Apply
   now" instead of a generic "Open link" on every announcement. */

interface Draft {
  title: string;
  content: string;
  body: string;
  category: string;
  link: string;
  linkLabel: string;
  date: string; // yyyy-mm-dd, from <input type="date">
  isPinned: boolean;
}

const SUMMARY_TARGET = 180;

/** Matches NEW_DAYS on the public Announcements page. */
const NEW_DAYS = 21;

const isRecent = (iso: string) => {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && (Date.now() - date.getTime()) / 86_400_000 < NEW_DAYS;
};

const EMPTY_DRAFT = (): Draft => ({
  title: "",
  content: "",
  body: "",
  category: "",
  link: "",
  linkLabel: "",
  date: toDateInput(new Date().toISOString()),
  isPinned: false,
});

/* ------------------------------------------------------------------ dates */

function toDateInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Midday, deliberately. A date input gives a bare yyyy-mm-dd; parsing that as
 * UTC midnight and then rendering it in a timezone behind UTC shows the
 * previous day. Noon has ~12 hours of slack in both directions.
 */
const fromDateInput = (value: string): string =>
  new Date(`${value}T12:00:00`).toISOString();

const fmtDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

/* ------------------------------------------------------------------ text */

function titleOf(post: Announcement): string {
  if (post.title?.trim()) return post.title.trim();
  const first = (post.content || "").split(/(?<=[.!?])\s/)[0]?.trim() ?? "";
  return first.length > 90 ? `${first.slice(0, 88).trimEnd()}…` : first || "Untitled";
}

/** Accept what people paste and repair it rather than rejecting it. */
function normalizeLink(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/* ------------------------------------------------------------------ style */

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2";
const LABEL = "mb-1.5 flex items-baseline gap-2 text-[12.5px] font-semibold text-slate-600";
const BTN =
  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
const BTN_QUIET = `${BTN} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

/* ================================================================= page */

const ManageAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [newCategory, setNewCategory] = useState(false);
  const [preview, setPreview] = useState<"card" | "detail">("card");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "visible" | "hidden" | "pinned">("all");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const composerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  /* ---------------------------------------------------------------- load */

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const snap = await getDocs(query(collection(db, "announcements"), orderBy("order", "asc")));
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement));
    } catch {
      setLoadError("Couldn't load announcements. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* Menus: outside click, Escape, and focus back to the trigger. */
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-menu]") || target.closest("[data-menu-trigger]")) return;
      setMenuFor(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuFor(null);
      menuTriggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  /* ------------------------------------------------------------- derived */

  /**
   * Sorted exactly like the public page, so this list *is* what visitors see —
   * plus the hidden ones. Manual Move Up/Down is gone: it indexed into the
   * unfiltered array while you were looking at a filtered one, so under a
   * search it swapped items with neighbours that weren't on screen. Pinning is
   * the "put this at the top" control now.
   */
  const sorted = useMemo(
    () =>
      [...announcements].sort(
        (a, b) =>
          Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) ||
          String(b.createdAt).localeCompare(String(a.createdAt)),
      ),
    [announcements],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(announcements.map((a) => a.category?.trim()).filter((c): c is string => !!c)),
      ).sort((a, b) => a.localeCompare(b)),
    [announcements],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sorted.filter((post) => {
      if (categoryFilter && post.category !== categoryFilter) return false;
      if (status === "pinned" && !post.isPinned) return false;
      if (status === "hidden" && !post.isHidden) return false;
      if (status === "visible" && post.isHidden) return false;
      if (!term) return true;
      return [titleOf(post), post.content, post.body, post.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [sorted, search, status, categoryFilter]);

  const stats = useMemo(
    () => ({
      total: announcements.length,
      pinned: announcements.filter((a) => a.isPinned).length,
      hidden: announcements.filter((a) => a.isHidden).length,
      noBody: announcements.filter((a) => !a.body?.trim()).length,
    }),
    [announcements],
  );

  /* ------------------------------------------------------------ composer */

  const openComposer = (post?: Announcement) => {
    setFormError("");
    setActionError("");
    setPreview("card");
    setNewCategory(false);
    if (post) {
      setEditingId(post.id);
      setDraft({
        title: post.title ?? "",
        content: post.content ?? "",
        body: post.body ?? "",
        category: post.category ?? "",
        link: post.link ?? "",
        linkLabel: post.linkLabel ?? "",
        date: toDateInput(post.createdAt),
        isPinned: Boolean(post.isPinned),
      });
    } else {
      setEditingId(null);
      setDraft(EMPTY_DRAFT());
    }
    setComposerOpen(true);
    setMenuFor(null);
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      titleRef.current?.focus();
    });
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT());
    setFormError("");
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async (publish: boolean) => {
    if (!draft.title.trim()) {
      setFormError("Give the announcement a title — it's the headline everywhere it appears.");
      titleRef.current?.focus();
      return;
    }
    if (!draft.content.trim()) {
      setFormError("Write a summary. It's the line people read in the list and on the homepage.");
      return;
    }

    setFormError("");
    setSaving(true);
    const now = new Date().toISOString();
    const payload = {
      title: draft.title.trim(),
      content: draft.content.trim(),
      body: draft.body.trim(),
      category: draft.category.trim(),
      link: normalizeLink(draft.link),
      linkLabel: draft.linkLabel.trim(),
      createdAt: fromDateInput(draft.date),
      updatedAt: now,
      isPinned: draft.isPinned,
      isHidden: !publish,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "announcements", editingId), payload);
        /* Patch local state rather than refetching the collection on every
           action — cheaper, and the list stops flickering. */
        setAnnouncements((prev) =>
          prev.map((post) => (post.id === editingId ? { ...post, ...payload } : post)),
        );
      } else {
        const order = announcements.reduce((max, a) => Math.max(max, a.order ?? 0), 0) + 1;
        const created = await addDoc(collection(db, "announcements"), { ...payload, order });
        setAnnouncements((prev) => [...prev, { id: created.id, order, ...payload } as Announcement]);
      }
      closeComposer();
    } catch {
      /* The draft stays in the form, so nothing typed is lost. */
      setFormError("Saving failed. Your text is still here — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------------- actions */

  const patch = async (post: Announcement, changes: Partial<Announcement>, failure: string) => {
    setBusyId(post.id);
    setActionError("");
    setMenuFor(null);
    const next = { ...changes, updatedAt: new Date().toISOString() };
    try {
      await updateDoc(doc(db, "announcements", post.id), next);
      setAnnouncements((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...next } : p)));
    } catch {
      setActionError(failure);
      void load(); // resync, since local state may now be a lie
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (post: Announcement) => {
    setBusyId(post.id);
    setActionError("");
    try {
      await deleteDoc(doc(db, "announcements", post.id));
      setAnnouncements((prev) => prev.filter((p) => p.id !== post.id));
      setConfirmDelete(null);
    } catch {
      setActionError("Couldn't delete that one. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  /* -------------------------------------------------------------- preview */

  /* Cast, not annotated. This is a display-only stand-in for the preview — it
     has no Firestore record behind it, so bookkeeping fields the real type
     requires (order, updatedAt) have no meaningful value here. */
  const previewPost = {
    id: "preview",
    order: 0,
    createdAt: fromDateInput(draft.date),
    content: draft.content || "Your summary appears here.",
    title: draft.title,
    body: draft.body,
    category: draft.category,
    link: draft.link,
    linkLabel: draft.linkLabel,
    isPinned: draft.isPinned,
  } as Announcement;

  const previewBadges = (
    <div className="flex flex-wrap items-center gap-2">
      {draft.isPinned && (
        <span className="rounded-[5px] border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-amber-700">
          Pinned
        </span>
      )}
      {/* Only for the first 21 days, same as the public page — the preview
          used to claim "New" on a back-dated announcement. */}
      {isRecent(fromDateInput(draft.date)) && (
        <span className="rounded-[5px] border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-teal-700">
          New
        </span>
      )}
      {draft.category && (
        <span className="rounded-[5px] bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
          {draft.category}
        </span>
      )}
    </div>
  );

  /* ----------------------------------------------------------------- view */

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black" style={{ color: "var(--color-primary)" }}>
            Announcements
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Shown on the Announcements page and in Latest Updates on Home.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {stats.total} total · {stats.pinned} pinned · {stats.hidden} draft
            {stats.noBody > 0 && ` · ${stats.noBody} with no detail text`}
          </p>
        </div>

        {!composerOpen && (
          <button
            type="button"
            onClick={() => openComposer()}
            className={`${BTN} text-white`}
            style={{ background: "var(--color-primary)" }}
          >
            <span aria-hidden="true">+</span> New announcement
          </button>
        )}
      </div>

      {loadError && (
        <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}{" "}
          <button type="button" onClick={() => void load()} className="font-bold underline">
            Retry
          </button>
        </p>
      )}
      {actionError && (
        <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {/* ------------------------------------------------------- composer */}
      {composerOpen && (
        <div
          ref={composerRef}
          className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 flex items-center gap-3">
            <h3 className="text-[15px] font-bold text-slate-900">
              {editingId ? "Edit announcement" : "New announcement"}
            </h3>
            <button type="button" onClick={closeComposer} className={`${BTN_QUIET} ml-auto py-1.5`}>
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
            {/* ------------------------------------------------- the form */}
            <div>
              {formError && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] font-medium text-red-700"
                >
                  {formError}
                </p>
              )}

              <div className="mb-4">
                <label className={LABEL} htmlFor="ann-title">
                  Title
                </label>
                <input
                  id="ann-title"
                  ref={titleRef}
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Paper accepted at IEEE ICCIT 2026"
                  className={INPUT}
                />
              </div>

              <div className="mb-4">
                <label className={LABEL} htmlFor="ann-summary">
                  Summary
                  <span
                    className={`ml-auto text-[11.5px] tabular-nums ${
                      draft.content.length > SUMMARY_TARGET
                        ? "font-semibold text-amber-700"
                        : "text-slate-400"
                    }`}
                  >
                    {draft.content.length} / {SUMMARY_TARGET}
                  </span>
                </label>
                <textarea
                  id="ann-summary"
                  rows={3}
                  value={draft.content}
                  onChange={(e) => set("content", e.target.value)}
                  aria-describedby="ann-summary-hint"
                  placeholder="One or two sentences — this is the line people read before clicking."
                  className={`${INPUT} resize-y`}
                />
                <p id="ann-summary-hint" className="mt-1.5 text-[11.5px] leading-normal text-slate-400">
                  Shown in the list and on the homepage, clamped to two lines. Around{" "}
                  {SUMMARY_TARGET} characters fits.
                </p>
              </div>

              <div className="mb-4">
                <label className={LABEL} htmlFor="ann-body">
                  Full text <span className="font-medium text-slate-400">optional</span>
                </label>
                <textarea
                  id="ann-body"
                  rows={8}
                  value={draft.body}
                  onChange={(e) => set("body", e.target.value)}
                  aria-describedby="ann-body-hint"
                  placeholder={"The whole story.\n\nLeave a blank line between paragraphs."}
                  className={`${INPUT} resize-y leading-relaxed`}
                />
                <p id="ann-body-hint" className="mt-1.5 text-[11.5px] leading-normal text-slate-400">
                  What the detail panel shows. Leave it empty and the panel repeats the summary —
                  switch the preview to <strong>Detail</strong> to see the difference.
                </p>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="ann-date">
                    Date
                  </label>
                  <input
                    id="ann-date"
                    type="date"
                    value={draft.date}
                    onChange={(e) => set("date", e.target.value)}
                    aria-describedby="ann-date-hint"
                    className={INPUT}
                  />
                  <p id="ann-date-hint" className="mt-1.5 text-[11.5px] text-slate-400">
                    Sorts the list. Back-date it for something that already happened.
                  </p>
                </div>

                <div>
                  <label className={LABEL} htmlFor="ann-category">
                    Category <span className="font-medium text-slate-400">optional</span>
                  </label>
                  {newCategory ? (
                    <div className="flex gap-2">
                      <input
                        id="ann-category"
                        value={draft.category}
                        onChange={(e) => set("category", e.target.value)}
                        placeholder="e.g. Recruitment"
                        className={INPUT}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setNewCategory(false);
                          set("category", "");
                        }}
                        className={`${BTN_QUIET} px-3`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <select
                      id="ann-category"
                      value={draft.category}
                      onChange={(e) => {
                        if (e.target.value === "__new") {
                          setNewCategory(true);
                          set("category", "");
                        } else {
                          set("category", e.target.value);
                        }
                      }}
                      className={INPUT}
                    >
                      <option value="">No category</option>
                      {categories.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value="__new">+ New category…</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="ann-link">
                    Link <span className="font-medium text-slate-400">optional</span>
                  </label>
                  <input
                    id="ann-link"
                    type="url"
                    inputMode="url"
                    value={draft.link}
                    onChange={(e) => set("link", e.target.value)}
                    onBlur={() => set("link", normalizeLink(draft.link))}
                    placeholder="doi.org/10.1109/…"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="ann-link-label">
                    Button text
                  </label>
                  <input
                    id="ann-link-label"
                    value={draft.linkLabel}
                    onChange={(e) => set("linkLabel", e.target.value)}
                    placeholder="Read the paper"
                    disabled={!draft.link.trim()}
                    className={`${INPUT} disabled:bg-slate-50 disabled:text-slate-400`}
                  />
                </div>
              </div>

              <label className="mb-5 flex w-fit items-center gap-2.5 text-[13px] font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={draft.isPinned}
                  onChange={(e) => set("isPinned", e.target.checked)}
                  className="h-4 w-4"
                />
                Pin to the top of the list
              </label>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                {/* Two buttons, not one. Writing a long announcement over two
                    sittings shouldn't mean publishing it half-finished. */}
                <button
                  type="button"
                  onClick={() => void save(true)}
                  disabled={saving}
                  className={`${BTN} text-white`}
                  style={{ background: "var(--color-primary)" }}
                >
                  {saving ? "Saving…" : editingId ? "Save and publish" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => void save(false)}
                  disabled={saving}
                  className={BTN_QUIET}
                >
                  Save as draft
                </button>
                <p className="text-[12px] text-slate-400">
                  Drafts are hidden from the website until you publish them.
                </p>
              </div>
            </div>

            {/* ---------------------------------------------- live preview */}
            {/* The form can't otherwise tell you which field lands where: the
                summary is the list, the full text is the panel behind it. */}
            <div>
              <div className="sticky top-6">
                <div className="mb-3 flex items-center gap-2">
                  <h4 className="text-[13px] font-bold text-slate-700">Preview</h4>
                  <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-0.5">
                    {(["card", "detail"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setPreview(tab)}
                        aria-pressed={preview === tab}
                        className={`rounded-md px-2.5 py-1 text-[12px] font-semibold capitalize transition ${
                          preview === tab
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {preview === "card" ? (
                  <div
                    className="rounded-2xl border border-l-4 border-slate-200 bg-white px-5 py-[18px]"
                    style={{
                      borderLeftColor: draft.isPinned ? "var(--color-accent)" : "#cbd5e1",
                    }}
                  >
                    <div className="mb-[7px] flex flex-wrap items-center gap-2">
                      {previewBadges}
                      <span className="text-[12px] tabular-nums text-slate-400">
                        {fmtDate(previewPost.createdAt)}
                      </span>
                    </div>
                    <p
                      className="text-[17px] font-bold leading-snug text-slate-900"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {titleOf(previewPost)}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-slate-600">
                      {previewPost.content}
                    </p>
                    <p
                      className="mt-2.5 text-[12px] font-bold"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      Read more →
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-5 py-3 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                      Announcement
                    </div>
                    <div className="max-h-[460px] overflow-y-auto px-5 py-5">
                      {previewBadges}
                      <p
                        className="mt-3 text-[22px] font-black leading-tight text-slate-900"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {titleOf(previewPost)}
                      </p>
                      <p className="mt-2.5 text-[12.5px] text-slate-400">
                        {fmtDate(previewPost.createdAt)}
                      </p>
                      <div className="mt-5 whitespace-pre-line text-[14.5px] leading-[1.85] text-slate-600">
                        {draft.body.trim() || previewPost.content}
                      </div>
                      {!draft.body.trim() && (
                        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                          No full text yet, so the panel is repeating the summary.
                        </p>
                      )}
                      {draft.link.trim() && (
                        <span
                          className="mt-6 inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-bold text-white"
                          style={{ background: "var(--color-primary)" }}
                        >
                          {draft.linkLabel.trim() || "Open link"} <span aria-hidden="true">↗</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- filters */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <label htmlFor="ann-search" className="sr-only">
            Search announcements
          </label>
          <input
            id="ann-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, summary or full text…"
            className={INPUT}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${stats.total})`],
              ["visible", `Published (${stats.total - stats.hidden})`],
              ["hidden", `Drafts (${stats.hidden})`],
              ["pinned", `Pinned (${stats.pinned})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className="rounded-lg border px-3 py-2 text-xs font-semibold transition"
              style={{
                borderColor: status === value ? "transparent" : "#d1d5db",
                background: status === value ? "var(--color-primary)" : "white",
                color: status === value ? "white" : "#374151",
              }}
            >
              {label}
            </button>
          ))}

          {categories.length > 0 && (
            <>
              <label htmlFor="ann-category-filter" className="sr-only">
                Filter by category
              </label>
              <select
                id="ann-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <option value="">All categories</option>
                {categories.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[70px] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center">
          <p className="text-[15px] font-semibold text-slate-600">
            {announcements.length === 0 ? "No announcements yet" : "Nothing matches those filters"}
          </p>
          <p className="mt-1.5 text-[13px] text-slate-400">
            {announcements.length === 0
              ? "Write the first one — it'll appear on the website as soon as you publish."
              : "Try a different status or search term."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((post) => {
            const busy = busyId === post.id;
            return (
              <li
                key={post.id}
                className="relative rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-2 w-2 flex-none rounded-full"
                    style={{
                      background: post.isHidden
                        ? "#cbd5e1"
                        : post.isPinned
                          ? "var(--color-accent)"
                          : "#10b981",
                    }}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-bold text-slate-900">
                      {titleOf(post)}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[12.5px] text-slate-500">
                      {post.content}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-slate-400">
                      <span className="tabular-nums">{fmtDate(post.createdAt)}</span>
                      {post.category && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{post.category}</span>
                        </>
                      )}
                      {post.isHidden && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-slate-500">Draft</span>
                        </>
                      )}
                      {post.isPinned && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-amber-700">Pinned</span>
                        </>
                      )}
                      {/* Tells you at a glance which ones open a panel with
                          nothing more in it than the card already showed. */}
                      {!post.body?.trim() && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>No full text</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="relative flex-none">
                    <button
                      type="button"
                      data-menu-trigger
                      aria-haspopup="menu"
                      aria-expanded={menuFor === post.id}
                      aria-label={`Actions for ${titleOf(post)}`}
                      disabled={busy}
                      onClick={(event) => {
                        menuTriggerRef.current = event.currentTarget;
                        setMenuFor((prev) => (prev === post.id ? null : post.id));
                      }}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)]"
                    >
                      <AppIcon name="more" size={18} />
                    </button>

                    {menuFor === post.id && (
                      <div
                        data-menu
                        role="menu"
                        className="absolute right-0 top-full z-[500] mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => openComposer(post)}
                          className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            void patch(post, { isPinned: !post.isPinned }, "Couldn't change the pin.")
                          }
                          className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                        >
                          {post.isPinned ? "Unpin" : "Pin to top"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            void patch(
                              post,
                              { isHidden: !post.isHidden },
                              "Couldn't change whether it's published.",
                            )
                          }
                          className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                        >
                          {post.isHidden ? "Publish" : "Move to drafts"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setConfirmDelete(post.id);
                            setMenuFor(null);
                          }}
                          className="block w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* In-row confirm rather than window.confirm: it names what's
                    being deleted, and it can't be dismissed by muscle memory. */}
                {confirmDelete === post.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                    <p className="text-[13px] font-medium text-red-800">
                      Delete “{titleOf(post)}” permanently?
                    </p>
                    <div className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => void remove(post)}
                        disabled={busy}
                        className={`${BTN} bg-red-600 px-3 py-1.5 text-white hover:bg-red-700`}
                      >
                        {busy ? "Deleting…" : "Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className={`${BTN_QUIET} px-3 py-1.5`}
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ManageAnnouncements;
