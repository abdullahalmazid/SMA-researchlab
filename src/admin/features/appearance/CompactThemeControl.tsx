import { doc, setDoc } from "../../core/auditedFirestore";
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../../firebase/config";
import { useTheme } from "../../../firebase/hooks";
import { DETAIL_KEYS, contrast, resolveTokens, themeVariables, type DetailKey } from "../../../theme/tokens";
import type { ThemeSettings } from "../../../types";
import { FONTS, PRESETS } from "../../ThemeControl";

type BrandKey = keyof Pick<ThemeSettings, "primaryColor" | "secondaryColor" | "accentColor" | "backgroundColor" | "navbarColor" | "footerColor">;
type ColorKey = BrandKey | DetailKey;

interface Row {
  key: ColorKey;
  label: string;
  note: string;
  /** For contrast checks: the colour this one is read against. */
  against?: (t: ThemeSettings, tokens: Record<DetailKey, string>) => string;
  /** Text needs 4.5:1; large/bold text and UI parts 3:1. */
  min?: number;
}

const GROUPS: { title: string; hint?: string; rows: Row[] }[] = [
  {
    title: "Brand",
    rows: [
      { key: "primaryColor", label: "Primary", note: "Hero bands, key buttons" },
      { key: "secondaryColor", label: "Secondary", note: "Links, secondary buttons", against: (_, k) => k.surfaceColor, min: 3 },
      { key: "accentColor", label: "Accent", note: "Highlights, call-to-action" },
      { key: "backgroundColor", label: "Page", note: "Page background" },
      { key: "navbarColor", label: "Navigation bar", note: "Top bar and side rail" },
      { key: "footerColor", label: "Footer", note: "Site footer" },
    ],
  },
  {
    title: "Surfaces & text",
    hint: "Leave on Auto to derive from the page colour.",
    rows: [
      { key: "surfaceColor", label: "Cards & panels", note: "Cards, drawers, menus" },
      { key: "surfaceAltColor", label: "Subtle fill", note: "Alternating bands, chips" },
      { key: "headingColor", label: "Headings", note: "Titles, names", against: (_, k) => k.surfaceColor, min: 4.5 },
      { key: "textColor", label: "Body text", note: "Paragraphs", against: (_, k) => k.surfaceColor, min: 4.5 },
      { key: "mutedColor", label: "Muted text", note: "Dates, captions, hints", against: (_, k) => k.surfaceColor, min: 4.5 },
      { key: "borderColor", label: "Borders", note: "Dividers, outlines" },
    ],
  },
  {
    title: "Text on colour",
    hint: "Auto picks white or near-black for the best contrast.",
    rows: [
      { key: "navbarTextColor", label: "On navigation", note: "Menu links", against: (t) => t.navbarColor, min: 4.5 },
      { key: "footerTextColor", label: "On footer", note: "Footer links", against: (t) => t.footerColor, min: 4.5 },
      { key: "heroTextColor", label: "On primary", note: "Hero titles, primary buttons", against: (t) => t.primaryColor, min: 4.5 },
      { key: "onAccentColor", label: "On accent", note: "Accent button labels", against: (t) => t.accentColor, min: 4.5 },
      { key: "onSecondaryColor", label: "On secondary", note: "Secondary button labels", against: (t) => t.secondaryColor, min: 4.5 },
    ],
  },
];

const HEX = /^#[0-9a-f]{6}$/i;
const fontName = (font: string) => font.replaceAll("'", "").split(",")[0];
const isDetail = (key: ColorKey): key is DetailKey => (DETAIL_KEYS as string[]).includes(key);
/** Presets only carry brand colours; their detail colours start on Auto. */
const withAutoDetails = (settings: ThemeSettings): ThemeSettings => ({
  ...settings,
  ...Object.fromEntries(DETAIL_KEYS.map((key) => [key, ""])),
});
const normalise = (theme: ThemeSettings): ThemeSettings => ({
  ...theme,
  ...Object.fromEntries(DETAIL_KEYS.map((key) => [key, theme[key] ?? ""])),
});

const ContrastBadge: React.FC<{ ratio: number; min: number }> = ({ ratio, min }) => {
  const ok = ratio >= min;
  return (
    <span
      className={`shrink-0 rounded px-1 font-mono text-[10px] font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
      title={ok ? `Readable: ${ratio.toFixed(1)}:1 (needs ${min}:1)` : `Hard to read: ${ratio.toFixed(1)}:1 — needs ${min}:1`}
    >
      {ok ? "" : "⚠ "}
      {ratio.toFixed(1)}
    </span>
  );
};

/**
 * Everything on one screen: grouped colour controls on the left, a large live
 * preview in the middle, presets on the right. The preview uses the same CSS
 * variables as the public site, so what you see is what ships.
 */
const CompactThemeControl: React.FC = () => {
  const stored = useTheme();
  const [draft, setDraft] = useState<ThemeSettings>(() => normalise(stored));
  const [hexDrafts, setHexDrafts] = useState<Partial<Record<ColorKey, string>>>({});
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => setDraft(normalise(stored)), [stored]);
  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(normalise(stored)), [draft, stored]);
  const tokens = useMemo(() => resolveTokens(draft), [draft]);
  const variables = useMemo(() => themeVariables(draft) as React.CSSProperties, [draft]);
  const presets = useMemo(
    () => PRESETS.filter((preset) => preset.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );
  const activePreset = PRESETS.find((preset) =>
    GROUPS[0].rows.every(({ key }) => (preset.settings[key as BrandKey] ?? "").toLowerCase() === String(draft[key] ?? "").toLowerCase()),
  );
  const warnings = GROUPS.flatMap((g) => g.rows).filter(
    (row) => row.against && row.min && contrast(isDetail(row.key) ? tokens[row.key] : String(draft[row.key]), row.against(draft, tokens)) < row.min,
  ).length;

  const setColor = (key: ColorKey, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setNotice("");
    try {
      await setDoc(doc(db, "theme", "settings"), { ...normalise(draft), updatedAt: new Date().toISOString() }, { merge: true });
      setNotice("Theme applied to the website.");
    } catch (error) {
      setNotice(`Error: ${String((error as Error).message || error)}`);
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (row: Row) => {
    const detail = isDetail(row.key);
    const explicit = String(draft[row.key] ?? "");
    const effective = detail ? tokens[row.key as DetailKey] : explicit;
    const auto = detail && !explicit;
    return (
      <li key={row.key} className="flex items-center gap-2">
        <label className="admin-preview relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-black/10" style={{ background: effective }}>
          <input
            type="color"
            value={HEX.test(effective) ? effective : "#000000"}
            onChange={(event) => setColor(row.key, event.target.value)}
            aria-label={`${row.label} colour`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-semibold text-slate-800">{row.label}</span>
            {row.against && row.min && <ContrastBadge ratio={contrast(effective, row.against(draft, tokens))} min={row.min} />}
          </span>
          <span className="block truncate text-[10.5px] text-slate-400">{row.note}</span>
        </span>
        <input
          value={hexDrafts[row.key] ?? (auto ? "" : explicit)}
          placeholder={auto ? "Auto" : undefined}
          onChange={(event) => {
            const value = event.target.value.trim();
            setHexDrafts((current) => ({ ...current, [row.key]: value }));
            if (HEX.test(value)) setColor(row.key, value);
            else if (detail && value === "") setColor(row.key, "");
          }}
          onBlur={() => setHexDrafts((current) => ({ ...current, [row.key]: undefined }))}
          aria-label={`${row.label} hex value${auto ? " (automatic)" : ""}`}
          spellCheck={false}
          className="h-7 w-[76px] rounded-md border border-slate-200 bg-white px-1.5 font-mono text-[11.5px] uppercase text-slate-700 placeholder:normal-case placeholder:text-slate-400"
        />
        {detail && (
          <button
            type="button"
            disabled={auto}
            onClick={() => setColor(row.key, "")}
            title="Back to automatic"
            aria-label={`Set ${row.label} back to automatic`}
            className="h-7 w-7 shrink-0 rounded-md text-[11px] font-bold text-slate-400 hover:text-slate-700 disabled:opacity-0"
          >
            ↺
          </button>
        )}
      </li>
    );
  };

  /* Preview styles — all through the same variables the public site uses. */
  const v = (name: string) => `var(${name})`;

  return (
    <div className="grid gap-3 lg:h-[calc(100dvh-210px)] lg:min-h-[600px] lg:grid-cols-[318px_minmax(0,1fr)_220px]">
      {/* ── Controls ── */}
      <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white" aria-label="Theme settings">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</h3>
              {group.hint && <p className="m-0 mt-0.5 text-[11px] text-slate-400">{group.hint}</p>}
              <ul className="m-0 mt-2 list-none space-y-1.5 p-0">{group.rows.map(renderRow)}</ul>
            </div>
          ))}

          <div>
            <h3 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Typography</h3>
            {(["headingFont", "fontFamily"] as const).map((key) => (
              <label key={key} className="mb-2 block">
                <span className="mb-1 block text-[12px] text-slate-500">{key === "fontFamily" ? "Body text" : "Headings"}</span>
                <select
                  value={draft[key]}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] text-slate-700"
                  style={{ fontFamily: draft[key] }}
                >
                  {FONTS.map((font) => (
                    <option key={font} value={font}>
                      {fontName(font)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <footer className="border-t border-slate-200 p-3">
          {warnings > 0 ? (
            <p className="m-0 mb-2 text-[11.5px] font-semibold text-rose-700">
              ⚠ {warnings} colour pair{warnings === 1 ? " is" : "s are"} hard to read — check the red badges.
            </p>
          ) : (
            <p className="m-0 mb-2 text-[11.5px] text-emerald-700">All text meets contrast guidelines.</p>
          )}
          {notice && (
            <p role="status" className={`m-0 mb-2 text-[12px] font-semibold ${notice.startsWith("Error:") ? "text-rose-700" : "text-emerald-700"}`}>
              {notice}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!changed || saving}
              onClick={() => setDraft(normalise(stored))}
              className="h-9 flex-1 rounded-md border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!changed || saving}
              onClick={() => void save()}
              className="h-9 flex-[2] rounded-md bg-indigo-600 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Applying…" : changed ? "Apply to website" : "Live theme"}
            </button>
          </div>
        </footer>
      </section>

      {/* ── Large live preview ── */}
      <section
        className="admin-preview flex min-h-[460px] flex-col overflow-hidden rounded-lg border border-slate-200"
        aria-label="Live preview"
        style={{ ...variables, background: v("--color-bg"), fontFamily: draft.fontFamily }}
      >
        <div className="flex items-center gap-5 px-5 py-3" style={{ background: v("--color-navbar"), color: v("--nav-text") }}>
          <strong className="text-[15px]" style={{ fontFamily: draft.headingFont }}>
            <span style={{ color: v("--nav-accent") }}>Syed&apos;s</span> Lab
          </strong>
          <span className="hidden gap-4 text-[12.5px] sm:flex">
            <span style={{ opacity: 0.85 }}>Home</span>
            <span style={{ color: v("--nav-accent") }}>Research</span>
            <span style={{ opacity: 0.85 }}>People</span>
            <span style={{ opacity: 0.85 }}>News</span>
          </span>
          <span className="ml-auto rounded-md px-3 py-1 text-[11.5px] font-semibold" style={{ background: v("--color-accent"), color: v("--on-accent") }}>
            Portal login
          </span>
        </div>

        <div className="px-6 py-7 text-center" style={{ background: v("--color-primary"), color: v("--hero-text") }}>
          <p className="m-0 text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: v("--hero-accent") }}>
            Research laboratory
          </p>
          <h2 className="m-0 mt-2 text-[clamp(1.3rem,2.4vw,2rem)] font-black leading-tight" style={{ fontFamily: draft.headingFont, color: v("--hero-text") }}>
            Ideas into meaningful research
          </h2>
          <p className="mx-auto m-0 mt-2 max-w-md text-[13px] leading-relaxed" style={{ opacity: 0.78 }}>
            Hero text and buttons sit on the primary colour.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <span className="rounded-md px-4 py-2 text-[12px] font-bold" style={{ background: v("--color-accent"), color: v("--on-accent") }}>
              Explore research
            </span>
            <span className="rounded-md px-4 py-2 text-[12px] font-bold" style={{ background: v("--color-secondary"), color: v("--on-secondary") }}>
              About the lab
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Publications", "Energy security in South Asia", "Mar 2026"],
              ["Collaborators", "Alice Rahman · PhD student", "BUET"],
              ["Research ideas", "Federated supply-chain forecasting", "3 comments"],
            ].map(([kicker, title, meta]) => (
              <div key={kicker} className="rounded-lg p-3" style={{ background: v("--site-surface"), border: `1px solid ${v("--site-border")}` }}>
                <p className="m-0 text-[10px] font-bold uppercase tracking-wider" style={{ color: v("--color-accent") }}>
                  {kicker}
                </p>
                <p className="m-0 mt-1 text-[13px] font-bold leading-snug" style={{ color: v("--site-heading"), fontFamily: draft.headingFont }}>
                  {title}
                </p>
                <p className="m-0 mt-1 text-[11.5px] leading-snug" style={{ color: v("--site-text") }}>
                  Body copy in the chosen font and colour.
                </p>
                <p className="m-0 mt-2 flex items-center justify-between text-[11px]" style={{ color: v("--site-muted") }}>
                  {meta}
                  <span className="font-semibold" style={{ color: v("--color-secondary") }}>
                    View →
                  </span>
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: v("--site-surface-alt"), border: `1px solid ${v("--site-border")}` }}>
            <span className="text-[12px] font-semibold" style={{ color: v("--site-heading") }}>
              Subtle fill
            </span>
            {["Energy", "Optimisation", "Supply chain"].map((tag) => (
              <span key={tag} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: v("--site-surface"), color: v("--site-text"), border: `1px solid ${v("--site-border")}` }}>
                {tag}
              </span>
            ))}
            <span className="ml-auto rounded-md px-2.5 py-1 text-[11px]" style={{ background: v("--site-surface"), color: v("--site-muted"), border: `1px solid ${v("--site-border")}` }}>
              Search…
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-[11px]" style={{ background: v("--color-footer"), color: v("--footer-text") }}>
          <span style={{ opacity: 0.7 }}>© Research Lab</span>
          <span className="flex gap-3">
            <span>Contact</span>
            <span style={{ color: v("--footer-accent") }}>Publications</span>
          </span>
        </div>
      </section>

      {/* ── Presets ── */}
      <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white" aria-label="Presets">
        <div className="border-b border-slate-200 p-3">
          <h3 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Presets</h3>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search presets…"
            aria-label="Search presets"
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px]"
          />
          <p className="m-0 mt-1.5 text-[10.5px] text-slate-400">A preset sets the brand colours and fonts; detail colours return to Auto.</p>
        </div>
        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1.5">
          {presets.map((preset) => {
            const active = activePreset?.name === preset.name;
            return (
              <li key={preset.name}>
                <button
                  type="button"
                  onClick={() => setDraft(withAutoDetails(preset.settings))}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition ${active ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                >
                  <span className="admin-preview flex h-6 w-14 shrink-0 overflow-hidden rounded border border-black/10">
                    {[preset.settings.primaryColor, preset.settings.secondaryColor, preset.settings.accentColor, preset.settings.backgroundColor].map((color, index) => (
                      <span key={index} className="flex-1" style={{ background: color }} />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-[12.5px] font-semibold ${active ? "text-indigo-700" : "text-slate-700"}`}>{preset.name}</span>
                    <span className="block truncate text-[10.5px] text-slate-400">{fontName(preset.settings.headingFont)}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {presets.length === 0 && <li className="px-2 py-6 text-center text-[12.5px] text-slate-500">No preset matches.</li>}
        </ul>
      </section>
    </div>
  );
};

export default CompactThemeControl;
