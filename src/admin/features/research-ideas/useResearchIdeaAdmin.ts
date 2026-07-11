import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../../firebase/config";
import type { Comment, ResearchIdea } from "../../../types";

export const useResearchIdeaAdmin = () => {
  const [ideas, setIdeas] = useState<ResearchIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => onSnapshot(query(collection(db, "researchIdeas"), orderBy("createdAt", "desc")), (snapshot) => { setIdeas(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ResearchIdea)); setLoading(false); }, (failure) => { setError(failure.message); setLoading(false); }), []);
  return { ideas, loading, error };
};

export const useIdeaComments = (ideaId?: string) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!ideaId) { setComments([]); return; }
    setLoading(true);
    return onSnapshot(query(collection(db, "comments"), where("ideaId", "==", ideaId)), (snapshot) => { setComments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Comment).sort((a, b) => a.createdAt.localeCompare(b.createdAt))); setLoading(false); }, () => setLoading(false));
  }, [ideaId]);
  return { comments, loading };
};
