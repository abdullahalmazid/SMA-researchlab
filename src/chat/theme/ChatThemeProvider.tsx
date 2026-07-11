import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useThemeContext } from "../../context/ThemeContext";
import { chatTokensFor, DEFAULT_CHAT_APPEARANCE, type ChatAppearance } from "./chatThemes";
const STORAGE_KEY="syedlab_chat_appearance_v1";
const Context=createContext<ReturnType<typeof useValue>|null>(null);
const useValue=()=>{ const {theme}=useThemeContext(); const [appearance,setAppearance]=useState<ChatAppearance>(()=>{try{return {...DEFAULT_CHAT_APPEARANCE,...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")};}catch{return DEFAULT_CHAT_APPEARANCE;}}); useEffect(()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(appearance)),[appearance]); const tokens=useMemo(()=>chatTokensFor(appearance.mode,theme),[appearance.mode,theme]); const reset=()=>setAppearance(DEFAULT_CHAT_APPEARANCE); return {appearance,setAppearance,tokens,reset}; };
export const ChatThemeProvider:React.FC<React.PropsWithChildren>=({children})=><Context.Provider value={useValue()}>{children}</Context.Provider>;
export const useChatTheme=()=>{const value=useContext(Context);if(!value)throw new Error("useChatTheme must be used inside ChatThemeProvider");return value;};
