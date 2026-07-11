import React, { createContext, useContext, useMemo, useState } from "react";

export type PreviewMode = "admin" | "lab_head" | "collaborator";
const Context = createContext<{ mode: PreviewMode; setMode: (mode: PreviewMode) => void }>({ mode: "admin", setMode: () => undefined });

export const AdminPreviewProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [mode, setModeState] = useState<PreviewMode>(() => (sessionStorage.getItem("syedlab_preview_mode") as PreviewMode) || "admin");
  const value = useMemo(() => ({ mode, setMode: (next: PreviewMode) => { sessionStorage.setItem("syedlab_preview_mode", next); setModeState(next); } }), [mode]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useAdminPreview = () => useContext(Context);
