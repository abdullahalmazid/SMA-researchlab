import { doc, setDoc } from "../../core/auditedFirestore";
import { EllipsisVertical, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../../firebase/config";
import { useTheme } from "../../../firebase/hooks";
import { DETAIL_KEYS, contrast, isDark, resolveTokens, themeVariables, type DetailKey } from "../../../theme/tokens";
import type { ThemeSettings } from "../../../types";
import { FONTS, PRESETS } from "../../../theme/presets";

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
 * A full-width live preview with a slim toolbar. Themes and the colour/font
 * controls open in a panel on the right from the ⋮ menu, so the preview stays
 * visible while you edit. The preview uses the same CSS variables as the public
 * site, so what you see is what ships.
 */
const CompactThemeControl: React.FC = () => {
  const stored = useTheme();
  const [draft, setDraft] = useState<ThemeSettings>(() => normalise(stored));
  const [hexDrafts, setHexDrafts] = useState<Partial<Record<ColorKey, string>>>({});
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  /* The right-hand control panel, opened from the ⋮ menu. */
  const [panel, setPanel] = useState<null | "presets" | "colors">(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"all" | "light" | "dark">("all");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => setDraft(normalise(stored)), [stored]);
  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(normalise(stored)), [draft, stored]);
  const tokens = useMemo(() => resolveTokens(draft), [draft]);
  const variables = useMemo(() => themeVariables(draft) as React.CSSProperties, [draft]);
  const presets = useMemo(
    () =>
      PRESETS.filter(
        (preset) =>
          (mode === "all" || (mode === "dark") === isDark(preset.settings.backgroundColor)) &&
          `${preset.name} ${preset.description}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, mode],
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

  const colorsBody = (
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
  );

  const presetsBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-slate-200 p-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search themes…"
          aria-label="Search themes"
          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px]"
        />
        <div role="group" aria-label="Theme mode" className="flex rounded-md bg-slate-100 p-0.5">
          {(["all", "light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`h-7 flex-1 rounded text-[12px] font-semibold capitalize ${mode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <ul className="m-0 grid min-h-0 flex-1 list-none grid-cols-2 content-start gap-2.5 overflow-y-auto p-3">
        {presets.map((preset) => {
          const s = preset.settings;
          const k = resolveTokens(s);
          const active = activePreset?.name === preset.name;
          return (
            <li key={preset.name}>
              <button
                type="button"
                onClick={() => setDraft(withAutoDetails(preset.settings))}
                aria-pressed={active}
                title={preset.description}
                className={`group block w-full overflow-hidden rounded-lg border text-left transition ${
                  active ? "border-indigo-500 ring-2 ring-indigo-500/40" : "border-slate-200 hover:border-slate-400"
                }`}
              >
                {/* A miniature of the site in this theme. */}
                <span className="admin-preview block h-[92px] p-1.5" style={{ background: s.backgroundColor }}>
                  <span className="flex h-3.5 items-center gap-1 rounded-sm px-1.5" style={{ background: s.navbarColor }}>
                    <span className="h-1 w-4 rounded-full" style={{ background: k.navbarTextColor, opacity: 0.85 }} />
                    <span className="h-1 w-3 rounded-full" style={{ background: k.navbarTextColor, opacity: 0.5 }} />
                    <span className="ml-auto h-1.5 w-4 rounded-sm" style={{ background: s.accentColor }} />
                  </span>
                  <span className="mt-1 flex h-8 flex-col justify-center gap-1 rounded-sm px-2" style={{ background: s.primaryColor }}>
                    <span className="h-1.5 w-14 rounded-full" style={{ background: k.heroTextColor }} />
                    <span className="flex gap-1">
                      <span className="h-1.5 w-5 rounded-sm" style={{ background: s.accentColor }} />
                      <span className="h-1.5 w-5 rounded-sm" style={{ background: s.secondaryColor }} />
                    </span>
                  </span>
                  <span className="mt-1 grid grid-cols-2 gap-1">
                    {[0, 1].map((i) => (
                      <span key={i} className="flex h-6 flex-col justify-center gap-0.5 rounded-sm px-1.5" style={{ background: k.surfaceColor, border: `1px solid ${k.borderColor}` }}>
                        <span className="h-1 w-8 rounded-full" style={{ background: k.headingColor }} />
                        <span className="h-1 w-6 rounded-full" style={{ background: k.mutedColor }} />
                      </span>
                    ))}
                  </span>
                </span>
                <span className="block border-t border-slate-200 bg-white px-2 py-1.5">
                  <span className={`block truncate text-[12px] font-semibold ${active ? "text-indigo-700" : "text-slate-800"}`}>{preset.name}</span>
                  <span className="block truncate text-[10.5px] text-slate-500">
                    {fontName(s.headingFont)} · {isDark(s.backgroundColor) ? "Dark" : "Light"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {presets.length === 0 && <li className="col-span-2 px-2 py-6 text-center text-[12.5px] text-slate-500">No theme matches.</li>}
      </ul>
      <p className="m-0 border-t border-slate-200 px-3 py-2 text-[10.5px] text-slate-500">
        A theme sets brand colours and fonts. Detail colours return to Auto, so text stays readable.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-210px)] lg:min-h-[600px]">
      {/* ── Toolbar: what's live, readability, apply, and the ⋮ menu ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <span className="admin-preview flex h-8 w-16 shrink-0 overflow-hidden rounded-md border border-black/10" aria-hidden="true">
          {[draft.primaryColor, draft.secondaryColor, draft.accentColor, draft.backgroundColor].map((color, index) => (
            <span key={index} className="flex-1" style={{ background: color }} />
          ))}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-center gap-2 text-[13px] font-semibold text-slate-800">
            {activePreset?.name ?? "Custom theme"}
            {changed && <span className="rounded bg-amber-100 px-1.5 text-[10.5px] font-bold text-amber-800">Unsaved</span>}
          </p>
          <p className="m-0 truncate text-[11.5px] text-slate-500">
            {fontName(draft.headingFont)} / {fontName(draft.fontFamily)} ·{" "}
            {warnings > 0 ? (
              <span className="font-semibold text-rose-700">
                ⚠ {warnings} colour pair{warnings === 1 ? "" : "s"} hard to read
              </span>
            ) : (
              <span className="text-emerald-700">All text readable</span>
            )}
          </p>
        </div>
        {notice && (
          <p role="status" className={`m-0 text-[12px] font-semibold ${notice.startsWith("Error:") ? "text-rose-700" : "text-emerald-700"}`}>
            {notice}
          </p>
        )}
        <button
          type="button"
          disabled={!changed || saving}
          onClick={() => setDraft(normalise(stored))}
          className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 disabled:opacity-40"
        >
          Reset
        </button>
        <button
          type="button"
          disabled={!changed || saving}
          onClick={() => void save()}
          className="h-8 rounded-md bg-indigo-600 px-3 text-[12.5px] font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Applying…" : changed ? "Apply to website" : "Live"}
        </button>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Theme controls"
            className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
          >
            <EllipsisVertical size={16} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              {[
                { id: "presets" as const, label: "Themes & presets", note: `${PRESETS.length} curated themes` },
                { id: "colors" as const, label: "Colours & fonts", note: "Brand, text, typography" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPanel(item.id);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-[13px] font-semibold text-slate-800">{item.label}</span>
                  <span className="block text-[11px] text-slate-500">{item.note}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* ── Live preview: the whole width until a panel opens ── */}
        <section
          className="admin-preview flex min-h-[460px] min-w-0 flex-1 flex-col overflow-hidden overflow-y-auto rounded-lg border border-slate-200"
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

          <div className="px-6 py-9 text-center" style={{ background: v("--color-primary"), color: v("--hero-text") }}>
            <p className="m-0 text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: v("--hero-accent") }}>
              Research laboratory
            </p>
            <h2 className="m-0 mt-2 text-[clamp(1.4rem,2.6vw,2.3rem)] font-black leading-tight" style={{ fontFamily: draft.headingFont, color: v("--hero-text") }}>
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
                  <p className="m-0 text-[10px] font-bold uppercase tracking-wider" style={{ color: v("--accent-ink") }}>
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
                    <span className="font-semibold" style={{ color: v("--secondary-ink") }}>
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

            {/* Stats strip and news list — more of the site, so the preview fills its space. */}
            <div className="grid grid-cols-3 overflow-hidden rounded-lg" style={{ background: v("--color-primary") }}>
              {[
                ["24", "Collaborators"],
                ["152", "Publications"],
                ["9", "Ongoing projects"],
              ].map(([value, label], index) => (
                <div
                  key={label}
                  className="px-3 py-3 text-center"
                  style={{ borderLeft: index ? "1px solid color-mix(in srgb, var(--hero-text) 12%, transparent)" : undefined }}
                >
                  <p className="m-0 text-[20px] font-black leading-none" style={{ color: v("--hero-accent"), fontFamily: draft.headingFont }}>
                    {value}
                  </p>
                  <p className="m-0 mt-1 text-[10.5px]" style={{ color: "color-mix(in srgb, var(--hero-text) 75%, transparent)" }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-lg" style={{ background: v("--site-surface"), border: `1px solid ${v("--site-border")}` }}>
              {[
                ["Dr. Ali among the world's top 2% scientists", "Oct 9"],
                ["Research call: MSc positions open", "Sep 23"],
              ].map(([title, date], index) => (
                <div
                  key={title}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ borderTop: index ? `1px solid ${v("--site-border")}` : undefined, borderLeft: index ? undefined : `3px solid ${v("--color-accent")}` }}
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: v("--site-heading") }}>
                    {title}
                  </span>
                  <span className="text-[11px]" style={{ color: v("--site-muted") }}>
                    {date}
                  </span>
                  <span className="rounded-md px-2 py-0.5 text-[10.5px] font-bold" style={{ border: `1px solid ${v("--color-secondary")}`, color: v("--secondary-ink") }}>
                    Read →
                  </span>
                </div>
              ))}
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

        {/* ── Control panel, opened from the ⋮ menu ── */}
        {panel && (
          <aside className="tc-panel flex min-h-0 w-full max-w-[380px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white max-lg:fixed max-lg:inset-y-3 max-lg:right-3 max-lg:z-40 max-lg:shadow-2xl" aria-label="Theme controls">
            <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
              <div role="tablist" aria-label="Panel" className="flex flex-1 rounded-md bg-slate-100 p-0.5">
                {(
                  [
                    ["presets", "Themes"],
                    ["colors", "Colours & fonts"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={panel === id}
                    onClick={() => setPanel(id)}
                    className={`h-7 flex-1 rounded text-[12px] font-semibold ${panel === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="Close panel"
                className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </header>
            {panel === "presets" ? presetsBody : colorsBody}
          </aside>
        )}
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .tc-panel { animation: tc-in .28s cubic-bezier(.22,.8,.3,1); }
        }
        @keyframes tc-in { from { opacity: 0; transform: translateX(24px); } }
      `}</style>
    </div>
  );
};

export default CompactThemeControl;
