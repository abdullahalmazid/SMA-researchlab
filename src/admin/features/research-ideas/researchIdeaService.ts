import { collection, deleteDoc, doc, getDocs, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../../../firebase/config";
import type { ResearchIdea } from "../../../types";

export type ResearchIdeaDraft = Pick<ResearchIdea, "title" | "shortDescription" | "fullDescription" | "tags" | "isPublished" | "isHidden" | "isFlagged" | "isPinned">;
export const updateResearchIdea = (id: string, draft: ResearchIdeaDraft) => updateDoc(doc(db, "researchIdeas", id), { ...draft, updatedAt: new Date().toISOString() });
export const patchResearchIdea = (id: string, values: Partial<ResearchIdea>) => updateDoc(doc(db, "researchIdeas", id), { ...values, updatedAt: new Date().toISOString() });
export const removeResearchIdea = async (id: string) => {
  const comments = await getDocs(query(collection(db, "comments"), where("ideaId", "==", id)));
  const batch = writeBatch(db);
  comments.docs.forEach((comment) => batch.delete(comment.ref));
  batch.delete(doc(db, "researchIdeas", id));
  await batch.commit();
};
export const removeResearchComment = (id: string) => deleteDoc(doc(db, "comments", id));
