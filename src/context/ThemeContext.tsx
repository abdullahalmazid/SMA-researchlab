import React, { createContext, useContext, useEffect } from "react";
import { useTheme as useThemeData } from "../firebase/hooks";
import type { ThemeSettings } from "../types";

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return { r: 248, g: 250, b: 252 };
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
};

const isDarkColor = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 140;
};

interface ThemeContextValue {
  theme: ThemeSettings;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const theme = useThemeData();

  // Inject CSS variables into :root whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    const darkMode = isDarkColor(theme.backgroundColor);

    root.style.setProperty("--color-primary", theme.primaryColor);
    root.style.setProperty("--color-secondary", theme.secondaryColor);
    root.style.setProperty("--color-accent", theme.accentColor);
    root.style.setProperty("--color-bg", theme.backgroundColor);
    root.style.setProperty("--color-navbar", theme.navbarColor);
    root.style.setProperty("--color-footer", theme.footerColor);
    root.style.setProperty("--font-body", theme.fontFamily);
    root.style.setProperty("--font-heading", theme.headingFont);
    root.dataset.themeMode = darkMode ? "dark" : "light";

    // Apply font to body
    document.body.style.fontFamily = theme.fontFamily;
    document.body.style.backgroundColor = theme.backgroundColor;
    // Utility classes may otherwise override inherited typography. Keep the
    // selected theme authoritative without mutating every page component.
    root.style.fontFamily = theme.fontFamily;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx)
    throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
};
