import type { ThemeSettings } from "../types";

/**
 * Curated website themes. Each sets the six brand colours and a font pairing;
 * every detail colour (cards, text, borders, text on colour) is derived from
 * them by src/theme/tokens.ts, which keeps text readable automatically.
 *
 * All presets are checked for contrast (scratch check: hero text, nav and
 * footer text, button labels and body text all ≥ 4.5:1).
 */

export const FONTS = [
  "'Inter', sans-serif",
  "'Manrope', sans-serif",
  "'IBM Plex Sans', sans-serif",
  "'Space Grotesk', sans-serif",
  "'Source Sans 3', sans-serif",
  "'Poppins', sans-serif",
  "'Nunito', sans-serif",
  "'Lato', sans-serif",
  "'Roboto', sans-serif",
  "'Fraunces', serif",
  "'DM Serif Display', serif",
  "'Playfair Display', serif",
  "'Merriweather', serif",
];

export interface ThemePreset {
  name: string;
  description: string;
  settings: ThemeSettings;
}

const theme = (
  colors: Pick<ThemeSettings, "backgroundColor" | "primaryColor" | "secondaryColor" | "accentColor" | "navbarColor" | "footerColor">,
  headingFont: string,
  fontFamily: string,
): ThemeSettings => ({ ...colors, headingFont, fontFamily });

export const PRESETS: ThemePreset[] = [
  /* ── Light ── */
  {
    name: "Oxford Scholar",
    description: "Ivory paper, deep navy and old gold — classic academic.",
    settings: theme(
      { backgroundColor: "#f7f5f0", primaryColor: "#1b2a4a", secondaryColor: "#2c5f9e", accentColor: "#c9a24b", navbarColor: "#14213d", footerColor: "#0f1a30" },
      "'Fraunces', serif",
      "'Inter', sans-serif",
    ),
  },
  {
    name: "Nordic Clean",
    description: "Bright, airy and modern with a crisp white bar.",
    settings: theme(
      { backgroundColor: "#f6f8fa", primaryColor: "#1f3a5f", secondaryColor: "#2563eb", accentColor: "#38bdf8", navbarColor: "#ffffff", footerColor: "#0f172a" },
      "'Manrope', sans-serif",
      "'Manrope', sans-serif",
    ),
  },
  {
    name: "Sage Laboratory",
    description: "Calm forest greens with warm amber — natural and grounded.",
    settings: theme(
      { backgroundColor: "#f5f7f2", primaryColor: "#2f4a3a", secondaryColor: "#2f7a52", accentColor: "#d9a54a", navbarColor: "#23382c", footerColor: "#1a2a21" },
      "'Fraunces', serif",
      "'Source Sans 3', sans-serif",
    ),
  },
  {
    name: "Ocean Research",
    description: "Deep sea blue and a sunset-orange accent.",
    settings: theme(
      { backgroundColor: "#f4f8fb", primaryColor: "#0b3c5d", secondaryColor: "#1b6f93", accentColor: "#f2a541", navbarColor: "#0b3c5d", footerColor: "#082b43" },
      "'IBM Plex Sans', sans-serif",
      "'IBM Plex Sans', sans-serif",
    ),
  },
  {
    name: "Terracotta Studio",
    description: "Warm clay and saffron on cream — editorial and friendly.",
    settings: theme(
      { backgroundColor: "#fbf7f2", primaryColor: "#7a3b26", secondaryColor: "#b3492a", accentColor: "#e9b949", navbarColor: "#fffaf3", footerColor: "#3d2219" },
      "'Playfair Display', serif",
      "'Lato', sans-serif",
    ),
  },
  {
    name: "Lavender Mist",
    description: "Soft lilac with indigo depth and a rose highlight.",
    settings: theme(
      { backgroundColor: "#f8f7fc", primaryColor: "#3c2f6b", secondaryColor: "#5b4bd6", accentColor: "#f59fb0", navbarColor: "#2a2150", footerColor: "#1d1738" },
      "'Poppins', sans-serif",
      "'Inter', sans-serif",
    ),
  },
  {
    name: "Coral Reef",
    description: "Navy anchored, coral and sunshine accents — energetic.",
    settings: theme(
      { backgroundColor: "#fff8f5", primaryColor: "#1d3557", secondaryColor: "#c9303e", accentColor: "#ffb703", navbarColor: "#1d3557", footerColor: "#14243d" },
      "'Space Grotesk', sans-serif",
      "'Inter', sans-serif",
    ),
  },
  {
    name: "Paper & Ink",
    description: "Black-and-white editorial with a single honey highlight.",
    settings: theme(
      { backgroundColor: "#fafaf9", primaryColor: "#18181b", secondaryColor: "#3f3f46", accentColor: "#f5c542", navbarColor: "#ffffff", footerColor: "#18181b" },
      "'DM Serif Display', serif",
      "'Source Sans 3', sans-serif",
    ),
  },
  {
    name: "Navy Classic",
    description: "The original lab look — navy, blue and amber.",
    settings: theme(
      { backgroundColor: "#f8fafc", primaryColor: "#1e3a5f", secondaryColor: "#2563eb", accentColor: "#f59e0b", navbarColor: "#1e3a5f", footerColor: "#111827" },
      "'Inter', sans-serif",
      "'Inter', sans-serif",
    ),
  },

  /* ── Dark ── */
  {
    name: "Midnight Observatory",
    description: "Deep night blue, starlight blue and gold.",
    settings: theme(
      { backgroundColor: "#0b1020", primaryColor: "#121a33", secondaryColor: "#60a5fa", accentColor: "#fbbf24", navbarColor: "#0a0f1e", footerColor: "#070b16" },
      "'Space Grotesk', sans-serif",
      "'Inter', sans-serif",
    ),
  },
  {
    name: "Obsidian Gold",
    description: "Near-black luxury with gilded accents.",
    settings: theme(
      { backgroundColor: "#0c0c0d", primaryColor: "#17171a", secondaryColor: "#d4af37", accentColor: "#f5d06f", navbarColor: "#0a0a0b", footerColor: "#060607" },
      "'Playfair Display', serif",
      "'Inter', sans-serif",
    ),
  },
  {
    name: "Graphite Mint",
    description: "Charcoal with a fresh mint signal — technical and clean.",
    settings: theme(
      { backgroundColor: "#0f1412", primaryColor: "#16201c", secondaryColor: "#34d399", accentColor: "#a7f3d0", navbarColor: "#0c110f", footerColor: "#090d0b" },
      "'Manrope', sans-serif",
      "'Manrope', sans-serif",
    ),
  },
  {
    name: "Deep Plum",
    description: "Velvet purple night with orchid and blush.",
    settings: theme(
      { backgroundColor: "#130d1c", primaryColor: "#22163a", secondaryColor: "#c084fc", accentColor: "#f9a8d4", navbarColor: "#100a19", footerColor: "#0b0712" },
      "'Poppins', sans-serif",
      "'Inter', sans-serif",
    ),
  },
  {
    name: "Carbon Ember",
    description: "Pure carbon with glowing ember orange.",
    settings: theme(
      { backgroundColor: "#111111", primaryColor: "#1c1c1c", secondaryColor: "#f97316", accentColor: "#fdba74", navbarColor: "#0d0d0d", footerColor: "#080808" },
      "'Space Grotesk', sans-serif",
      "'IBM Plex Sans', sans-serif",
    ),
  },
  {
    name: "Polar Night",
    description: "Arctic slate with ice-blue light.",
    settings: theme(
      { backgroundColor: "#0e141b", primaryColor: "#16212d", secondaryColor: "#38bdf8", accentColor: "#7dd3fc", navbarColor: "#0b1118", footerColor: "#080c12" },
      "'IBM Plex Sans', sans-serif",
      "'IBM Plex Sans', sans-serif",
    ),
  },
];
