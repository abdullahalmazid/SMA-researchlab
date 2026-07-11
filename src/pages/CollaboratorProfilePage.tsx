import React, { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CollaboratorPublicProfile from "../components/CollaboratorPublicProfile";
import EditableText from "../components/EditableText";
import { useCollaborators, useGallery, usePublications } from "../firebase/hooks";
import type { CollaboratorPublication } from "../types";

const CollaboratorProfilePage: React.FC = () => {
  const { uid = "" } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { collaborators, loading: collaboratorsLoading } = useCollaborators();
  const { gallery, loading: galleryLoading } = useGallery();
  const { ongoing, published, loading: publicationsLoading } = usePublications();

  const collaborator = collaborators.find((item) => item.uid === uid);

  const linkedPublications = useMemo<CollaboratorPublication[]>(() => {
    if (!uid) return [];
    return [...ongoing, ...published]
      .filter(
        (publication) =>
          publication.contributorUids?.includes(uid) ||
          publication.authorEntries?.some(
            (author) => author.type === "linked" && author.uid === uid,
          ),
      )
      .map((publication) => ({
        id: publication.id,
        title: publication.title,
        journal: publication.journal,
        year: publication.year,
        url: publication.url,
      }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }, [ongoing, published, uid]);

  if (collaboratorsLoading || galleryLoading || publicationsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading collaborator profile">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!collaborator) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-gray-900">
          <EditableText id="collaboratorProfile.notFoundTitle" defaultValue="Profile not found" className="text-2xl font-black text-gray-900" />
        </h1>
        <p className="mt-2 text-gray-500">
          <EditableText id="collaboratorProfile.notFoundDesc" defaultValue="This collaborator profile is not available." className="mt-2 text-gray-500" />
        </p>
        <Link to="/collaborators" className="mt-6 inline-flex rounded-full px-5 py-2.5 text-sm font-bold text-white no-underline" style={{ background: "var(--color-primary)" }}>
          Back to Collaborators
        </Link>
      </div>
    );
  }

  return (
    <CollaboratorPublicProfile
      c={collaborator}
      linkedPublications={linkedPublications}
      galleryItems={gallery.filter((item) => item.uploaderUid === collaborator.uid)}
      onBack={() => navigate("/collaborators")}
    />
  );
};

export default CollaboratorProfilePage;
