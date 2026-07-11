import type { ThemeSettings } from "../../types";

export type ChatThemeMode = "lab" | "light" | "dark" | "monochrome" | "midnight" | "soft-blue";
export type ChatDensity = "comfortable" | "compact";
export interface ChatAppearance { mode: ChatThemeMode; density: ChatDensity; pattern: boolean; reduceMotion: boolean; }
export interface ChatTokens { app: string; surface: string; surfaceAlt: string; sidebar: string; border: string; text: string; muted: string; accent: string; outgoing: string; incoming: string; danger: string; }

const luminance = (hex: string) => { const value = hex.replace("#", ""); if (value.length !== 6) return 255; const [r,g,b] = [0,2,4].map((index) => parseInt(value.slice(index,index+2),16)); return .2126*r+.7152*g+.0722*b; };
export const chatTokensFor = (mode: ChatThemeMode, lab: ThemeSettings): ChatTokens => {
  if (mode === "dark") return { app:"#0b1020",surface:"#111827",surfaceAlt:"#182235",sidebar:"#0f172a",border:"#263449",text:"#f1f5f9",muted:"#94a3b8",accent:"#38bdf8",outgoing:"#164e63",incoming:"#1f2937",danger:"#fb7185" };
  if (mode === "midnight") return { app:"#050816",surface:"#0b1224",surfaceAlt:"#101a31",sidebar:"#070d1d",border:"#1e2c49",text:"#eef2ff",muted:"#8796b5",accent:"#818cf8",outgoing:"#312e81",incoming:"#18213a",danger:"#f87171" };
  if (mode === "monochrome") return { app:"#f3f3f1",surface:"#ffffff",surfaceAlt:"#f5f5f4",sidebar:"#fafaf9",border:"#dededb",text:"#171717",muted:"#737373",accent:"#262626",outgoing:"#e5e5e5",incoming:"#ffffff",danger:"#b91c1c" };
  if (mode === "soft-blue") return { app:"#edf5fb",surface:"#ffffff",surfaceAlt:"#f1f7fc",sidebar:"#f8fbfe",border:"#d6e5f1",text:"#17324d",muted:"#6b8298",accent:"#2583c5",outgoing:"#d8effc",incoming:"#ffffff",danger:"#dc5670" };
  if (mode === "light") return { app:"#f1f5f9",surface:"#ffffff",surfaceAlt:"#f8fafc",sidebar:"#ffffff",border:"#dbe5ef",text:"#0f172a",muted:"#64748b",accent:"#0284c7",outgoing:"#d9f2ff",incoming:"#ffffff",danger:"#e11d48" };
  const dark = luminance(lab.backgroundColor) < 140;
  return dark ? { app:lab.backgroundColor,surface:"#111827",surfaceAlt:"#172033",sidebar:lab.navbarColor,border:"rgba(255,255,255,.14)",text:"#f1f5f9",muted:"#a5b4c7",accent:lab.secondaryColor,outgoing:lab.primaryColor,incoming:"#1f2937",danger:"#fb7185" } : { app:lab.backgroundColor,surface:"#ffffff",surfaceAlt:"#f8fafc",sidebar:"#ffffff",border:"#dbe5ef",text:"#0f172a",muted:"#64748b",accent:lab.secondaryColor,outgoing:`${lab.secondaryColor}22`,incoming:"#ffffff",danger:"#e11d48" };
};
export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = { mode:"lab",density:"comfortable",pattern:true,reduceMotion:false };
