import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import { db } from "../firebase/config";
import { useTheme } from "../firebase/hooks";
import type { ThemeSettings } from "../types";

export const FONTS = [
  "'Inter', sans-serif",
  "'Roboto', sans-serif",
  "'Poppins', sans-serif",
  "'Merriweather', serif",
  "'Playfair Display', serif",
  "'Source Sans 3', sans-serif",
  "'Lato', sans-serif",
  "'Nunito', sans-serif",
];

export const PRESETS: { name: string; settings: ThemeSettings }[] = [
  {
    name: "Midnight Dark",
    settings: {
      primaryColor: "#0f172a",
      secondaryColor: "#38bdf8",
      accentColor: "#f59e0b",
      backgroundColor: "#0b1220",
      navbarColor: "#020617",
      footerColor: "#020617",
      fontFamily: "'Inter', sans-serif",
      headingFont: "'Inter', sans-serif",
    },
  },
  {
    name: "Notice Board Crimson",
    settings: {
      primaryColor: "#991b1b",
      secondaryColor: "#b91c1c",
      accentColor: "#fbbf24",
      backgroundColor: "#f8f6f3",
      navbarColor: "#111827",
      footerColor: "#111827",
      fontFamily: "'Lato', sans-serif",
      headingFont: "'Poppins', sans-serif",
    },
  },
  {
    name: "Club Maroon Formal",
    settings: {
      primaryColor: "#7f1d1d",
      secondaryColor: "#9f1239",
      accentColor: "#d4af37",
      backgroundColor: "#f7f4ef",
      navbarColor: "#1f2937",
      footerColor: "#111827",
      fontFamily: "'Source Sans 3', sans-serif",
      headingFont: "'Merriweather', serif",
    },
  },
  {
    name: "Scarlet Carbon",
    settings: {
      primaryColor: "#0f172a",
      secondaryColor: "#dc2626",
      accentColor: "#f59e0b",
      backgroundColor: "#f3f4f6",
      navbarColor: "#111827",
      footerColor: "#020617",
      fontFamily: "'Inter', sans-serif",
      headingFont: "'Poppins', sans-serif",
    },
  },
  {
    name: "Grand Hall Burgundy",
    settings: {
      primaryColor: "#6b0f1a",
      secondaryColor: "#a4161a",
      accentColor: "#ffd166",
      backgroundColor: "#faf8f5",
      navbarColor: "#2b2d42",
      footerColor: "#1a1f2f",
      fontFamily: "'Lato', sans-serif",
      headingFont: "'Playfair Display', serif",
    },
  },
  {
    name: "Obsidian Gold",
    settings: {
      primaryColor: "#111827",
      secondaryColor: "#d4af37",
      accentColor: "#f59e0b",
      backgroundColor: "#0b0f19",
      navbarColor: "#030712",
      footerColor: "#030712",
      fontFamily: "'Inter', sans-serif",
      headingFont: "'Playfair Display', serif",
    },
  },
  {
    name: "Graphite Cyan",
    settings: {
      primaryColor: "#0b1324",
      secondaryColor: "#06b6d4",
      accentColor: "#22d3ee",
      backgroundColor: "#0a1222",
      navbarColor: "#020817",
      footerColor: "#020817",
      fontFamily: "'Source Sans 3', sans-serif",
      headingFont: "'Poppins', sans-serif",
    },
  },
  {
    name: "Nordic Aurora",
    settings: {
      primaryColor: "#1f2937",
      secondaryColor: "#4f46e5",
      accentColor: "#14b8a6",
      backgroundColor: "#eef2ff",
      navbarColor: "#1f2937",
      footerColor: "#111827",
      fontFamily: "'Nunito', sans-serif",
      headingFont: "'Nunito', sans-serif",
    },
  },
  {
    name: "Arctic Glass",
    settings: {
      primaryColor: "#1e3a8a",
      secondaryColor: "#0ea5e9",
      accentColor: "#f97316",
      backgroundColor: "#f8fafc",
      navbarColor: "#1e3a8a",
      footerColor: "#0f172a",
      fontFamily: "'Inter', sans-serif",
      headingFont: "'Inter', sans-serif",
    },
  },
  {
    name: "Emerald Luxe",
    settings: {
      primaryColor: "#14532d",
      secondaryColor: "#059669",
      accentColor: "#f59e0b",
      backgroundColor: "#ecfdf5",
      navbarColor: "#14532d",
      footerColor: "#052e16",
      fontFamily: "'Poppins', sans-serif",
      headingFont: "'Merriweather', serif",
    },
  },
  {
    name: "Terracotta Journal",
    settings: {
      primaryColor: "#7c2d12",
      secondaryColor: "#ea580c",
      accentColor: "#fbbf24",
      backgroundColor: "#fff7ed",
      navbarColor: "#7c2d12",
      footerColor: "#431407",
      fontFamily: "'Lato', sans-serif",
      headingFont: "'Playfair Display', serif",
    },
  },
  {
    name: "Royal Amethyst",
    settings: {
      primaryColor: "#312e81",
      secondaryColor: "#7c3aed",
      accentColor: "#f472b6",
      backgroundColor: "#f5f3ff",
      navbarColor: "#312e81",
      footerColor: "#1e1b4b",
      fontFamily: "'Nunito', sans-serif",
      headingFont: "'Nunito', sans-serif",
    },
  },
  {
    name: "Sapphire Sand",
    settings: {
      primaryColor: "#0f2a43",
      secondaryColor: "#2563eb",
      accentColor: "#f59e0b",
      backgroundColor: "#f8f5f0",
      navbarColor: "#0f2a43",
      footerColor: "#0b1f33",
      fontFamily: "'Source Sans 3', sans-serif",
      headingFont: "'Merriweather', serif",
    },
  },
  {
    name: "Rosewood Noir",
    settings: {
      primaryColor: "#2a0f1f",
      secondaryColor: "#be185d",
      accentColor: "#fb7185",
      backgroundColor: "#120711",
      navbarColor: "#0b0610",
      footerColor: "#0b0610",
      fontFamily: "'Lato', sans-serif",
      headingFont: "'Playfair Display', serif",
    },
  },
  {
    name: "Cedar Slate Editorial",
    settings: {
      primaryColor: "#2d3142",
      secondaryColor: "#b56576",
      accentColor: "#e09f3e",
      backgroundColor: "#f4f1de",
      navbarColor: "#1f2233",
      footerColor: "#11131f",
      fontFamily: "'Source Sans 3', sans-serif",
      headingFont: "'Playfair Display', serif",
    },
  },
  {
    name: "Azure Bloom",
    settings: {
      primaryColor: "#041f3d",
      secondaryColor: "#0064a5",
      accentColor: "#e14a92",
      backgroundColor: "#f7f6fb",
      navbarColor: "#052c6d",
      footerColor: "#3b82c4",
      fontFamily: "'Poppins', sans-serif",
      headingFont: "'Nunito', sans-serif",
    },
  },
  {
    name: "Seafoam Current",
    settings: {
      primaryColor: "#2f7f7f",
      secondaryColor: "#3ea292",
      accentColor: "#8ed1b2",
      backgroundColor: "#eaf6f2",
      navbarColor: "#255f57",
      footerColor: "#1b4440",
      fontFamily: "'Lato', sans-serif",
      headingFont: "'Poppins', sans-serif",
    },
  },
  {
    name: "Mint Pebble",
    settings: {
      primaryColor: "#4b9a8f",
      secondaryColor: "#67b9b5",
      accentColor: "#b1d9c2",
      backgroundColor: "#f1f7f3",
      navbarColor: "#2f6f66",
      footerColor: "#254f4a",
      fontFamily: "'Source Sans 3', sans-serif",
      headingFont: "'Merriweather', serif",
    },
  },
  {
    name: "Lemon Lagoon Pop",
    settings: {
      primaryColor: "#0f7c96",
      secondaryColor: "#35b7d8",
      accentColor: "#f1cf0a",
      backgroundColor: "#f4fbfd",
      navbarColor: "#09586d",
      footerColor: "#083e4f",
      fontFamily: "'Nunito', sans-serif",
      headingFont: "'Poppins', sans-serif",
    },
  },
  {
    name: "Coral Notebook",
    settings: {
      primaryColor: "#e57967",
      secondaryColor: "#f39f79",
      accentColor: "#6db7c6",
      backgroundColor: "#fff4ef",
      navbarColor: "#b65d4f",
      footerColor: "#7e3f37",
      fontFamily: "'Lato', sans-serif",
      headingFont: "'Playfair Display', serif",
    },
  },
  {
    name: "Powder Candy",
    settings: {
      primaryColor: "#8bb7cc",
      secondaryColor: "#f2a8b5",
      accentColor: "#f0d48d",
      backgroundColor: "#f8f6fb",
      navbarColor: "#5e8297",
      footerColor: "#445d6c",
      fontFamily: "'Nunito', sans-serif",
      headingFont: "'Nunito', sans-serif",
    },
  },
  {
    name: "Pastel Orchard",
    settings: {
      primaryColor: "#9fcf93",
      secondaryColor: "#f2b37a",
      accentColor: "#f28f8f",
      backgroundColor: "#fffaf4",
      navbarColor: "#6e9768",
      footerColor: "#4e6f4b",
      fontFamily: "'Poppins', sans-serif",
      headingFont: "'Merriweather', serif",
    },
  },
  {
    name: "Ink Aqua Pastel",
    settings: {
      primaryColor: "#0d2a66",
      secondaryColor: "#147fa1",
      accentColor: "#6ac6df",
      backgroundColor: "#edf7fb",
      navbarColor: "#0a204d",
      footerColor: "#071633",
      fontFamily: "'Inter', sans-serif",
      headingFont: "'Poppins', sans-serif",
    },
  },
  {
    name: "Navy Blue (Default)",
    settings: {
      primaryColor: "#1e3a5f",
      secondaryColor: "#2563eb",
      accentColor: "#f59e0b",
      backgroundColor: "#f8fafc",
      navbarColor: "#1e3a5f",
      footerColor: "#111827",
      fontFamily: "'Inter', sans-serif",
      headingFont: "'Inter', sans-serif",
    },
  },
  {
    name: "Forest Green",
    settings: {
      primaryColor: "#14532d",
      secondaryColor: "#16a34a",
      accentColor: "#facc15",
      backgroundColor: "#f0fdf4",
      navbarColor: "#14532d",
      footerColor: "#052e16",
      fontFamily: "'Poppins', sans-serif",
      headingFont: "'Poppins', sans-serif",
    },
  },
  {
    name: "Royal Purple",
    settings: {
      primaryColor: "#3b0764",
      secondaryColor: "#7c3aed",
      accentColor: "#f472b6",
      backgroundColor: "#faf5ff",
      navbarColor: "#3b0764",
      footerColor: "#1e1b4b",
      fontFamily: "'Nunito', sans-serif",
      headingFont: "'Nunito', sans-serif",
    },
  },
  {
    name: "Crimson",
    settings: {
      primaryColor: "#7f1d1d",
      secondaryColor: "#dc2626",
      accentColor: "#fbbf24",
      backgroundColor: "#fff5f5",
      navbarColor: "#7f1d1d",
      footerColor: "#1c0a0a",
      fontFamily: "'Lato', sans-serif",
      headingFont: "'Playfair Display', serif",
    },
  },
  {
    name: "Monochrome Editorial",
    settings: { primaryColor: "#111111", secondaryColor: "#404040", accentColor: "#a3a3a3", backgroundColor: "#f7f7f5", navbarColor: "#050505", footerColor: "#050505", fontFamily: "'Source Sans 3', sans-serif", headingFont: "'Merriweather', serif" },
  },
  {
    name: "Gallery Black & White",
    settings: { primaryColor: "#18181b", secondaryColor: "#52525b", accentColor: "#d4d4d8", backgroundColor: "#ffffff", navbarColor: "#09090b", footerColor: "#09090b", fontFamily: "'Inter', sans-serif", headingFont: "'Playfair Display', serif" },
  },
  {
    name: "Oxford Paper",
    settings: { primaryColor: "#172033", secondaryColor: "#4b5563", accentColor: "#b79a5b", backgroundColor: "#f5f1e8", navbarColor: "#101827", footerColor: "#0b1220", fontFamily: "'Lato', sans-serif", headingFont: "'Merriweather', serif" },
  },
  {
    name: "Executive Graphite",
    settings: { primaryColor: "#20242a", secondaryColor: "#59636f", accentColor: "#c7a86b", backgroundColor: "#eef0f2", navbarColor: "#16191d", footerColor: "#111316", fontFamily: "'Inter', sans-serif", headingFont: "'Poppins', sans-serif" },
  },
  {
    name: "Slate & Teal",
    settings: {
      primaryColor: "#0f172a",
      secondaryColor: "#0d9488",
      accentColor: "#f97316",
      backgroundColor: "#f8fafc",
      navbarColor: "#0f172a",
      footerColor: "#020617",
      fontFamily: "'Source Sans 3', sans-serif",
      headingFont: "'Source Sans 3', sans-serif",
    },
  },
];

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "").trim();
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

const blendHex = (base: string, mixWith: string, weight = 0.5) => {
  const b = hexToRgb(base);
  const m = hexToRgb(mixWith);
  if (!b || !m) return base;

  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    b.r * (1 - w) + m.r * w,
    b.g * (1 - w) + m.g * w,
    b.b * (1 - w) + m.b * w,
  );
};

const darkenHex = (hex: string, amount = 0.2) =>
  blendHex(hex, "#000000", amount);

const presetStrips = (settings: ThemeSettings) => [
  settings.backgroundColor,
  settings.primaryColor,
  settings.secondaryColor,
  settings.accentColor,
  settings.navbarColor,
];

const isThemeMatch = (a: ThemeSettings, b: ThemeSettings) =>
  a.primaryColor === b.primaryColor &&
  a.secondaryColor === b.secondaryColor &&
  a.accentColor === b.accentColor &&
  a.backgroundColor === b.backgroundColor &&
  a.navbarColor === b.navbarColor &&
  a.footerColor === b.footerColor &&
  a.fontFamily === b.fontFamily &&
  a.headingFont === b.headingFont;

const ThemeControl: React.FC = () => {
  const currentTheme = useTheme();
  const [theme, setTheme] = useState<ThemeSettings>(currentTheme);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    setTheme(currentTheme);
  }, [currentTheme]);

  const corePalette = [
    { key: "primaryColor", label: "Primary", value: theme.primaryColor },
    {
      key: "secondaryColor",
      label: "Secondary",
      value: theme.secondaryColor,
    },
    { key: "accentColor", label: "Accent", value: theme.accentColor },
    { key: "navbarColor", label: "Navbar", value: theme.navbarColor },
    { key: "footerColor", label: "Footer", value: theme.footerColor },
  ];

  const navBlend = blendHex(theme.navbarColor, theme.secondaryColor, 0.38);
  const accentBlend = blendHex(theme.accentColor, theme.secondaryColor, 0.52);
  const footerBlend = blendHex(theme.footerColor, theme.accentColor, 0.48);

  const supportingPalette = [
    {
      key: "backgroundColor",
      label: "Background",
      swatch: theme.backgroundColor,
      hex: theme.backgroundColor,
      editableKey: "backgroundColor" as const,
    },
    {
      key: "navBlend",
      label: "Nav Blend",
      swatch: `linear-gradient(140deg, ${theme.navbarColor} 0%, ${navBlend} 100%)`,
      hex: `${theme.navbarColor} / ${navBlend}`,
      editableKey: null,
    },
    {
      key: "primaryDeep",
      label: "Primary Deep",
      swatch: `linear-gradient(140deg, ${darkenHex(theme.primaryColor, 0.35)} 0%, ${blendHex(theme.primaryColor, theme.secondaryColor, 0.45)} 100%)`,
      hex: `${darkenHex(theme.primaryColor, 0.35)} / ${blendHex(theme.primaryColor, theme.secondaryColor, 0.45)}`,
      editableKey: null,
    },
    {
      key: "accentBlend",
      label: "Accent Blend",
      swatch: `linear-gradient(140deg, ${accentBlend} 0%, ${theme.accentColor} 100%)`,
      hex: `${accentBlend} / ${theme.accentColor}`,
      editableKey: null,
    },
    {
      key: "footerBlend",
      label: "Footer Blend",
      swatch: `linear-gradient(140deg, ${theme.footerColor} 0%, ${footerBlend} 100%)`,
      hex: `${theme.footerColor} / ${footerBlend}`,
      editableKey: null,
    },
  ];

  const applyTheme = async (t: ThemeSettings) => {
    setSaving(true);
    setError("");
    try {
      await setDoc(doc(db, "theme", "settings"), { ...t, updatedAt: new Date().toISOString() }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (failure) {
      setError(String((failure as Error).message || failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-2xl font-black"
            style={{ color: "var(--color-primary)" }}
          >
            Theme Control
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Changes apply globally to the entire website in real time.
          </p>
        </div>
        <button
          onClick={() => applyTheme(theme)}
          disabled={saving}
          className="text-sm font-bold px-5 py-2.5 rounded-xl text-white disabled:opacity-60"
          style={{
            background: saved ? "#22c55e" : "var(--color-primary)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {saved ? "✓ Applied!" : saving ? "Applying..." : "Apply Theme"}
        </button>
      </div>
      {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">Theme could not be applied: {error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Custom Colors */}
        <div
          className="bg-white rounded-2xl p-6 shadow-sm border"
          style={{ borderColor: "#e5e7eb" }}
        >
          <h3 className="font-bold text-base mb-5 text-gray-800">
            Palette Structure
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Live palette built from the current draft colors. Click swatches to
            edit.
          </p>

          <div className="mx-auto w-full max-w-3xl">
            <div className="flex flex-wrap sm:flex-nowrap justify-center gap-4 sm:gap-3">
              {corePalette.map((item) => (
                <div
                  key={item.key}
                  className="w-[58px] flex flex-col items-center"
                >
                  <label
                    className="relative block w-[58px] h-[132px] rounded-[30px] overflow-hidden cursor-pointer"
                    title={`${item.label}: ${item.value}`}
                  >
                    <span
                      className="absolute inset-0"
                      style={{ background: item.value }}
                    />
                    <input
                      type="color"
                      value={item.value}
                      onChange={(e) =>
                        setTheme((p) => ({ ...p, [item.key]: e.target.value }))
                      }
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      aria-label={`${item.label} color`}
                    />
                  </label>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600 text-center leading-none">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.04em] text-gray-500 text-center leading-none">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap sm:flex-nowrap justify-center gap-5 sm:gap-4">
              {supportingPalette.map((item) => (
                <div
                  key={item.key}
                  className="w-[70px] flex flex-col items-center"
                >
                  {item.editableKey ? (
                    <label
                      className="relative block w-[62px] h-[62px] rounded-full overflow-hidden cursor-pointer"
                      title={`${item.label}: ${item.hex}`}
                    >
                      <span
                        className="absolute inset-0"
                        style={{ background: item.swatch }}
                      />
                      <input
                        type="color"
                        value={theme[item.editableKey] as string}
                        onChange={(e) =>
                          setTheme((p) => ({
                            ...p,
                            [item.editableKey]: e.target.value,
                          }))
                        }
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        aria-label={`${item.label} color`}
                      />
                    </label>
                  ) : (
                    <div
                      className="w-[62px] h-[62px] rounded-full"
                      style={{ background: item.swatch }}
                      title={`${item.label}: ${item.hex}`}
                    />
                  )}
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600 text-center leading-none">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.04em] text-gray-500 text-center leading-none">
                    {item.hex}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Font pickers */}
          <div
            className="mt-6 pt-5 border-t"
            style={{ borderColor: "#e5e7eb" }}
          >
            <h4 className="font-semibold text-sm text-gray-700 mb-3">Fonts</h4>
            {(["fontFamily", "headingFont"] as const).map((fk) => (
              <div key={fk} className="mb-3">
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">
                  {fk === "fontFamily" ? "Body Font" : "Heading Font"}
                </label>
                <select
                  value={theme[fk]}
                  onChange={(e) =>
                    setTheme((p) => ({ ...p, [fk]: e.target.value }))
                  }
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ borderColor: "#d1d5db", fontFamily: theme[fk] }}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>
                      {f.replace(/'/g, "").split(",")[0]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div
          className="bg-white rounded-2xl p-6 shadow-sm border"
          style={{ borderColor: "#e5e7eb" }}
        >
          <h3 className="font-bold text-base mb-5 text-gray-800">
            Preset Palettes
          </h3>
          <div className="flex flex-col gap-3">
            {PRESETS.map((p) =>
              (() => {
                const isCurrent = isThemeMatch(theme, p.settings);
                const stripColors = presetStrips(p.settings);

                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setTheme(p.settings);
                      applyTheme(p.settings);
                    }}
                    className="w-full text-left rounded-xl border px-4 py-3 transition-colors"
                    style={{
                      borderColor: isCurrent
                        ? "var(--color-secondary)"
                        : "#e5e7eb",
                      background: isCurrent ? "#f8fafc" : "white",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-[92px] h-[56px] rounded-xl overflow-hidden grid grid-cols-5 border flex-shrink-0"
                        style={{ borderColor: "#d1d5db" }}
                      >
                        {stripColors.map((c, index) => (
                          <div
                            key={`${p.name}-${index}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {p.name}
                        </p>
                        <p
                          className="text-xs text-gray-400"
                          style={{ fontFamily: p.settings.fontFamily }}
                        >
                          {
                            p.settings.fontFamily
                              .replace(/'/g, "")
                              .split(",")[0]
                          }
                        </p>
                      </div>

                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        {isCurrent && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              color: "var(--color-secondary)",
                              background: "rgba(37,99,235,0.08)",
                            }}
                          >
                            Current
                          </span>
                        )}
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          Apply →
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })(),
            )}
          </div>
        </div>
      </div>

      {/* Live Preview Strip */}
      <div
        className="mt-8 bg-white rounded-2xl p-6 shadow-sm border"
        style={{ borderColor: "#e5e7eb" }}
      >
        <h3 className="font-bold text-base mb-4 text-gray-800">Live Preview</h3>
        <div
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: "#e5e7eb" }}
        >
          {/* Mini navbar */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: theme.navbarColor }}
          >
            <span
              className="font-black text-sm"
              style={{ color: "white", fontFamily: theme.headingFont }}
            >
              <span style={{ color: theme.accentColor }}>Rahman</span> Lab
            </span>
            <div className="flex gap-3">
              {["Home", "About", "Contact"].map((l) => (
                <span
                  key={l}
                  className="text-xs"
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    fontFamily: theme.fontFamily,
                  }}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
          {/* Mini body */}
          <div className="p-5" style={{ background: theme.backgroundColor }}>
            <h2
              className="font-black text-lg mb-2"
              style={{
                color: theme.primaryColor,
                fontFamily: theme.headingFont,
              }}
            >
              Sample Heading
            </h2>
            <p
              className="text-sm text-gray-600 mb-3"
              style={{ fontFamily: theme.fontFamily }}
            >
              This is how your body text will look with the selected theme
              settings.
            </p>
            <div className="flex gap-3">
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: theme.primaryColor }}
              >
                Primary Button
              </span>
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: theme.secondaryColor }}
              >
                Secondary
              </span>
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-gray-800"
                style={{ background: theme.accentColor }}
              >
                Accent
              </span>
            </div>
          </div>
          {/* Mini footer */}
          <div
            className="px-5 py-3 text-xs text-center"
            style={{
              background: theme.footerColor,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Footer — Rahman Research Lab
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeControl;
