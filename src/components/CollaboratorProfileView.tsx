import React, { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isContributor, publicationKeys, useCollaborators, useGallery, usePublications } from "../firebase/hooks";
import type { CollaboratorPublication } from "../types";
import CollaboratorPublicProfile from "./CollaboratorPublicProfile";

/** Loose title match, used only to spot a paper entered twice by hand and as a
 *  shared record. Deliberately forgiving about punctuation and case. */
const titleKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Everything a profile shows, for one uid: the person, their papers (from the
 * full publication list, so papers without the lab head still appear on their
 * authors' profiles), and their gallery uploads.
 */
export const useCollaboratorProfile = (uid: string) => {
  const { collaborators, loading: collaboratorsLoading } = useCollaborators();
  const { gallery, loading: galleryLoading } = useGallery();
  const { all: allPublications, loading: publicationsLoading } = usePublications();

  const collaborator = useMemo(() => collaborators.find((item) => item.uid === uid), [collaborators, uid]);

  const contributorPublications = useMemo(() => {
    if (!uid) return [];
    const seen = new Set<string>();
    return allPublications
      .filter((publication) => isContributor(publication, uid))
      .filter((publication) => {
        const keys = publicationKeys(publication);
        if (keys.some((key) => seen.has(key))) return false;
        keys.forEach((key) => seen.add(key));
        return true;
      });
  }, [allPublications, uid]);

  const linkedPublications = useMemo<CollaboratorPublication[]>(() => {
    // A paper both hand-typed on the profile and shared as a record shows once; the manual copy wins.
    const manual = new Set((collaborator?.publications ?? []).map((entry) => titleKey(entry.title)));
    return contributorPublications
      .filter((publication) => !manual.has(titleKey(publication.title)))
      .map((publication) => ({
        id: publication.id,
        title: publication.title,
        journal: publication.journal,
        year: publication.year,
        url: publication.url,
      }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));
  }, [contributorPublications, collaborator]);

  const getDetailId = useMemo(() => {
    const ids = new Set(contributorPublications.map((publication) => publication.id));
    const byTitle = new Map(contributorPublications.map((publication) => [titleKey(publication.title), publication.id]));
    return (entry: CollaboratorPublication) =>
      (entry.id && ids.has(entry.id) ? entry.id : undefined) ?? byTitle.get(titleKey(entry.title ?? ""));
  }, [contributorPublications]);

  const galleryItems = useMemo(
    () => (collaborator ? gallery.filter((item) => item.uploaderUid === collaborator.uid) : []),
    [gallery, collaborator],
  );

  return {
    collaborator,
    collaborators,
    linkedPublications,
    getDetailId,
    galleryItems,
    loading: collaboratorsLoading || galleryLoading || publicationsLoading,
  };
};

/** Just the name, for drawer titles. */
export const CollaboratorName: React.FC<{ uid: string; fallback?: string }> = ({ uid, fallback }) => {
  const { collaborators } = useCollaborators();
  return <>{collaborators.find((c) => c.uid === uid)?.name ?? (fallback || "Collaborator")}</>;
};

/**
 * A full profile for one uid, sized for a panel, drawer or bottom sheet —
 * with its own loading skeleton and not-found state.
 */
const CollaboratorProfileView: React.FC<{ uid: string; setDocumentTitle?: boolean }> = ({ uid, setDocumentTitle }) => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const canMessage = appUser?.role === "collaborator" || appUser?.role === "lab_head";
  const { collaborator, linkedPublications, getDetailId, galleryItems, loading } = useCollaboratorProfile(uid);

  useEffect(() => {
    if (!setDocumentTitle || !collaborator) return;
    const previous = document.title;
    document.title = `${collaborator.name} — Collaborators`;
    return () => {
      document.title = previous;
    };
  }, [setDocumentTitle, collaborator]);

  if (loading) {
    return (
      <div className="space-y-4 p-5 motion-safe:animate-pulse" role="status" aria-busy="true">
        <span className="sr-only">Loading profile</span>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-[color:var(--site-surface-alt)]" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/2 rounded bg-[color:var(--site-surface-alt)]" />
            <div className="h-3 w-1/3 rounded bg-[color:var(--site-surface-alt)]" />
          </div>
        </div>
        <div className="h-40 rounded-2xl bg-[color:var(--site-surface-alt)]" />
        <div className="h-56 rounded-2xl bg-[color:var(--site-surface-alt)]" />
      </div>
    );
  }

  if (!collaborator) {
    return (
      <div className="grid place-items-center px-4 py-16 text-center">
        <div>
          <p className="text-[15px] font-semibold text-[color:var(--site-heading)]">Profile not found</p>
          <p className="mt-1 text-[13px] text-[color:var(--site-muted)]">This collaborator profile isn't available.</p>
          <Link to="/collaborators" className="mt-4 inline-block text-[13px] font-semibold no-underline" style={{ color: "var(--secondary-ink)" }}>
            Browse all collaborators →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CollaboratorPublicProfile
      key={uid}
      variant="panel"
      c={collaborator}
      linkedPublications={linkedPublications}
      getDetailId={getDetailId}
      galleryItems={galleryItems}
      onMessage={canMessage && uid !== appUser?.uid ? () => navigate(`/chat?to=${encodeURIComponent(uid)}`) : undefined}
    />
  );
};

export default CollaboratorProfileView;
