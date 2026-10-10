import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import RowMenu, { type RowMenuItem } from "../../admin/components/RowMenu";
import { useConfirm } from "../../admin/components/useConfirm";
import SideDrawer from "../../components/SideDrawer";
import { db } from "../../firebase/config";
import type { CollaboratorProfile, Publication, PublicationAuthorEntry } from "../../types";
import { Avatar, Button, EmptyState, Field, Notice, Spinner, TabHeader, areaClass, buttonClass, fieldClass } from "./ui";

type AuthorDraft = { mode: "linked" | "external"; uid: string; name: string; affiliation: string };
type PaperForm = {
  title: string;
  journal: string;
  year: number;
  abstract: string;
  doi: string;
  url: string;
  type: "ongoing" | "published";
  tags: string;
  hasLabHeadAuthorship: "yes" | "no";
  authors: AuthorDraft[];
};

const normalizeDoi = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:/, "")
    .trim();

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const splitTags = (value: string) =>
  value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const PublicationsTab: React.FC<{
  profile: CollaboratorProfile;
  papers: Publication[] | null;
  collaborators: CollaboratorProfile[];
  reload: () => Promise<void>;
}> = ({ profile, papers, collaborators, reload }) => {
  const blankForm = (): PaperForm => ({
    title: "",
    journal: "",
    year: new Date().getFullYear(),
    abstract: "",
    doi: "",
    url: "",
    type: "published",
    tags: "",
    hasLabHeadAuthorship: "yes",
    authors: [{ mode: "linked", uid: profile.uid, name: profile.name, affiliation: profile.affiliation ?? "" }],
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paperForm, setPaperForm] = useState<PaperForm>(blankForm);
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "ongoing">("all");
  const { confirm, confirmElement } = useConfirm();

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (papers ?? []).filter(
      (paper) =>
        (filter === "all" || paper.type === filter) &&
        (!term || `${paper.title} ${paper.journal} ${paper.authors} ${paper.year}`.toLowerCase().includes(term)),
    );
  }, [papers, search, filter]);

  const counts = useMemo(
    () => ({
      all: papers?.length ?? 0,
      published: papers?.filter((p) => p.type !== "ongoing").length ?? 0,
      ongoing: papers?.filter((p) => p.type === "ongoing").length ?? 0,
    }),
    [papers],
  );

  /* ------------------------------------------------------------ form */

  const setField = <K extends keyof PaperForm>(key: K, value: PaperForm[K]) => setPaperForm((prev) => ({ ...prev, [key]: value }));

  const updateAuthor = (index: number, key: keyof AuthorDraft, value: string) => {
    setPaperForm((prev) => {
      const authors = [...prev.authors];
      const current = { ...authors[index], [key]: value } as AuthorDraft;
      if (key === "uid" && current.mode === "linked") {
        const linked = collaborators.find((c) => c.uid === value);
        if (linked) {
          current.name = linked.name;
          current.affiliation = linked.affiliation ?? "";
        }
      }
      if (key === "mode" && value === "external") current.uid = "";
      authors[index] = current;
      return { ...prev, authors };
    });
  };

  const openNew = () => {
    setPaperForm(blankForm());
    setEditingPaperId(null);
    setFormError("");
    setDrawerOpen(true);
  };

  const openEdit = (paper: Publication) => {
    const authors: AuthorDraft[] = paper.authorEntries?.length
      ? paper.authorEntries.map((entry) =>
          entry.type === "linked" && entry.uid
            ? { mode: "linked", uid: entry.uid, name: entry.name, affiliation: entry.affiliation || "" }
            : { mode: "external", uid: "", name: entry.name, affiliation: entry.affiliation || "" },
        )
      : blankForm().authors;
    setPaperForm({
      title: paper.title || "",
      journal: paper.journal || "",
      year: paper.year || new Date().getFullYear(),
      abstract: paper.abstract || "",
      doi: paper.doi || "",
      url: paper.url || "",
      type: paper.type || "published",
      tags: (paper.tags ?? []).join(", "),
      hasLabHeadAuthorship: paper.hasLabHeadAuthorship ? "yes" : "no",
      authors,
    });
    setEditingPaperId(paper.id);
    setFormError("");
    setDrawerOpen(true);
  };

  const toAuthorEntries = (): PublicationAuthorEntry[] =>
    paperForm.authors
      .filter((a) => a.name.trim())
      .map((a) => {
        if (a.mode === "linked" && a.uid) {
          const linked = collaborators.find((c) => c.uid === a.uid);
          return {
            type: "linked" as const,
            uid: a.uid,
            name: linked?.name || a.name,
            photo: linked?.photo || "",
            role: "collaborator",
            affiliation: linked?.affiliation || a.affiliation || "",
          };
        }
        return { type: "external" as const, name: a.name.trim(), affiliation: a.affiliation.trim(), role: "external" };
      });

  /* Unchanged from the original portal: new papers are keyed by DOI (or a
     title/year/venue key) so a co-author adding the same paper merges into it. */
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    const title = paperForm.title.trim();
    if (!title) return setFormError("Paper title is required.");
    const authorEntries = toAuthorEntries();
    if (authorEntries.length === 0) return setFormError("Add at least one author.");

    setSubmitting(true);
    try {
      const normalizedDoi = normalizeDoi(paperForm.doi);
      const paperKey = `${normalizeText(paperForm.title)}-${paperForm.year}-${normalizeText(paperForm.journal || "unknown")}`;
      const now = new Date().toISOString();
      const linkedContributorUids = authorEntries.filter((a) => a.type === "linked" && a.uid).map((a) => a.uid as string);
      const joinAuthors = (entries: PublicationAuthorEntry[]) => entries.map((a) => a.name).join(", ");
      const uniqueAuthorEntries = (entries: PublicationAuthorEntry[]) => {
        const byKey = new Map<string, PublicationAuthorEntry>();
        entries.forEach((entry) => {
          const key =
            entry.type === "linked" && entry.uid
              ? `linked:${entry.uid}`
              : `external:${normalizeText(entry.name)}:${normalizeText(entry.affiliation ?? "")}`;
          if (!byKey.has(key)) byKey.set(key, entry);
        });
        return Array.from(byKey.values());
      };
      const fields = {
        title,
        authors: joinAuthors(authorEntries),
        authorEntries,
        journal: paperForm.journal.trim(),
        year: Number(paperForm.year) || new Date().getFullYear(),
        abstract: paperForm.abstract.trim(),
        url: paperForm.url.trim(),
        doi: normalizedDoi,
        type: paperForm.type,
        tags: splitTags(paperForm.tags),
        paperKey,
        hasLabHeadAuthorship: paperForm.hasLabHeadAuthorship === "yes",
        contributorUids: Array.from(new Set(linkedContributorUids)),
      };

      if (editingPaperId) {
        await updateDoc(doc(db, "publications", editingPaperId), { ...fields, updatedAt: now });
      } else {
        const ref = doc(db, "publications", normalizedDoi ? `doi_${normalizeText(normalizedDoi)}` : `key_${paperKey}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, { ...fields, createdByUid: profile.uid, createdAt: now, updatedAt: now });
        } else {
          const existing = snap.data() as Publication;
          const merged = uniqueAuthorEntries([...(existing.authorEntries ?? []), ...authorEntries]);
          await setDoc(
            ref,
            {
              title: existing.title || title,
              authors: joinAuthors(merged),
              authorEntries: merged,
              journal: existing.journal || fields.journal,
              year: existing.year || fields.year,
              abstract: existing.abstract || fields.abstract,
              url: existing.url || fields.url,
              doi: existing.doi || normalizedDoi,
              type: existing.type || fields.type,
              tags: existing.tags?.length ? existing.tags : fields.tags,
              paperKey: existing.paperKey || paperKey,
              hasLabHeadAuthorship: (existing.hasLabHeadAuthorship ?? false) || fields.hasLabHeadAuthorship,
              contributorUids: Array.from(new Set([...(existing.contributorUids ?? []), ...linkedContributorUids])),
              updatedAt: now,
            },
            { merge: true },
          );
        }
      }
      setDrawerOpen(false);
      setNotice({ tone: "success", text: editingPaperId ? "Paper updated." : "Paper saved to your list." });
      setEditingPaperId(null);
      await reload();
    } catch (error) {
      console.error("Paper save failed", error);
      setFormError("Could not save the paper. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ----------------------------------------------------- row actions */

  const deletePaper = async (paper: Publication) => {
    const ok = await confirm({
      title: "Delete this paper?",
      message: `"${paper.title}" will be removed for every co-author.`,
      confirmLabel: "Delete paper",
      danger: true,
    });
    if (!ok) return;
    setBusyId(paper.id);
    try {
      await deleteDoc(doc(db, "publications", paper.id));
      setNotice({ tone: "success", text: "Paper deleted." });
      await reload();
    } catch (error) {
      console.error("Delete paper failed", error);
      setNotice({ tone: "error", text: "Could not delete this paper right now." });
    } finally {
      setBusyId(null);
    }
  };

  const disclaim = async (paper: Publication) => {
    const ok = await confirm({
      title: "Remove your authorship?",
      message: `"${paper.title}" will no longer be linked to your profile. Other co-authors keep it.`,
      confirmLabel: "Remove me",
      danger: true,
    });
    if (!ok) return;
    const entries = paper.authorEntries ?? [];
    const nextEntries = entries.filter((entry) => !(entry.type === "linked" && entry.uid === profile.uid));
    if (entries.length > 0 && nextEntries.length === 0) {
      setNotice({ tone: "error", text: "You're the only author on this paper — ask an admin to delete it instead." });
      return;
    }
    setBusyId(paper.id);
    try {
      const payload: Record<string, unknown> = {
        contributorUids: (paper.contributorUids ?? []).filter((uid) => uid !== profile.uid),
        updatedAt: new Date().toISOString(),
      };
      if (entries.length > 0) {
        payload.authorEntries = nextEntries;
        payload.authors = nextEntries.map((entry) => entry.name).join(", ");
      }
      await updateDoc(doc(db, "publications", paper.id), payload);
      setNotice({ tone: "success", text: "Your authorship was removed." });
      await reload();
    } catch (error) {
      console.error("Unlink paper failed", error);
      setNotice({ tone: "error", text: "Could not remove this paper right now." });
    } finally {
      setBusyId(null);
    }
  };

  const menuFor = (paper: Publication): RowMenuItem[] => {
    const link = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : "");
    const owner = paper.createdByUid === profile.uid;
    return [
      ...(owner ? [{ label: "Edit", onClick: () => openEdit(paper) }] : []),
      ...(link ? [{ label: "Open paper ↗", onClick: () => window.open(link, "_blank", "noopener") }] : []),
      ...(paper.hasLabHeadAuthorship ? [{ label: "View on lab site ↗", onClick: () => window.open(`/publications/${paper.id}`, "_blank", "noopener") }] : []),
      owner
        ? { label: "Delete paper…", danger: true, separated: true, disabled: busyId === paper.id, onClick: () => void deletePaper(paper) }
        : { label: "Remove my authorship…", danger: true, separated: true, disabled: busyId === paper.id, onClick: () => void disclaim(paper) },
    ];
  };

  /* ------------------------------------------------------------ view */

  return (
    <div className="pb-10">
      <TabHeader
        title="Publications"
        description="Papers you've authored. Ones with the lab head as co-author also appear on the lab's Publications page."
        action={
          <Button tone="primary" onClick={openNew}>
            + Add paper
          </Button>
        }
      />

      {notice && (
        <div className="mb-3">
          <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Notice>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your papers…"
          aria-label="Search your papers"
          className={`${fieldClass} h-8 max-w-xs flex-1`}
        />
        <div role="group" aria-label="Filter papers" className="flex rounded-lg border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-0.5">
          {(["all", "published", "ongoing"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`h-7 rounded-md px-2.5 text-[12px] font-semibold capitalize ${
                filter === value ? "bg-[color:var(--site-surface-alt)] text-[color:var(--site-heading)]" : "text-[color:var(--site-muted)]"
              }`}
            >
              {value} <span className="tabular-nums opacity-60">{counts[value]}</span>
            </button>
          ))}
        </div>
      </div>

      {papers === null ? (
        <Spinner label="Loading papers" />
      ) : papers.length === 0 ? (
        <EmptyState
          title="No papers yet"
          text="Add a paper you've co-authored. If a co-author already added it, you'll be linked to the same entry."
          action={
            <Button tone="primary" onClick={openNew}>
              + Add paper
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing matches" text="Try another search or filter." />
      ) : (
        <ul className="divide-y divide-[color:var(--site-border)] overflow-hidden rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
          {visible.map((paper) => (
            <li key={paper.id} className="flex items-start gap-3 px-4 py-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: paper.type === "ongoing" ? "#d97706" : "#059669" }}
                title={paper.type === "ongoing" ? "Ongoing" : "Published"}
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[13.5px] font-semibold text-[color:var(--site-heading)]">{paper.title}</p>
                <p className="mt-0.5 line-clamp-1 text-[12px] text-[color:var(--site-muted)]">
                  <span className="sr-only">{paper.type === "ongoing" ? "Ongoing. " : "Published. "}</span>
                  {[paper.journal, paper.year].filter(Boolean).join(" · ")}
                  {paper.authors ? ` — ${paper.authors}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!paper.hasLabHeadAuthorship && (
                  <span
                    className="hidden rounded-md bg-[color:var(--site-surface-alt)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[color:var(--site-muted)] sm:inline"
                    title="Without the lab head as co-author, this paper shows on your profile only."
                  >
                    Not on lab page
                  </span>
                )}
                {paper.createdByUid !== profile.uid && (
                  <span className="hidden text-[11px] text-[color:var(--site-muted)] md:inline">Linked</span>
                )}
                <RowMenu label={`Actions for ${paper.title}`} items={menuFor(paper)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <SideDrawer
        open={drawerOpen}
        onClose={() => !submitting && setDrawerOpen(false)}
        eyebrow="Publications"
        title={editingPaperId ? "Edit paper" : "Add a paper"}
      >
        <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
          {!editingPaperId && (
            <p className="text-[12.5px] text-[color:var(--site-muted)]">
              If this paper already exists (same DOI, or same title, year and venue), you'll be added to it instead of creating a duplicate.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Title" htmlFor="pp-title" className="sm:col-span-6">
              <input id="pp-title" required className={fieldClass} value={paperForm.title} onChange={(e) => setField("title", e.target.value)} />
            </Field>
            <Field label="Journal / venue" htmlFor="pp-journal" className="sm:col-span-3">
              <input id="pp-journal" className={fieldClass} value={paperForm.journal} onChange={(e) => setField("journal", e.target.value)} />
            </Field>
            <Field label="Year" htmlFor="pp-year" className="sm:col-span-1">
              <input
                id="pp-year"
                type="number"
                min={1950}
                max={2100}
                className={fieldClass}
                value={paperForm.year}
                onChange={(e) => setField("year", Number(e.target.value))}
              />
            </Field>
            <Field label="Status" htmlFor="pp-type" className="sm:col-span-2">
              <select id="pp-type" className={fieldClass} value={paperForm.type} onChange={(e) => setField("type", e.target.value as PaperForm["type"])}>
                <option value="published">Published</option>
                <option value="ongoing">Ongoing</option>
              </select>
            </Field>
            <Field label="DOI" htmlFor="pp-doi" className="sm:col-span-3">
              <input id="pp-doi" className={fieldClass} value={paperForm.doi} onChange={(e) => setField("doi", e.target.value)} placeholder="10.1016/… or doi.org link" />
            </Field>
            <Field label="Paper URL" htmlFor="pp-url" className="sm:col-span-3">
              <input id="pp-url" type="url" className={fieldClass} value={paperForm.url} onChange={(e) => setField("url", e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Abstract" htmlFor="pp-abstract" className="sm:col-span-6">
              <textarea id="pp-abstract" rows={4} className={areaClass} value={paperForm.abstract} onChange={(e) => setField("abstract", e.target.value)} />
            </Field>
            <Field label="Topics" htmlFor="pp-tags" hint="comma separated" className="sm:col-span-4">
              <input id="pp-tags" className={fieldClass} value={paperForm.tags} onChange={(e) => setField("tags", e.target.value)} placeholder="Energy, Optimisation" />
            </Field>
            <Field label="Lab head is a co-author?" htmlFor="pp-labhead" className="sm:col-span-2">
              <select
                id="pp-labhead"
                className={fieldClass}
                value={paperForm.hasLabHeadAuthorship}
                onChange={(e) => setField("hasLabHeadAuthorship", e.target.value as "yes" | "no")}
              >
                <option value="yes">Yes — show on lab page</option>
                <option value="no">No — my profile only</option>
              </select>
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-[color:var(--site-text)]">Authors, in order</p>
              <Button
                tone="quiet"
                onClick={() => setField("authors", [...paperForm.authors, { mode: "external", uid: "", name: "", affiliation: "" }])}
              >
                + Add author
              </Button>
            </div>
            <ol className="space-y-2">
              {paperForm.authors.map((author, index) => (
                <li key={index} className="grid items-center gap-2 sm:grid-cols-[24px_130px_minmax(0,1fr)_minmax(0,1fr)_32px]">
                  <span className="hidden text-center text-[12px] font-semibold tabular-nums text-[color:var(--site-muted)] sm:block">{index + 1}</span>
                  <select
                    aria-label={`Author ${index + 1} type`}
                    className={fieldClass}
                    value={author.mode}
                    onChange={(e) => updateAuthor(index, "mode", e.target.value)}
                  >
                    <option value="linked">Lab member</option>
                    <option value="external">External</option>
                  </select>
                  {author.mode === "linked" ? (
                    <AuthorPicker collaborators={collaborators} value={author.uid} onChange={(uid) => updateAuthor(index, "uid", uid)} />
                  ) : (
                    <input
                      aria-label={`Author ${index + 1} name`}
                      className={fieldClass}
                      placeholder="Full name"
                      value={author.name}
                      onChange={(e) => updateAuthor(index, "name", e.target.value)}
                    />
                  )}
                  <input
                    aria-label={`Author ${index + 1} affiliation`}
                    className={fieldClass}
                    placeholder="Affiliation (optional)"
                    value={author.affiliation}
                    onChange={(e) => updateAuthor(index, "affiliation", e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={`Remove author ${index + 1}`}
                    disabled={paperForm.authors.length === 1}
                    onClick={() => setField("authors", paperForm.authors.filter((_, i) => i !== index))}
                    className="grid h-8 w-8 place-items-center rounded-lg text-[16px] text-[color:var(--site-muted)] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {formError && <Notice tone="error">{formError}</Notice>}

          <div className="flex justify-end gap-2 border-t border-[color:var(--site-border)] pt-3">
            <Button tone="quiet" disabled={submitting} onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <button type="submit" disabled={submitting} className={buttonClass("primary")}>
              {submitting ? "Saving…" : editingPaperId ? "Save changes" : "Save paper"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {confirmElement}
    </div>
  );
};

/** Searchable lab-member picker for linked authors. */
const AuthorPicker: React.FC<{ collaborators: CollaboratorProfile[]; value: string; onChange: (uid: string) => void }> = ({
  collaborators,
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = collaborators.find((c) => c.uid === value) ?? null;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? collaborators.filter((c) => c.name.toLowerCase().includes(term)) : collaborators;
  }, [collaborators, search]);

  const choose = (index: number) => {
    const option = filtered[index];
    if (!option) return;
    onChange(option.uid);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setHighlighted(0);
        }}
        className={`${fieldClass} flex items-center gap-2 text-left`}
      >
        {selected ? (
          <>
            <Avatar name={selected.name} photo={selected.photo} size={20} />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-[color:var(--site-muted)]">Choose a lab member…</span>
        )}
        <span className="ml-auto text-[color:var(--site-muted)]" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[240px] rounded-lg border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-1.5 shadow-xl">
          <input
            autoFocus
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlighted((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlighted((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(highlighted);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            placeholder="Search members…"
            aria-label="Search lab members"
            className={`${fieldClass} mb-1 h-8`}
          />
          <ul role="listbox" className="max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-[12px] text-[color:var(--site-muted)]">No matches.</li>
            ) : (
              filtered.map((c, index) => (
                <li key={c.uid} role="option" aria-selected={c.uid === value}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => choose(index)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-[color:var(--site-heading)] ${
                      highlighted === index ? "bg-[color:var(--site-surface-alt)]" : ""
                    }`}
                  >
                    <Avatar name={c.name} photo={c.photo} size={22} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {c.uid === value && <span aria-hidden="true">✓</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PublicationsTab;
