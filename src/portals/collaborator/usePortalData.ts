import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db } from "../../firebase/config";
import type { CollaboratorProfile, GalleryItem, Publication, ResearchIdea } from "../../types";

/**
 * Everything the portal shows, loaded once and shared between tabs so the
 * overview can count things without a second round of queries. Each list has
 * its own reload for after a write.
 */
export const usePortalData = (uid: string | undefined) => {
  const [profile, setProfile] = useState<CollaboratorProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [papers, setPapers] = useState<Publication[] | null>(null);
  const [ideas, setIdeas] = useState<ResearchIdea[] | null>(null);
  const [photos, setPhotos] = useState<GalleryItem[] | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorProfile[]>([]);

  const loadProfile = useCallback(async () => {
    if (!uid) return;
    const snap = await getDocs(query(collection(db, "collaborators"), where("uid", "==", uid)));
    setProfile(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as CollaboratorProfile));
  }, [uid]);

  const reloadPapers = useCallback(async () => {
    if (!uid) return;
    const [paperSnap, collabSnap] = await Promise.all([
      getDocs(query(collection(db, "publications"), where("contributorUids", "array-contains", uid))),
      getDocs(collection(db, "collaborators")),
    ]);
    setPapers(paperSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Publication).sort((a, b) => (b.year || 0) - (a.year || 0)));
    setCollaborators(collabSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as CollaboratorProfile));
  }, [uid]);

  const reloadIdeas = useCallback(async () => {
    if (!uid) return;
    const snap = await getDocs(query(collection(db, "researchIdeas"), where("authorId", "==", uid)));
    setIdeas(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ResearchIdea)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    );
  }, [uid]);

  const reloadPhotos = useCallback(async () => {
    if (!uid) return;
    const snap = await getDocs(query(collection(db, "gallery"), where("uploaderUid", "==", uid)));
    setPhotos(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as GalleryItem)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    loadProfile()
      .catch((error) => console.error("Portal profile error:", error))
      .finally(() => !cancelled && setProfileLoading(false));
    // Lists load in the background; each tab shows its own spinner until ready.
    reloadPapers().catch((error) => {
      console.error("Portal papers error:", error);
      setPapers([]);
    });
    reloadIdeas().catch((error) => {
      console.error("Portal ideas error:", error);
      setIdeas([]);
    });
    reloadPhotos().catch((error) => {
      console.error("Portal gallery error:", error);
      setPhotos([]);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, loadProfile, reloadPapers, reloadIdeas, reloadPhotos]);

  return {
    profile,
    setProfile,
    profileLoading,
    papers,
    ideas,
    photos,
    collaborators,
    reloadPapers,
    reloadIdeas,
    reloadPhotos,
  };
};

export type PortalData = ReturnType<typeof usePortalData>;
