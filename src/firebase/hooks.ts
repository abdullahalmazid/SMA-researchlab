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

/**
 * Announcements were the one collection read through an inline object literal
 * instead of a normalizer, and that literal named seven fields. The admin panel
 * writes twelve — so title, body, category, link and linkLabel were written to
 * Firestore and then dropped on the way out, and the public page fell back to
 * deriving a title from the summary with an empty detail panel.
 *
 * Empty strings rather than undefined: every consumer already treats "" as
 * absent, and it keeps the shape uniform.
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
  const [ongoing, setOngoing] = useState<Publication[]>([]);
  const [published, setPublished] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "publications"),
      (snap) => {
        const canonicalByKey = new Map<string, Publication>();
        snap.docs.forEach((d) => {
          const pub = normalizePublication(d.id, d.data());
          if (!pub.hasLabHeadAuthorship) return;

          const dedupeKey =
            (pub.doi ?? "").trim().toLowerCase() ||
            (pub.paperKey ?? "").trim().toLowerCase() ||
            d.id;

          const existing = canonicalByKey.get(dedupeKey);
          if (!existing) {
            canonicalByKey.set(dedupeKey, pub);
            return;
          }

          // Keep the richer record if duplicate keys exist due to old writes.
          const existingScore =
            (existing.authorEntries?.length ?? 0) +
            (existing.contributorUids?.length ?? 0) +
            (existing.abstract ? 1 : 0);
          const nextScore =
            (pub.authorEntries?.length ?? 0) +
            (pub.contributorUids?.length ?? 0) +
            (pub.abstract ? 1 : 0);
          if (nextScore > existingScore) canonicalByKey.set(dedupeKey, pub);
        });

        const all = Array.from(canonicalByKey.values()).sort(
          (a, b) => b.year - a.year,
        );
        setOngoing(all.filter((p) => p.type === "ongoing"));
        setPublished(all.filter((p) => p.type === "published"));
        setLoading(false);
      },
      (error) => {
        console.error("Publications error:", error);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { ongoing, published, loading };
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
             the top of a section titled "Latest Updates". `order` is still
             written by the admin panel; nothing reads it for display now. */
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
