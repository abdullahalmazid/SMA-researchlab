import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import type {
  Announcement,
  Comment as AppComment,
  CollaboratorProfile,
  Publication,
  PublicationAuthorEntry,
  ResearchIdea,
  SiteContent,
  ThemeSettings,
} from "../types";
import { db, isFirebaseConfigured } from "./config";

import type { GalleryItem } from "../types";

const DEFAULT_THEME: ThemeSettings = {
  primaryColor: "#1e3a5f", secondaryColor: "#2563eb", accentColor: "#f59e0b",
  backgroundColor: "#f8fafc", navbarColor: "#1e3a5f", footerColor: "#111827",
  fontFamily: "'Inter', sans-serif", headingFont: "'Inter', sans-serif",
};

const text = (value: unknown) => typeof value === "string" ? value : "";
const normalizeCollaborator = (id: string, raw: Record<string, unknown>): CollaboratorProfile => ({
  id,
  uid: text(raw.uid) || id,
  name: text(raw.name) || "Unnamed collaborator",
  email: text(raw.email),
  photo: text(raw.photo),
  affiliation: text(raw.affiliation) || "Affiliation not provided",
  designation: text(raw.designation) || "Research collaborator",
  bio: text(raw.bio) || "Profile information will be added soon.",
  researchInterests: Array.isArray(raw.researchInterests) ? raw.researchInterests.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [],
  linkedin: text(raw.linkedin),
  orcid: text(raw.orcid),
  scholar: text(raw.scholar),
  researchgate: text(raw.researchgate),
  facebook: text(raw.facebook),
  publications: Array.isArray(raw.publications) ? raw.publications.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const title = text(row.title).trim();
    if (!title) return [];
    return [{ id: text(row.id) || `${id}-publication-${index}`, title, journal: text(row.journal), year: Number(row.year) || new Date().getFullYear(), url: text(row.url) }];
  }) : [],
  isActive: raw.isActive !== false,
  order: Number(raw.order) || 0,
  createdAt: text(raw.createdAt) || new Date(0).toISOString(),
});

const stringList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
const iso = (value: unknown) => text(value) || new Date(0).toISOString();

export const normalizePublication = (id: string, raw: Record<string, unknown>): Publication => ({
  id,
  title: text(raw.title) || "Untitled publication",
  authors: text(raw.authors) || "Author information unavailable",
  journal: text(raw.journal) || "Publication venue unavailable",
  year: Number(raw.year) || new Date().getFullYear(),
  abstract: text(raw.abstract),
  url: text(raw.url),
  doi: text(raw.doi),
  type: raw.type === "ongoing" ? "ongoing" : "published",
  tags: stringList(raw.tags),
  paperKey: text(raw.paperKey) || undefined,
  hasLabHeadAuthorship: raw.hasLabHeadAuthorship !== false,
  authorEntries: Array.isArray(raw.authorEntries) ? raw.authorEntries.filter((entry) => entry && typeof entry === "object") as Publication["authorEntries"] : [],
  contributorUids: stringList(raw.contributorUids),
  createdByUid: text(raw.createdByUid) || undefined,
  updatedAt: text(raw.updatedAt) || undefined,
  createdAt: iso(raw.createdAt),
});

/**
 * Announcements were the one collection read through an inline object literal
 * instead of a normalizer, and that literal named seven fields. The admin panel
 * writes twelve — so title, body, category, link and linkLabel were written to
 * Firestore and then dropped on the way out, and the public page fell back to
 * deriving a title from the summary with an empty detail panel.
 */
export const normalizeAnnouncement = (id: string, raw: Record<string, unknown>): Announcement => ({
  id,
  title: text(raw.title),
  content: text(raw.content),
  body: text(raw.body),
  category: text(raw.category),
  link: text(raw.link),
  linkLabel: text(raw.linkLabel),
  order: Number(raw.order) || 0,
  isPinned: raw.isPinned === true,
  isHidden: raw.isHidden === true,
  createdAt: iso(raw.createdAt),
  updatedAt: text(raw.updatedAt) || undefined,
});

export const normalizeResearchIdea = (id: string, raw: Record<string, unknown>): ResearchIdea => ({
  id,
  title: text(raw.title) || "Untitled research idea",
  shortDescription: text(raw.shortDescription) || "No summary has been provided.",
  fullDescription: text(raw.fullDescription) || text(raw.shortDescription) || "No description has been provided.",
  tags: stringList(raw.tags),
  authorId: text(raw.authorId),
  authorName: text(raw.authorName) || "Research team member",
  authorPhoto: text(raw.authorPhoto),
  createdAt: iso(raw.createdAt),
  updatedAt: iso(raw.updatedAt || raw.createdAt),
  commentCount: Math.max(0, Number(raw.commentCount) || 0),
  isPublished: raw.isPublished !== false,
  isHidden: raw.isHidden === true,
  isFlagged: raw.isFlagged === true,
  isPinned: raw.isPinned === true,
});

const normalizeComment = (id: string, raw: Record<string, unknown>): AppComment => ({
  id,
  ideaId: text(raw.ideaId),
  authorId: text(raw.authorId),
  authorName: text(raw.authorName) || "Team member",
  authorPhoto: text(raw.authorPhoto),
  content: text(raw.content),
  parentId: text(raw.parentId) || null,
  createdAt: iso(raw.createdAt),
});

/* ------------------------------------------------------------------ *
 * Publication identity
 *
 * The portal writes a document id of `doi_<doi>` when a DOI is supplied and
 * `key_<title>-<year>-<journal>` when it isn't — so the same paper entered once
 * without a DOI and once with one lands in two documents that never collide.
 * Matching on doi *or* paperKey here means the display survives that, whatever
 * the write path did.
 * ------------------------------------------------------------------ */

export const slug = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Accepts a bare DOI, a doi: prefix, or a doi.org URL. */
export const normalizeDoi = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:/, "")
    .trim();

/** Title-year-journal, the fallback identity for papers with no DOI. */
export const paperKeyOf = (title: string, year: number | string, journal: string) =>
  slug(`${title}-${year}-${journal || "unknown"}`);

/**
 * The document id every writer must use. Two screens computing this differently
 * is what let the same paper land in `doi_…` from one form and `key_…` from
 * another, with nothing to make them collide.
 */
export const canonicalPublicationId = (doi: string, paperKey: string) =>
  doi ? `doi_${slug(normalizeDoi(doi))}` : `key_${paperKey}`;

export const publicationKeys = (publication: Publication): string[] => {
  const keys: string[] = [];
  const doi = slug(publication.doi ?? "");
  const paperKey = slug(publication.paperKey ?? "");
  const derived = slug(
    `${publication.title}-${publication.year}-${publication.journal ?? ""}`,
  );
  if (doi) keys.push(`doi:${doi}`);
  if (paperKey) keys.push(`key:${paperKey}`);
  if (derived) keys.push(`key:${derived}`);
  return keys.length ? keys : [`id:${publication.id}`];
};

const authorEntryKey = (entry: PublicationAuthorEntry) =>
  entry.type === "linked" && entry.uid
    ? `linked:${entry.uid}`
    : `external:${slug(entry.name ?? "")}`;

/** Union of both records, so a duplicate's contributor links aren't discarded. */
const mergePublications = (a: Publication, b: Publication): Publication => {
  const entries = new Map<string, PublicationAuthorEntry>();
  [...(a.authorEntries ?? []), ...(b.authorEntries ?? [])].forEach((entry) => {
    const key = authorEntryKey(entry);
    if (!entries.has(key)) entries.set(key, entry);
  });

  const richer =
    (b.abstract ? 1 : 0) + (b.doi ? 1 : 0) + (b.authorEntries?.length ?? 0) >
    (a.abstract ? 1 : 0) + (a.doi ? 1 : 0) + (a.authorEntries?.length ?? 0)
      ? b
      : a;

  return {
    ...richer,
    abstract: a.abstract || b.abstract,
    url: a.url || b.url,
    doi: a.doi || b.doi,
    paperKey: a.paperKey || b.paperKey,
    tags: a.tags?.length ? a.tags : (b.tags ?? []),
    authorEntries: Array.from(entries.values()),
    contributorUids: Array.from(
      new Set([...(a.contributorUids ?? []), ...(b.contributorUids ?? [])]),
    ),
    /* If either copy says the lab head is an author, the paper is a lab paper. */
    hasLabHeadAuthorship: Boolean(a.hasLabHeadAuthorship || b.hasLabHeadAuthorship),
  };
};

/** True when this uid appears as a contributor on the paper, by either route.
 *  Older records carry authorEntries without contributorUids, and vice versa. */
export const isContributor = (publication: Publication, uid: string): boolean =>
  Boolean(uid) &&
  (publication.contributorUids?.includes(uid) ||
    Boolean(
      publication.authorEntries?.some(
        (entry) => entry.type === "linked" && entry.uid === uid,
      ),
    ));

// ── Site Content ──────────────────────────────────────────────
export function useSiteContent() {
  const [content, setContent] = useState<Partial<SiteContent>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const unsub = onSnapshot(collection(db, "siteContent"), (snap) => {
      const data: Partial<SiteContent> = {};
      snap.forEach((d) => {
        data[d.id as keyof SiteContent] = d.data().value as string;
      });
      setContent(data);
      setLoading(false);
    }, (error) => { console.error("Site content error:", error); setLoading(false); });
    return unsub;
  }, []);

  return { content, loading };
}

// ── Theme ─────────────────────────────────────────────────────
export function useTheme() {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onSnapshot(doc(db, "theme", "settings"), (snap) => {
      if (snap.exists()) {
        const raw = snap.data();
        setTheme(Object.fromEntries(Object.entries(DEFAULT_THEME).map(([key, fallback]) => [key, text(raw[key]) || fallback])) as unknown as ThemeSettings);
      }
    }, (error) => console.error("Theme error:", error));
    return unsub;
  }, []);

  return theme;
}

// ── Collaborators ─────────────────────────────────────────────
// No compound query — filter and sort on client to avoid composite index requirement
export function useCollaborators() {
  const [collaborators, setCollaborators] = useState<CollaboratorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "collaborators"),
      (snap) => {
        const all = snap.docs.map((d) => normalizeCollaborator(d.id, d.data()));
        const filtered = all
          .filter((c) => c.isActive === true)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCollaborators(filtered);
        setLoading(false);
      },
      (error) => {
        console.error("Collaborators error:", error);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { collaborators, loading };
}

// ── Publications ──────────────────────────────────────────────
export function usePublications() {
  const [all, setAll] = useState<Publication[]>([]);
  const [ongoing, setOngoing] = useState<Publication[]>([]);
  const [published, setPublished] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "publications"),
      (snap) => {
        /* Dedupe across every alias a record might carry. A paper written once
           with a DOI and once without produces two documents; both point at the
           same canonical entry here, and the entries are merged rather than one
           being discarded. */
        const canonical = new Map<string, Publication>();

        snap.docs.forEach((d) => {
          const pub = normalizePublication(d.id, d.data());
          const keys = publicationKeys(pub);
          const existingKey = keys.find((key) => canonical.has(key));
          const merged = existingKey
            ? mergePublications(canonical.get(existingKey) as Publication, pub)
            : pub;
          publicationKeys(merged).concat(keys).forEach((key) => canonical.set(key, merged));
        });

        const unique = Array.from(new Set(canonical.values())).sort(
          (a, b) => b.year - a.year || a.title.localeCompare(b.title),
        );

        /* `all` is every paper the lab knows about. `ongoing` and `published`
           stay lab-head-only, which is what the Publications page and the Home
           stats mean by those words — but filtering at the source meant a
           collaborator's own paper never reached their profile page either. */
        setAll(unique);
        const labPapers = unique.filter((p) => p.hasLabHeadAuthorship);
        setOngoing(labPapers.filter((p) => p.type === "ongoing"));
        setPublished(labPapers.filter((p) => p.type === "published"));
        setLoading(false);
      },
      (error) => {
        console.error("Publications error:", error);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { all, ongoing, published, loading };
}

// ── Research Ideas ────────────────────────────────────────────
export function useResearchIdeas() {
  const [ideas, setIdeas] = useState<ResearchIdea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "researchIdeas"),
      (snap) => {
        const all = snap.docs
          .map((d) => normalizeResearchIdea(d.id, d.data()))
          .filter((idea) => !idea.isHidden)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setIdeas(all);
        setLoading(false);
      },
      (error) => {
        console.error("Research ideas error:", error);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { ideas, loading };
}

// ── Comments for an idea ──────────────────────────────────────
export function useComments(ideaId: string) {
  const [comments, setComments] = useState<AppComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ideaId || !isFirebaseConfigured) { setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, "comments"), where("ideaId", "==", ideaId)),
      (snap) => {
        const all = snap.docs
          .map((d) => normalizeComment(d.id, d.data()))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setComments(all);
        setLoading(false);
      },
      (error) => {
        console.error("Comments error:", error);
        setLoading(false);
      },
    );
    return unsub;
  }, [ideaId]);

  return { comments, loading };
}

// ── Announcements ─────────────────────────────────────────────
export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = onSnapshot(
      collection(db, "announcements"),
      (snap) => {
        const all = snap.docs
          .map((d) => normalizeAnnouncement(d.id, d.data()))
          .filter((item) => !item.isHidden)
          /* Pinned first, then newest first. Sorting by `order` ascending gave
             oldest-first, which is why the lab's very first announcement sat at
             the top of a section titled "Latest Updates". */
          .sort(
            (a, b) =>
              Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) ||
              b.createdAt.localeCompare(a.createdAt),
          );
        setAnnouncements(all);
      },
      (error) => {
        console.error("Announcements error:", error);
      },
    );
    return unsub;
  }, []);

  return announcements;
}

// ── Single collaborator profile by uid ────────────────────────
export async function getCollaboratorByUid(
  uid: string,
): Promise<CollaboratorProfile | null> {
  const q = query(collection(db, "collaborators"), where("uid", "==", uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as CollaboratorProfile;
}

// ── Gallery ───────────────────────────────────────────────────
export function useGallery() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "gallery"),
      (snap) => {
        const all = snap.docs
          .map((d) => ({ id: d.id, title: text(d.data().title) || "Lab gallery item", description: text(d.data().description), imageUrl: text(d.data().imageUrl), order: Number(d.data().order) || 0, createdAt: iso(d.data().createdAt), updatedAt: text(d.data().updatedAt) || undefined, uploaderUid: text(d.data().uploaderUid) || undefined, uploaderName: text(d.data().uploaderName) || undefined, uploaderEmail: text(d.data().uploaderEmail) || undefined, isVisible: d.data().isVisible !== false, moderationStatus: d.data().moderationStatus === "rejected" ? "rejected" : d.data().moderationStatus === "pending" ? "pending" : "approved" } as GalleryItem))
          .filter((item) => Boolean(item.imageUrl) && item.isVisible !== false && item.moderationStatus !== "rejected")
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setGallery(all);
        setLoading(false);
      },
      (error) => {
        console.error("Gallery error:", error);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { gallery, loading };
}
