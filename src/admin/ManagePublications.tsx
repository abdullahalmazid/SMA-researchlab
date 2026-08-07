import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import AppIcon from "../components/AppIcon";
import { db } from "../firebase/config";
import type { CollaboratorProfile, Publication, PublicationAuthorEntry } from "../types";

/* ------------------------------------------------------------------ *
 * Publication identity
 *
 * Kept local so this screen builds on its own. `hooks.ts` carries the same
 * four functions for the read side — if you change the rules here, change them
 * there too, or the two will disagree about whether two records are the same
 * paper.
 * ------------------------------------------------------------------ */

const slug = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Accepts a bare DOI, a doi: prefix, or a doi.org URL. */
const normalizeDoi = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:/, "")
    .trim();

/** Title-year-journal: the fallback identity for papers with no DOI. */
const paperKeyOf = (title: string, year: number | string, journal: string): string =>
  slug(`${title}-${year}-${journal || "unknown"}`);

/**
 * The document id every writer must use. Two screens computing this
 * differently is what let one paper land in `doi_…` from one form and `key_…`
 * from another, with nothing to make them collide.
 */
const canonicalPublicationId = (doi: string, paperKey: string): string =>
  doi ? `doi_${slug(normalizeDoi(doi))}` : `key_${paperKey}`;

/** Every alias a record answers to, so a match can be found by any of them. */
const publicationKeys = (publication: Publication): string[] => {
  const keys: string[] = [];
  const doi = slug(normalizeDoi(publication.doi ?? ""));
  const paperKey = slug(publication.paperKey ?? "");
  const derived = slug(
    `${publication.title}-${publication.year}-${publication.journal ?? ""}`,
  );
  if (doi) keys.push(`doi:${doi}`);
  if (paperKey) keys.push(`key:${paperKey}`);
  if (derived) keys.push(`key:${derived}`);
  return keys.length ? keys : [`id:${publication.id}`];
};

type Draft = Omit<Publication, "id" | "createdAt"> & { id?: string };

const emptyPub = (): Draft => ({
  title: "",
  authors: "",
  journal: "",
  year: new Date().getFullYear(),
  abstract: "",
  url: "",
  doi: "",
  type: "published",
  tags: [],
  hasLabHeadAuthorship: true,
  paperKey: "",
  authorEntries: [],
  contributorUids: [],
});

const ManagePublications: React.FC = () => {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [collaborators, setCollaborators] = useState<CollaboratorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; data: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "ongoing" | "published">("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formError, setFormError] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [pubSnap, collabSnap] = await Promise.all([
        getDocs(query(collection(db, "publications"), orderBy("year", "desc"))),
        getDocs(collection(db, "collaborators")),
      ]);
      setPublications(pubSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Publication));
      setCollaborators(
        collabSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CollaboratorProfile)
          .filter((c) => c.uid && c.name)
          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
      );
    } catch (error) {
      setNotice({
        type: "error",
        text: `Couldn't load publications: ${String((error as Error).message || error)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const nameByUid = useMemo(() => {
    const map: Record<string, string> = {};
    collaborators.forEach((c) => {
      if (c.uid) map[c.uid] = c.name ?? c.uid;
    });
    return map;
  }, [collaborators]);

  /**
   * Records that share an identity key with another record. The portal writes
   * `doi_<doi>` when a DOI is given and `key_<title-year-journal>` when it
   * isn't, so one paper entered both ways produced two documents that could
   * never collide. Flagging them here is how you find the ones already in the
   * database — new writes can no longer create them.
   */
  const duplicateIds = useMemo(() => {
    const byKey = new Map<string, string[]>();
    publications.forEach((publication) => {
      publicationKeys(publication).forEach((key: string) => {
        byKey.set(key, [...(byKey.get(key) ?? []), publication.id]);
      });
    });
    const flagged = new Set<string>();
    byKey.forEach((ids) => {
      const unique = Array.from(new Set(ids));
      if (unique.length > 1) unique.forEach((id) => flagged.add(id));
    });
    return flagged;
  }, [publications]);

  /* --------------------------------------------------------------- modal */

  const openModal = (mode: "add" | "edit", data: Draft) => {
    setFormError("");
    setModal({ mode, data });
    setOpenMenuId(null);
    window.requestAnimationFrame(() => titleRef.current?.focus());
  };

  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setModal(null);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "input:not(:disabled), select, textarea, button:not(:disabled)",
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modal, saving]);

  const setField = (key: string, value: unknown) =>
    setModal((current) => (current ? { ...current, data: { ...current.data, [key]: value } } : null));

  const toggleAuthor = (collaborator: CollaboratorProfile) => {
    setModal((current) => {
      if (!current) return null;
      const uids = current.data.contributorUids ?? [];
      const linked = uids.includes(collaborator.uid);
      const nextUids = linked
        ? uids.filter((uid) => uid !== collaborator.uid)
        : [...uids, collaborator.uid];

      /* Both fields, every time. Profiles match on either, and records that
         carry only one of them are exactly the ones that go missing. */
      const externals = (current.data.authorEntries ?? []).filter(
        (entry) => entry.type !== "linked",
      );
      const linkedEntries: PublicationAuthorEntry[] = nextUids.map((uid) => {
        const person = collaborators.find((c) => c.uid === uid);
        return {
          type: "linked",
          uid,
          name: person?.name ?? uid,
          photo: person?.photo ?? "",
          affiliation: person?.affiliation ?? "",
          role: "collaborator",
        };
      });

      return {
        ...current,
        data: {
          ...current.data,
          contributorUids: nextUids,
          authorEntries: [...linkedEntries, ...externals],
        },
      };
    });
  };

  /** Any other record that would answer to the same identity. */
  const findExisting = (draft: Draft) => {
    const probe: Publication = {
      ...(draft as Publication),
      id: draft.id ?? "__new__",
      createdAt: "",
    };
    const keys = new Set(publicationKeys(probe));
    return publications.find(
      (publication) =>
        publication.id !== draft.id &&
        publicationKeys(publication).some((key: string) => keys.has(key)),
    );
  };

  const save = async () => {
    if (!modal) return;
    const draft = modal.data;
    const title = (draft.title ?? "").trim();

    if (!title) {
      setFormError("A title is required.");
      titleRef.current?.focus();
      return;
    }

    const doi = normalizeDoi(draft.doi ?? "");
    const paperKey = paperKeyOf(title, draft.year, draft.journal ?? "");

    /* Refuse to create a second copy of something already on file. */
    if (modal.mode === "add") {
      const existing = findExisting({ ...draft, title, doi, paperKey });
      if (existing) {
        setFormError(
          `"${existing.title}" (${existing.year}) is already recorded. Edit that entry instead of adding a second copy.`,
        );
        return;
      }
    }

    setFormError("");
    setSaving(true);
    const now = new Date().toISOString();

    const payload = {
      title,
      authors: (draft.authors ?? "").trim(),
      journal: (draft.journal ?? "").trim(),
      year: Number(draft.year) || new Date().getFullYear(),
      abstract: (draft.abstract ?? "").trim(),
      url: (draft.url ?? "").trim(),
      doi,
      type: draft.type,
      tags: draft.tags ?? [],
      hasLabHeadAuthorship: draft.hasLabHeadAuthorship ?? true,
      /* Written on every record, so a later match can find it by either route. */
      paperKey,
      contributorUids: draft.contributorUids ?? [],
      authorEntries: draft.authorEntries ?? [],
      updatedAt: now,
    };

    try {
      if (modal.mode === "add") {
        /* setDoc at a computed id, not addDoc at a random one. Two admins
           entering the same paper now overwrite one document instead of
           creating two that nothing can reconcile. */
        const id = canonicalPublicationId(doi, paperKey);
        await setDoc(doc(db, "publications", id), { ...payload, createdAt: now }, { merge: true });
      } else if (draft.id) {
        await updateDoc(doc(db, "publications", draft.id), payload);
      }
      setModal(null);
      setNotice({ type: "success", text: `"${title}" saved.` });
      await load();
    } catch (error) {
      setFormError(
        `Saving failed: ${String((error as Error).message || error)}. Your entry is still here.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (publication: Publication) => {
    setDeletingId(publication.id);
    try {
      await deleteDoc(doc(db, "publications", publication.id));
      setPublications((current) => current.filter((item) => item.id !== publication.id));
      setConfirmDeleteId(null);
      setNotice({ type: "success", text: `"${publication.title}" deleted.` });
    } catch (error) {
      setNotice({
        type: "error",
        text: `Couldn't delete: ${String((error as Error).message || error)}`,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const patch = async (publication: Publication, changes: Partial<Publication>) => {
    setOpenMenuId(null);
    try {
      const next = { ...changes, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, "publications", publication.id), next);
      setPublications((current) =>
        current.map((item) => (item.id === publication.id ? { ...item, ...next } : item)),
      );
    } catch (error) {
      setNotice({
        type: "error",
        text: `Couldn't update: ${String((error as Error).message || error)}`,
      });
      void load();
    }
  };

  const filtered = publications.filter((publication) => {
    if (filterType !== "all" && publication.type !== filterType) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [publication.title, publication.authors, publication.journal, publication.doi]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "#e5e7eb" };

  /* ---------------------------------------------------------------- view */

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black" style={{ color: "var(--color-primary)" }}>
            Manage Publications
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {publications.length} publications total
            {duplicateIds.size > 0 && ` · ${duplicateIds.size} possible duplicates`}
          </p>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {duplicateIds.size > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-black">{duplicateIds.size} records</strong> share a DOI or
          title with another entry — they&apos;re marked below. The website already merges them
          when displaying, so this is housekeeping rather than urgent: open each pair, keep the
          fuller one, and delete the other.
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(["all", "ongoing", "published"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filterType === value}
              onClick={() => setFilterType(value)}
              className="cursor-pointer rounded-xl border px-4 py-1.5 text-sm font-semibold capitalize"
              style={{
                background: filterType === value ? "var(--color-primary)" : "white",
                color: filterType === value ? "white" : "#374151",
                borderColor: filterType === value ? "var(--color-primary)" : "#e5e7eb",
              }}
            >
              {value} (
              {value === "all"
                ? publications.length
                : publications.filter((p) => p.type === value).length}
              )
            </button>
          ))}
        </div>

        <div className="min-w-[220px] flex-1">
          <label htmlFor="pub-search" className="sr-only">
            Search publications
          </label>
          <input
            id="pub-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, author, journal or DOI…"
            className={inp}
            style={inpStyle}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => openModal("add", emptyPub())}
            className="w-full rounded-2xl border-2 border-dashed px-4 py-4 text-left transition-all"
            style={{
              borderColor: "#cbd5e1",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(238,245,241,0.98) 100%)",
            }}
          >
            <span className="inline-flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ background: "var(--color-primary)" }}
              >
                <span className="text-2xl leading-none">+</span>
              </span>
              <span>
                <span className="block text-sm font-black text-gray-900">Add Publication</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  Create a new canonical paper record
                </span>
              </span>
            </span>
          </button>

          {filtered.map((publication) => (
            <div
              key={publication.id}
              className="rounded-2xl border bg-white p-4 shadow-sm"
              style={{
                borderColor: duplicateIds.has(publication.id) ? "#fcd34d" : "#e5e7eb",
                borderLeft: `4px solid ${publication.type === "ongoing" ? "#f59e0b" : "#2563eb"}`,
              }}
            >
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{
                        background: publication.type === "ongoing" ? "#fef3c7" : "#dbeafe",
                        color: publication.type === "ongoing" ? "#92400e" : "#1e40af",
                      }}
                    >
                      {publication.type}
                    </span>
                    <span className="text-xs text-gray-500">{publication.year}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        background: publication.hasLabHeadAuthorship ? "#dcfce7" : "#fee2e2",
                        color: publication.hasLabHeadAuthorship ? "#166534" : "#991b1b",
                      }}
                    >
                      {publication.hasLabHeadAuthorship ? "lab-head yes" : "lab-head no"}
                    </span>
                    {duplicateIds.has(publication.id) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        possible duplicate
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-bold leading-snug text-gray-900">
                    {publication.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">{publication.authors}</p>
                  <p
                    className="mt-0.5 text-xs font-medium"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {publication.journal}
                  </p>

                  {/* Names, not a count. "Linked: 2" doesn't tell you whether
                      the right two people will see it on their profiles. */}
                  <p className="mt-1.5 text-xs text-gray-500">
                    {(publication.contributorUids?.length ?? 0) === 0 ? (
                      <span className="font-semibold text-amber-700">
                        No lab authors linked — this won&apos;t appear on anyone&apos;s profile
                      </span>
                    ) : (
                      <>
                        Linked:{" "}
                        {publication.contributorUids
                          ?.map((uid) => nameByUid[uid] ?? uid)
                          .join(", ")}
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Added by{" "}
                    {publication.createdByUid
                      ? nameByUid[publication.createdByUid] || publication.createdByUid
                      : "an administrator"}
                    {publication.doi ? ` · ${publication.doi}` : ""}
                  </p>
                </div>

                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === publication.id}
                    aria-label={`Actions for ${publication.title}`}
                    onClick={() =>
                      setOpenMenuId((current) =>
                        current === publication.id ? null : publication.id,
                      )
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  >
                    <AppIcon name="more" size={16} />
                  </button>

                  {openMenuId === publication.id && (
                    <div
                      role="menu"
                      className="absolute right-0 top-10 z-[500] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openModal("edit", publication)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <AppIcon name="about" size={14} />
                        Edit paper
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void patch(publication, {
                            type: publication.type === "ongoing" ? "published" : "ongoing",
                          })
                        }
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <AppIcon name="publications" size={14} />
                        {publication.type === "ongoing" ? "Mark as published" : "Mark as ongoing"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void patch(publication, {
                            hasLabHeadAuthorship: !(publication.hasLabHeadAuthorship ?? false),
                          })
                        }
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <AppIcon name="user" size={14} />
                        {publication.hasLabHeadAuthorship
                          ? "Set lab-head: no"
                          : "Set lab-head: yes"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setConfirmDeleteId(publication.id);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        <AppIcon name="logout" size={14} />
                        Delete paper
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {confirmDeleteId === publication.id && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-[13px] font-medium text-red-900">
                    Delete this paper for everyone
                    {(publication.contributorUids?.length ?? 0) > 1 &&
                      `, including the ${publication.contributorUids?.length} linked authors`}
                    ?
                  </p>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      disabled={deletingId === publication.id}
                      onClick={() => void remove(publication)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      {deletingId === publication.id ? "Deleting…" : "Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700"
                    >
                      Keep
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="py-10 text-center text-gray-500">No publications found.</p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ modal */}
      {modal && (
        <div
          className="fixed inset-0 z-[2147482000] flex items-start justify-center overflow-y-auto p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => !saving && setModal(null)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="publication-dialog-title"
            className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ background: "var(--color-primary)" }}
            >
              <h3 id="publication-dialog-title" className="text-lg font-black text-white">
                {modal.mode === "add" ? "Add Publication" : "Edit Publication"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close"
                className="cursor-pointer border-none bg-transparent text-2xl text-white"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-4 p-6">
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
                >
                  {formError}
                </p>
              )}

              <div>
                <label htmlFor="pub-title" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Title *
                </label>
                <input
                  id="pub-title"
                  ref={titleRef}
                  className={inp}
                  style={inpStyle}
                  value={modal.data.title ?? ""}
                  onChange={(event) => setField("title", event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="pub-authors" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Authors (as printed)
                </label>
                <input
                  id="pub-authors"
                  className={inp}
                  style={inpStyle}
                  value={modal.data.authors ?? ""}
                  onChange={(event) => setField("authors", event.target.value)}
                  placeholder="Rahman, M.R., Siddiqui, A., …"
                />
              </div>

              {/* Without this, an admin-created paper has no uid on it, so it
                  can never appear on a collaborator's profile — the profile
                  page matches on contributorUids or a linked authorEntry. */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-gray-600">
                  Lab authors{" "}
                  <span className="font-normal text-gray-400">
                    — tick everyone whose profile should list this paper
                  </span>
                </p>
                <div
                  className="max-h-44 overflow-y-auto rounded-xl border p-2"
                  style={inpStyle}
                >
                  {collaborators.length === 0 ? (
                    <p className="p-2 text-xs text-gray-400">No collaborator profiles found.</p>
                  ) : (
                    collaborators.map((collaborator) => {
                      const checked = (modal.data.contributorUids ?? []).includes(
                        collaborator.uid,
                      );
                      return (
                        <label
                          key={collaborator.uid}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAuthor(collaborator)}
                            className="h-4 w-4 accent-[var(--color-primary)]"
                          />
                          <span className="text-sm text-slate-800">{collaborator.name}</span>
                          <span className="ml-auto text-[11px] text-slate-400">
                            {collaborator.designation}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pub-journal" className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Journal / Venue
                  </label>
                  <input
                    id="pub-journal"
                    className={inp}
                    style={inpStyle}
                    value={modal.data.journal ?? ""}
                    onChange={(event) => setField("journal", event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="pub-year" className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Year
                  </label>
                  <input
                    id="pub-year"
                    type="number"
                    className={inp}
                    style={inpStyle}
                    value={modal.data.year}
                    onChange={(event) => setField("year", Number(event.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pub-type" className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Type
                  </label>
                  <select
                    id="pub-type"
                    className={inp}
                    style={inpStyle}
                    value={modal.data.type}
                    onChange={(event) => setField("type", event.target.value)}
                  >
                    <option value="published">Published</option>
                    <option value="ongoing">Ongoing</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pub-doi" className="mb-1.5 block text-xs font-semibold text-gray-600">
                    DOI
                  </label>
                  <input
                    id="pub-doi"
                    className={inp}
                    style={inpStyle}
                    value={modal.data.doi ?? ""}
                    onChange={(event) => setField("doi", event.target.value)}
                    onBlur={(event) => setField("doi", normalizeDoi(event.target.value))}
                    placeholder="10.1000/xyz123"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pub-labhead" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Lab-head authorship
                </label>
                <select
                  id="pub-labhead"
                  className={inp}
                  style={inpStyle}
                  value={modal.data.hasLabHeadAuthorship ? "yes" : "no"}
                  onChange={(event) =>
                    setField("hasLabHeadAuthorship", event.target.value === "yes")
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <p className="mt-1.5 text-xs text-gray-400">
                  &quot;No&quot; keeps it off the Publications page. It still appears on the
                  profile of every lab author ticked above.
                </p>
              </div>

              <div>
                <label htmlFor="pub-url" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  URL
                </label>
                <input
                  id="pub-url"
                  type="url"
                  className={inp}
                  style={inpStyle}
                  value={modal.data.url ?? ""}
                  onChange={(event) => setField("url", event.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div>
                <label htmlFor="pub-abstract" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Abstract
                </label>
                <textarea
                  id="pub-abstract"
                  rows={4}
                  className={inp}
                  style={{ ...inpStyle, resize: "vertical" }}
                  value={modal.data.abstract ?? ""}
                  onChange={(event) => setField("abstract", event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="pub-tags" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Tags (comma separated)
                </label>
                <input
                  id="pub-tags"
                  className={inp}
                  style={inpStyle}
                  value={(modal.data.tags ?? []).join(", ")}
                  onChange={(event) =>
                    setField(
                      "tags",
                      event.target.value
                        .split(",")
                        .map((tag: string) => tag.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="cursor-pointer rounded-xl border px-5 py-2 text-sm font-semibold"
                  style={{ borderColor: "#d1d5db", background: "white", color: "#374151" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="cursor-pointer rounded-xl border-none px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: "var(--color-primary)" }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePublications;
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import AppIcon from "../components/AppIcon";
import { db } from "../firebase/config";
import {
  canonicalPublicationId,
  normalizeDoi,
  paperKeyOf,
  publicationKeys,
} from "../firebase/hooks";
import type { CollaboratorProfile, Publication, PublicationAuthorEntry } from "../types";

type Draft = Omit<Publication, "id" | "createdAt"> & { id?: string };

const emptyPub = (): Draft => ({
  title: "",
  authors: "",
  journal: "",
  year: new Date().getFullYear(),
  abstract: "",
  url: "",
  doi: "",
  type: "published",
  tags: [],
  hasLabHeadAuthorship: true,
  paperKey: "",
  authorEntries: [],
  contributorUids: [],
});

const ManagePublications: React.FC = () => {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [collaborators, setCollaborators] = useState<CollaboratorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; data: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "ongoing" | "published">("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [formError, setFormError] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [pubSnap, collabSnap] = await Promise.all([
        getDocs(query(collection(db, "publications"), orderBy("year", "desc"))),
        getDocs(collection(db, "collaborators")),
      ]);
      setPublications(pubSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Publication));
      setCollaborators(
        collabSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CollaboratorProfile)
          .filter((c) => c.uid && c.name)
          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
      );
    } catch (error) {
      setNotice({
        type: "error",
        text: `Couldn't load publications: ${String((error as Error).message || error)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const nameByUid = useMemo(() => {
    const map: Record<string, string> = {};
    collaborators.forEach((c) => {
      if (c.uid) map[c.uid] = c.name ?? c.uid;
    });
    return map;
  }, [collaborators]);

  /**
   * Records that share an identity key with another record. The portal writes
   * `doi_<doi>` when a DOI is given and `key_<title-year-journal>` when it
   * isn't, so one paper entered both ways produced two documents that could
   * never collide. Flagging them here is how you find the ones already in the
   * database — new writes can no longer create them.
   */
  const duplicateIds = useMemo(() => {
    const byKey = new Map<string, string[]>();
    publications.forEach((publication) => {
      publicationKeys(publication).forEach((key) => {
        byKey.set(key, [...(byKey.get(key) ?? []), publication.id]);
      });
    });
    const flagged = new Set<string>();
    byKey.forEach((ids) => {
      const unique = Array.from(new Set(ids));
      if (unique.length > 1) unique.forEach((id) => flagged.add(id));
    });
    return flagged;
  }, [publications]);

  /* --------------------------------------------------------------- modal */

  const openModal = (mode: "add" | "edit", data: Draft) => {
    setFormError("");
    setModal({ mode, data });
    setOpenMenuId(null);
    window.requestAnimationFrame(() => titleRef.current?.focus());
  };

  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setModal(null);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "input:not(:disabled), select, textarea, button:not(:disabled)",
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modal, saving]);

  const setField = (key: string, value: unknown) =>
    setModal((current) => (current ? { ...current, data: { ...current.data, [key]: value } } : null));

  const toggleAuthor = (collaborator: CollaboratorProfile) => {
    setModal((current) => {
      if (!current) return null;
      const uids = current.data.contributorUids ?? [];
      const linked = uids.includes(collaborator.uid);
      const nextUids = linked
        ? uids.filter((uid) => uid !== collaborator.uid)
        : [...uids, collaborator.uid];

      /* Both fields, every time. Profiles match on either, and records that
         carry only one of them are exactly the ones that go missing. */
      const externals = (current.data.authorEntries ?? []).filter(
        (entry) => entry.type !== "linked",
      );
      const linkedEntries: PublicationAuthorEntry[] = nextUids.map((uid) => {
        const person = collaborators.find((c) => c.uid === uid);
        return {
          type: "linked",
          uid,
          name: person?.name ?? uid,
          photo: person?.photo ?? "",
          affiliation: person?.affiliation ?? "",
          role: "collaborator",
        };
      });

      return {
        ...current,
        data: {
          ...current.data,
          contributorUids: nextUids,
          authorEntries: [...linkedEntries, ...externals],
        },
      };
    });
  };

  /** Any other record that would answer to the same identity. */
  const findExisting = (draft: Draft) => {
    const probe: Publication = {
      ...(draft as Publication),
      id: draft.id ?? "__new__",
      createdAt: "",
    };
    const keys = new Set(publicationKeys(probe));
    return publications.find(
      (publication) =>
        publication.id !== draft.id &&
        publicationKeys(publication).some((key) => keys.has(key)),
    );
  };

  const save = async () => {
    if (!modal) return;
    const draft = modal.data;
    const title = (draft.title ?? "").trim();

    if (!title) {
      setFormError("A title is required.");
      titleRef.current?.focus();
      return;
    }

    const doi = normalizeDoi(draft.doi ?? "");
    const paperKey = paperKeyOf(title, draft.year, draft.journal ?? "");

    /* Refuse to create a second copy of something already on file. */
    if (modal.mode === "add") {
      const existing = findExisting({ ...draft, title, doi, paperKey });
      if (existing) {
        setFormError(
          `"${existing.title}" (${existing.year}) is already recorded. Edit that entry instead of adding a second copy.`,
        );
        return;
      }
    }

    setFormError("");
    setSaving(true);
    const now = new Date().toISOString();

    const payload = {
      title,
      authors: (draft.authors ?? "").trim(),
      journal: (draft.journal ?? "").trim(),
      year: Number(draft.year) || new Date().getFullYear(),
      abstract: (draft.abstract ?? "").trim(),
      url: (draft.url ?? "").trim(),
      doi,
      type: draft.type,
      tags: draft.tags ?? [],
      hasLabHeadAuthorship: draft.hasLabHeadAuthorship ?? true,
      /* Written on every record, so a later match can find it by either route. */
      paperKey,
      contributorUids: draft.contributorUids ?? [],
      authorEntries: draft.authorEntries ?? [],
      updatedAt: now,
    };

    try {
      if (modal.mode === "add") {
        /* setDoc at a computed id, not addDoc at a random one. Two admins
           entering the same paper now overwrite one document instead of
           creating two that nothing can reconcile. */
        const id = canonicalPublicationId(doi, paperKey);
        await setDoc(doc(db, "publications", id), { ...payload, createdAt: now }, { merge: true });
      } else if (draft.id) {
        await updateDoc(doc(db, "publications", draft.id), payload);
      }
      setModal(null);
      setNotice({ type: "success", text: `"${title}" saved.` });
      await load();
    } catch (error) {
      setFormError(
        `Saving failed: ${String((error as Error).message || error)}. Your entry is still here.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (publication: Publication) => {
    setDeletingId(publication.id);
    try {
      await deleteDoc(doc(db, "publications", publication.id));
      setPublications((current) => current.filter((item) => item.id !== publication.id));
      setConfirmDeleteId(null);
      setNotice({ type: "success", text: `"${publication.title}" deleted.` });
    } catch (error) {
      setNotice({
        type: "error",
        text: `Couldn't delete: ${String((error as Error).message || error)}`,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const patch = async (publication: Publication, changes: Partial<Publication>) => {
    setOpenMenuId(null);
    try {
      const next = { ...changes, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, "publications", publication.id), next);
      setPublications((current) =>
        current.map((item) => (item.id === publication.id ? { ...item, ...next } : item)),
      );
    } catch (error) {
      setNotice({
        type: "error",
        text: `Couldn't update: ${String((error as Error).message || error)}`,
      });
      void load();
    }
  };

  const filtered = publications.filter((publication) => {
    if (filterType !== "all" && publication.type !== filterType) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [publication.title, publication.authors, publication.journal, publication.doi]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "#e5e7eb" };

  /* ---------------------------------------------------------------- view */

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black" style={{ color: "var(--color-primary)" }}>
            Manage Publications
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {publications.length} publications total
            {duplicateIds.size > 0 && ` · ${duplicateIds.size} possible duplicates`}
          </p>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {duplicateIds.size > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-black">{duplicateIds.size} records</strong> share a DOI or
          title with another entry — they&apos;re marked below. The website already merges them
          when displaying, so this is housekeeping rather than urgent: open each pair, keep the
          fuller one, and delete the other.
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(["all", "ongoing", "published"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filterType === value}
              onClick={() => setFilterType(value)}
              className="cursor-pointer rounded-xl border px-4 py-1.5 text-sm font-semibold capitalize"
              style={{
                background: filterType === value ? "var(--color-primary)" : "white",
                color: filterType === value ? "white" : "#374151",
                borderColor: filterType === value ? "var(--color-primary)" : "#e5e7eb",
              }}
            >
              {value} (
              {value === "all"
                ? publications.length
                : publications.filter((p) => p.type === value).length}
              )
            </button>
          ))}
        </div>

        <div className="min-w-[220px] flex-1">
          <label htmlFor="pub-search" className="sr-only">
            Search publications
          </label>
          <input
            id="pub-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, author, journal or DOI…"
            className={inp}
            style={inpStyle}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => openModal("add", emptyPub())}
            className="w-full rounded-2xl border-2 border-dashed px-4 py-4 text-left transition-all"
            style={{
              borderColor: "#cbd5e1",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(238,245,241,0.98) 100%)",
            }}
          >
            <span className="inline-flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ background: "var(--color-primary)" }}
              >
                <span className="text-2xl leading-none">+</span>
              </span>
              <span>
                <span className="block text-sm font-black text-gray-900">Add Publication</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  Create a new canonical paper record
                </span>
              </span>
            </span>
          </button>

          {filtered.map((publication) => (
            <div
              key={publication.id}
              className="rounded-2xl border bg-white p-4 shadow-sm"
              style={{
                borderColor: duplicateIds.has(publication.id) ? "#fcd34d" : "#e5e7eb",
                borderLeft: `4px solid ${publication.type === "ongoing" ? "#f59e0b" : "#2563eb"}`,
              }}
            >
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{
                        background: publication.type === "ongoing" ? "#fef3c7" : "#dbeafe",
                        color: publication.type === "ongoing" ? "#92400e" : "#1e40af",
                      }}
                    >
                      {publication.type}
                    </span>
                    <span className="text-xs text-gray-500">{publication.year}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        background: publication.hasLabHeadAuthorship ? "#dcfce7" : "#fee2e2",
                        color: publication.hasLabHeadAuthorship ? "#166534" : "#991b1b",
                      }}
                    >
                      {publication.hasLabHeadAuthorship ? "lab-head yes" : "lab-head no"}
                    </span>
                    {duplicateIds.has(publication.id) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        possible duplicate
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-bold leading-snug text-gray-900">
                    {publication.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">{publication.authors}</p>
                  <p
                    className="mt-0.5 text-xs font-medium"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {publication.journal}
                  </p>

                  {/* Names, not a count. "Linked: 2" doesn't tell you whether
                      the right two people will see it on their profiles. */}
                  <p className="mt-1.5 text-xs text-gray-500">
                    {(publication.contributorUids?.length ?? 0) === 0 ? (
                      <span className="font-semibold text-amber-700">
                        No lab authors linked — this won&apos;t appear on anyone&apos;s profile
                      </span>
                    ) : (
                      <>
                        Linked:{" "}
                        {publication.contributorUids
                          ?.map((uid) => nameByUid[uid] ?? uid)
                          .join(", ")}
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Added by{" "}
                    {publication.createdByUid
                      ? nameByUid[publication.createdByUid] || publication.createdByUid
                      : "an administrator"}
                    {publication.doi ? ` · ${publication.doi}` : ""}
                  </p>
                </div>

                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === publication.id}
                    aria-label={`Actions for ${publication.title}`}
                    onClick={() =>
                      setOpenMenuId((current) =>
                        current === publication.id ? null : publication.id,
                      )
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  >
                    <AppIcon name="more" size={16} />
                  </button>

                  {openMenuId === publication.id && (
                    <div
                      role="menu"
                      className="absolute right-0 top-10 z-[500] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openModal("edit", publication)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <AppIcon name="about" size={14} />
                        Edit paper
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void patch(publication, {
                            type: publication.type === "ongoing" ? "published" : "ongoing",
                          })
                        }
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <AppIcon name="publications" size={14} />
                        {publication.type === "ongoing" ? "Mark as published" : "Mark as ongoing"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void patch(publication, {
                            hasLabHeadAuthorship: !(publication.hasLabHeadAuthorship ?? false),
                          })
                        }
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <AppIcon name="user" size={14} />
                        {publication.hasLabHeadAuthorship
                          ? "Set lab-head: no"
                          : "Set lab-head: yes"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setConfirmDeleteId(publication.id);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        <AppIcon name="logout" size={14} />
                        Delete paper
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {confirmDeleteId === publication.id && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-[13px] font-medium text-red-900">
                    Delete this paper for everyone
                    {(publication.contributorUids?.length ?? 0) > 1 &&
                      `, including the ${publication.contributorUids?.length} linked authors`}
                    ?
                  </p>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      disabled={deletingId === publication.id}
                      onClick={() => void remove(publication)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      {deletingId === publication.id ? "Deleting…" : "Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700"
                    >
                      Keep
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="py-10 text-center text-gray-500">No publications found.</p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ modal */}
      {modal && (
        <div
          className="fixed inset-0 z-[2147482000] flex items-start justify-center overflow-y-auto p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => !saving && setModal(null)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="publication-dialog-title"
            className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ background: "var(--color-primary)" }}
            >
              <h3 id="publication-dialog-title" className="text-lg font-black text-white">
                {modal.mode === "add" ? "Add Publication" : "Edit Publication"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close"
                className="cursor-pointer border-none bg-transparent text-2xl text-white"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-4 p-6">
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
                >
                  {formError}
                </p>
              )}

              <div>
                <label htmlFor="pub-title" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Title *
                </label>
                <input
                  id="pub-title"
                  ref={titleRef}
                  className={inp}
                  style={inpStyle}
                  value={modal.data.title ?? ""}
                  onChange={(event) => setField("title", event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="pub-authors" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Authors (as printed)
                </label>
                <input
                  id="pub-authors"
                  className={inp}
                  style={inpStyle}
                  value={modal.data.authors ?? ""}
                  onChange={(event) => setField("authors", event.target.value)}
                  placeholder="Rahman, M.R., Siddiqui, A., …"
                />
              </div>

              {/* Without this, an admin-created paper has no uid on it, so it
                  can never appear on a collaborator's profile — the profile
                  page matches on contributorUids or a linked authorEntry. */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-gray-600">
                  Lab authors{" "}
                  <span className="font-normal text-gray-400">
                    — tick everyone whose profile should list this paper
                  </span>
                </p>
                <div
                  className="max-h-44 overflow-y-auto rounded-xl border p-2"
                  style={inpStyle}
                >
                  {collaborators.length === 0 ? (
                    <p className="p-2 text-xs text-gray-400">No collaborator profiles found.</p>
                  ) : (
                    collaborators.map((collaborator) => {
                      const checked = (modal.data.contributorUids ?? []).includes(
                        collaborator.uid,
                      );
                      return (
                        <label
                          key={collaborator.uid}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAuthor(collaborator)}
                            className="h-4 w-4 accent-[var(--color-primary)]"
                          />
                          <span className="text-sm text-slate-800">{collaborator.name}</span>
                          <span className="ml-auto text-[11px] text-slate-400">
                            {collaborator.designation}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pub-journal" className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Journal / Venue
                  </label>
                  <input
                    id="pub-journal"
                    className={inp}
                    style={inpStyle}
                    value={modal.data.journal ?? ""}
                    onChange={(event) => setField("journal", event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="pub-year" className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Year
                  </label>
                  <input
                    id="pub-year"
                    type="number"
                    className={inp}
                    style={inpStyle}
                    value={modal.data.year}
                    onChange={(event) => setField("year", Number(event.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pub-type" className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Type
                  </label>
                  <select
                    id="pub-type"
                    className={inp}
                    style={inpStyle}
                    value={modal.data.type}
                    onChange={(event) => setField("type", event.target.value)}
                  >
                    <option value="published">Published</option>
                    <option value="ongoing">Ongoing</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pub-doi" className="mb-1.5 block text-xs font-semibold text-gray-600">
                    DOI
                  </label>
                  <input
                    id="pub-doi"
                    className={inp}
                    style={inpStyle}
                    value={modal.data.doi ?? ""}
                    onChange={(event) => setField("doi", event.target.value)}
                    onBlur={(event) => setField("doi", normalizeDoi(event.target.value))}
                    placeholder="10.1000/xyz123"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pub-labhead" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Lab-head authorship
                </label>
                <select
                  id="pub-labhead"
                  className={inp}
                  style={inpStyle}
                  value={modal.data.hasLabHeadAuthorship ? "yes" : "no"}
                  onChange={(event) =>
                    setField("hasLabHeadAuthorship", event.target.value === "yes")
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                <p className="mt-1.5 text-xs text-gray-400">
                  &quot;No&quot; keeps it off the Publications page. It still appears on the
                  profile of every lab author ticked above.
                </p>
              </div>

              <div>
                <label htmlFor="pub-url" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  URL
                </label>
                <input
                  id="pub-url"
                  type="url"
                  className={inp}
                  style={inpStyle}
                  value={modal.data.url ?? ""}
                  onChange={(event) => setField("url", event.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div>
                <label htmlFor="pub-abstract" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Abstract
                </label>
                <textarea
                  id="pub-abstract"
                  rows={4}
                  className={inp}
                  style={{ ...inpStyle, resize: "vertical" }}
                  value={modal.data.abstract ?? ""}
                  onChange={(event) => setField("abstract", event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="pub-tags" className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Tags (comma separated)
                </label>
                <input
                  id="pub-tags"
                  className={inp}
                  style={inpStyle}
                  value={(modal.data.tags ?? []).join(", ")}
                  onChange={(event) =>
                    setField(
                      "tags",
                      event.target.value
                        .split(",")
                        .map((tag: string) => tag.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="cursor-pointer rounded-xl border px-5 py-2 text-sm font-semibold"
                  style={{ borderColor: "#d1d5db", background: "white", color: "#374151" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="cursor-pointer rounded-xl border-none px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: "var(--color-primary)" }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePublications;
