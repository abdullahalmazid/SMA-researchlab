import type { ThemeSettings } from "../types";

/**
 * Website colour tokens.
 *
 * The six brand colours (primary, secondary, accent, page, navigation, footer)
 * are always set. Everything else — cards, text, borders, text on the navbar,
 * footer, hero and accent buttons — can be set explicitly in Theme Control or
 * left empty, in which case it's derived here so it always contrasts with the
 * surface it sits on. Every public page reads these through CSS variables.
 */

export type DetailKey =
  | "surfaceColor"
  | "surfaceAltColor"
  | "headingColor"
  | "textColor"
  | "mutedColor"
  | "borderColor"
  | "navbarTextColor"
  | "footerTextColor"
  | "heroTextColor"
  | "onAccentColor"
  | "onSecondaryColor";

export const DETAIL_KEYS: DetailKey[] = [
  "surfaceColor",
  "surfaceAltColor",
  "headingColor",
  "textColor",
  "mutedColor",
  "borderColor",
  "navbarTextColor",
  "footerTextColor",
  "heroTextColor",
  "onAccentColor",
  "onSecondaryColor",
];

const HEX = /^#[0-9a-f]{6}$/i;

const rgb = (hex: string) => {
  const clean = HEX.test(hex) ? hex.slice(1) : "f8fafc";
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number];
};

const toHex = (channels: number[]) =>
  `#${channels.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;

/** WCAG relative luminance. */
export const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export const isDark = (hex: string) => luminance(hex) < 0.18;

/** Blend `hex` toward `toward` by `amount` (0–1). */
const mix = (hex: string, toward: string, amount: number) => {
  const a = rgb(hex);
  const b = rgb(toward);
  return toHex(a.map((c, i) => c + (b[i] - c) * amount));
};

/** Near-white or near-black, whichever reads better on `background`. */
export const readableOn = (background: string) =>
  contrast("#ffffff", background) >= contrast("#0f172a", background) ? "#ffffff" : "#0f172a";

const pick = (value: string | undefined, fallback: string) => (value && HEX.test(value) ? value : fallback);

/** Every token with explicit values where set and derived values otherwise. */
export const resolveTokens = (theme: ThemeSettings): Record<DetailKey, string> => {
  const bg = theme.backgroundColor;
  const dark = isDark(bg);
  const heading = pick(theme.headingColor, dark ? "#f8fafc" : "#0f172a");
  return {
    surfaceColor: pick(theme.surfaceColor, dark ? mix(bg, "#ffffff", 0.06) : "#ffffff"),
    surfaceAltColor: pick(theme.surfaceAltColor, dark ? mix(bg, "#ffffff", 0.03) : mix(bg, "#0f172a", 0.03)),
    headingColor: heading,
    textColor: pick(theme.textColor, dark ? "#cbd5e1" : "#334155"),
    mutedColor: pick(theme.mutedColor, dark ? "#94a3b8" : "#64748b"),
    borderColor: pick(theme.borderColor, dark ? mix(bg, "#ffffff", 0.14) : mix(bg, "#0f172a", 0.1)),
    navbarTextColor: pick(theme.navbarTextColor, readableOn(theme.navbarColor)),
    footerTextColor: pick(theme.footerTextColor, readableOn(theme.footerColor)),
    heroTextColor: pick(theme.heroTextColor, readableOn(theme.primaryColor)),
    onAccentColor: pick(theme.onAccentColor, readableOn(theme.accentColor)),
    onSecondaryColor: pick(theme.onSecondaryColor, readableOn(theme.secondaryColor)),
  };
};

export const CSS_VARS: Record<DetailKey, string> = {
  surfaceColor: "--site-surface",
  surfaceAltColor: "--site-surface-alt",
  headingColor: "--site-heading",
  textColor: "--site-text",
  mutedColor: "--site-muted",
  borderColor: "--site-border",
  navbarTextColor: "--nav-text",
  footerTextColor: "--footer-text",
  heroTextColor: "--hero-text",
  onAccentColor: "--on-accent",
  onSecondaryColor: "--on-secondary",
};

/** CSS custom properties for a theme — used by the site and by previews. */
export const themeVariables = (theme: ThemeSettings): Record<string, string> => {
  const tokens = resolveTokens(theme);
  return {
    "--color-primary": theme.primaryColor,
    "--color-secondary": theme.secondaryColor,
    "--color-accent": theme.accentColor,
    "--color-bg": theme.backgroundColor,
    "--color-navbar": theme.navbarColor,
    "--color-footer": theme.footerColor,
    ...Object.fromEntries(DETAIL_KEYS.map((key) => [CSS_VARS[key], tokens[key]])),
    // Accent-coloured text on the bars (active menu item, wordmark, kickers):
    // the accent when it's readable there, else the secondary, else plain text.
    "--nav-accent": accentOn(theme, theme.navbarColor, tokens.navbarTextColor),
    "--footer-accent": accentOn(theme, theme.footerColor, tokens.footerTextColor),
    "--hero-accent": accentOn(theme, theme.primaryColor, tokens.heroTextColor),
    // Brand colours used as text on cards/page: kept when readable, else the heading colour.
    "--primary-ink": inkOn(theme.primaryColor, tokens.surfaceColor, tokens.headingColor),
    "--secondary-ink": inkOn(theme.secondaryColor, tokens.surfaceColor, tokens.headingColor),
    "--accent-ink": inkOn(theme.accentColor, tokens.surfaceColor, tokens.headingColor),
  };
};

const inkOn = (color: string, surface: string, fallback: string) => (contrast(color, surface) >= 3 ? color : fallback);

const accentOn = (theme: ThemeSettings, background: string, text: string) =>
  contrast(theme.accentColor, background) >= 3
    ? theme.accentColor
    : contrast(theme.secondaryColor, background) >= 3
      ? theme.secondaryColor
      : text;
