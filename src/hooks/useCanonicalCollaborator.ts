import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase/config";

export interface CanonicalCollaboratorIdentity {
  name: string;
  photo: string;
  designation: string;
  affiliation: string;
}

export const useCanonicalCollaborator = (uid?: string, fallback?: Partial<CanonicalCollaboratorIdentity>) => {
  const [identity, setIdentity] = useState<CanonicalCollaboratorIdentity>({
    name: fallback?.name || "Researcher",
    photo: fallback?.photo || "",
    designation: fallback?.designation || "",
    affiliation: fallback?.affiliation || "",
  });

  useEffect(() => {
    setIdentity({ name: fallback?.name || "Researcher", photo: fallback?.photo || "", designation: fallback?.designation || "", affiliation: fallback?.affiliation || "" });
    if (!uid) return;
    return onSnapshot(query(collection(db, "collaborators"), where("uid", "==", uid)), (snapshot) => {
      const profile = snapshot.docs[0]?.data();
      if (!profile) return;
      setIdentity({
        name: String(profile.name || fallback?.name || "Researcher"),
        photo: String(profile.photo || fallback?.photo || ""),
        designation: String(profile.designation || ""),
        affiliation: String(profile.affiliation || ""),
      });
    }, () => undefined);
  }, [uid, fallback?.name, fallback?.photo, fallback?.designation, fallback?.affiliation]);

  return identity;
};
