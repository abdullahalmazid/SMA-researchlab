import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { db, isFirebaseConfigured } from "../firebase/config";

type ContentMap = Record<string, string>;
interface EditableContentValue { content: ContentMap; loading: boolean; save: (id: string, value: string) => Promise<void>; }
const EditableContentContext = createContext<EditableContentValue | null>(null);

export const EditableContentProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [content, setContent] = useState<ContentMap>({});
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    return onSnapshot(collection(db, "siteContent"), (snapshot) => {
      const next: ContentMap = {};
      snapshot.forEach((item) => { if (typeof item.data().value === "string") next[item.id] = item.data().value; });
      setContent(next);
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const save = useCallback(async (id: string, value: string) => {
    setContent((current) => ({ ...current, [id]: value }));
    if (!isFirebaseConfigured) { localStorage.setItem(`syedlab_content_${id}`, value); return; }
    await setDoc(doc(db, "siteContent", id), { value, updatedAt: new Date().toISOString() }, { merge: true });
  }, []);

  const value = useMemo(() => ({ content, loading, save }), [content, loading, save]);
  return <EditableContentContext.Provider value={value}>{children}</EditableContentContext.Provider>;
};

export const useEditableContentStore = () => {
  const value = useContext(EditableContentContext);
  if (!value) throw new Error("useEditableContentStore must be used inside EditableContentProvider");
  return value;
};
