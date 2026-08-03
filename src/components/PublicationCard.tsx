import React, { useMemo } from "react";
import { useThemeContext } from "../context/ThemeContext";
import type { Publication } from "../types";

interface Props {
  publication: Publication;
  onOpenDetails?: () => void;
}

/* ------------------------------------------------------------------ *
 * Theme
 * ------------------------------------------------------------------ */

/** Proper WCAG relative luminance — the raw-channel version misjudges mid greens and blues. */
const relativeLuminance = (hex: string): number | null => {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return null;

  const channel = (offset: number) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
};

const buildTokens = (isDark: boolean) => ({
  surface: isDark ? "#111827" : "#ffffff",
  surfaceAlt: isDark ? "rgba(148,163,184,0.10)" : "#f6f8fb",
  border: isDark ? "rgba(148,163,184,0.22)" : "#e6ecf3",
  borderStrong: isDark ? "rgba(148,163,184,0.42)" : "#cbd5e1",
  title: isDark ? "#f8fafc" : "#0f172a",
  body: isDark ? "#cbd5e1" : "#475569",
  muted: isDark ? "#94a3b8" : "#64748b",
  faint: isDark ? "#64748b" : "#94a3b8",
  shadow: isDark ? "0 1px 2px rgba(0,0,0,0.4)" : "0 1px 2px rgba(15,23,42,0.04)",
  shadowHover: isDark ? "0 12px 28px rgba(0,0,0,0.45)" : "0 12px 28px rgba(15,23,42,0.09)",
  // Status colours are picked per theme so both clear 4.5:1 against the surface.
  ongoing: isDark ? "#fbbf24" : "#b45309",
  published: isDark ? "#34d399" : "#047857",
});

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

const PublicationCard: React.FC<Props> = ({ publication: p, onOpenDetails }) => {
  const isOngoing = p.type === "ongoing";
  const { theme } = useThemeContext();

  const tokens = useMemo(() => {
    const luminance = relativeLuminance(theme.backgroundColor);
    return buildTokens(luminance !== null && luminance < 0.22);
  }, [theme.backgroundColor]);

  const tags = p.tags ?? [];
  const visibleTags = tags.slice(0, 3);
  const extraTagCount = tags.length - visibleTags.length;

  const statusColor = isOngoing ? tokens.ongoing : tokens.published;
  const abstract = p.abstract?.replace(/\s+/g, " ").trim();
  const paperUrl = p.url || (p.doi ? `https://doi.org/${p.doi}` : "");

  const cssVars = {
    "--pc-surface": tokens.surface,
    "--pc-surface-alt": tokens.surfaceAlt,
    "--pc-border": tokens.border,
    "--pc-border-strong": tokens.borderStrong,
    "--pc-title": tokens.title,
    "--pc-body": tokens.body,
    "--pc-muted": tokens.muted,
    "--pc-faint": tokens.faint,
    "--pc-shadow": tokens.shadow,
    "--pc-shadow-hover": tokens.shadowHover,
    "--pc-status": statusColor,
  } as React.CSSProperties;

  /**
   * The title is the single primary target. Its ::after overlay makes the whole
   * card clickable while screen readers still get a structured heading link —
   * wrapping the entire card in one <a> is the classic card a11y failure.
   * Secondary actions sit above the overlay with z-10.
   */
  const stretched =
    "after:absolute after:inset-0 after:content-[''] after:rounded-[16px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[var(--pc-status)] focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-[var(--pc-surface)]";

  const titleClass =
    "text-left text-[17px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--pc-title)] decoration-[var(--pc-border-strong)] underline-offset-[3px] transition group-hover:underline";

  return (
    <article
      style={cssVars}
      className="group relative isolate flex h-full flex-col rounded-[16px] border border-[var(--pc-border)] bg-[var(--pc-surface)] shadow-[var(--pc-shadow)] transition duration-200 hover:border-[var(--pc-border-strong)] hover:shadow-[var(--pc-shadow-hover)] motion-safe:hover:-translate-y-[2px]"
    >
      <div className="flex flex-1 gap-5 p-5 sm:p-6">
        {/* Year rail — gives a stacked list a scannable chronological spine. */}
        <div className="hidden shrink-0 border-r border-[var(--pc-border)] pr-5 sm:block sm:w-[74px]">
          <p className="text-[26px] font-black leading-none tracking-tight text-[var(--pc-title)] [font-variant-numeric:tabular-nums]">
            {p.year}
          </p>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] font-bold uppercase leading-[1.3] tracking-[.12em] text-[var(--pc-status)]">
            <span
              aria-hidden="true"
              className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-current"
            />
            {isOngoing ? "In progress" : "Published"}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile-only status row; the rail covers this from sm up. */}
          <p className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--pc-status)] sm:hidden">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {isOngoing ? "In progress" : "Published"}
            <span aria-hidden="true" className="text-[var(--pc-faint)]">
              ·
            </span>
            <span className="text-[var(--pc-muted)] [font-variant-numeric:tabular-nums]">
              {p.year}
            </span>
          </p>

          <h3 className="text-[17px] leading-[1.35]">
            {onOpenDetails ? (
              <button type="button" onClick={onOpenDetails} className={`${titleClass} ${stretched}`}>
                {p.title}
              </button>
            ) : paperUrl ? (
              <a
                href={paperUrl}
                target="_blank"
                rel="noreferrer"
                className={`${titleClass} ${stretched}`}
              >
                {p.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span className={titleClass}>{p.title}</span>
            )}
          </h3>

          {p.authors && (
            <p className="mt-2 line-clamp-1 text-[13px] font-medium leading-5 text-[var(--pc-body)]">
              {p.authors}
            </p>
          )}

          {/* Venue and identifier compressed onto one metadata line. */}
          {(p.journal || p.doi) && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-5 text-[var(--pc-muted)]">
              {p.journal && <span className="italic">{p.journal}</span>}
              {p.journal && p.doi && (
                <span aria-hidden="true" className="text-[var(--pc-faint)]">
                  ·
                </span>
              )}
              {p.doi && (
                <a
                  href={`https://doi.org/${p.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="relative z-10 break-all rounded-sm font-medium underline decoration-[var(--pc-border-strong)] underline-offset-[3px] transition hover:text-[var(--pc-title)] hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pc-status)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pc-surface)]"
                >
                  {p.doi}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </p>
          )}

          {abstract && (
            <p className="mt-3 line-clamp-2 text-[13.5px] leading-6 text-[var(--pc-body)]">
              {abstract}
            </p>
          )}

          {visibleTags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {visibleTags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-md bg-[var(--pc-surface-alt)] px-2 py-1 text-[11px] font-semibold leading-none text-[var(--pc-muted)]"
                >
                  {tag}
                </li>
              ))}
              {extraTagCount > 0 && (
                <li className="px-1 py-1 text-[11px] font-semibold leading-none text-[var(--pc-faint)]">
                  +{extraTagCount} more
                </li>
              )}
            </ul>
          )}

          {/* mt-auto keeps footers aligned across a grid of uneven cards. */}
          {onOpenDetails && paperUrl && (
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-5">
              <a
                href={paperUrl}
                target="_blank"
                rel="noreferrer"
                className="relative z-10 inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-bold text-[var(--pc-title)] underline decoration-[var(--pc-border-strong)] underline-offset-4 transition hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pc-status)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pc-surface)]"
              >
                Read the paper
                <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default PublicationCard;
