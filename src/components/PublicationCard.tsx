import React, { useMemo } from "react";
import { useThemeContext } from "../context/ThemeContext";
import type { Publication } from "../types";

interface Props {
  publication: Publication;
  onOpenDetails?: () => void;
  /** Set when the card already sits under a year heading. */
  hideYear?: boolean;
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
  surface: "var(--site-surface)",
  surfaceAlt: "var(--site-surface-alt)",
  border: "var(--site-border)",
  borderStrong: "color-mix(in srgb, var(--site-muted) 45%, var(--site-border))",
  title: "var(--site-heading)",
  body: "var(--site-text)",
  muted: "var(--site-muted)",
  faint: "color-mix(in srgb, var(--site-muted) 70%, var(--site-surface))",
  shadow: isDark ? "0 1px 2px rgba(0,0,0,0.4)" : "0 1px 2px rgba(15,23,42,0.04)",
  shadowHover: isDark ? "0 12px 28px rgba(0,0,0,0.45)" : "0 12px 28px rgba(15,23,42,0.09)",
  // Status colours are picked per theme so both clear 4.5:1 against the surface.
  ongoing: isDark ? "#fbbf24" : "#b45309",
  published: isDark ? "#34d399" : "#047857",
});

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

const PublicationCard: React.FC<Props> = ({ publication: p, onOpenDetails, hideYear = false }) => {
  const isOngoing = p.type === "ongoing";
  const { theme } = useThemeContext();

  const tokens = useMemo(() => {
    const luminance = relativeLuminance(theme.backgroundColor);
    return buildTokens(luminance !== null && luminance < 0.22);
  }, [theme.backgroundColor]);

  const statusColor = isOngoing ? tokens.ongoing : tokens.published;
  const abstract = p.abstract?.replace(/s+/g, " ").trim();
  const paperUrl = p.url || (p.doi ? `https://doi.org/${p.doi}` : "");
  const showYear = !hideYear && Boolean(p.year);

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
    "after:absolute after:inset-0 after:content-[''] after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[var(--pc-status)] focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-[var(--pc-surface)]";

  const titleClass =
    "text-left text-[17px] font-bold leading-snug tracking-[-0.01em] text-[var(--pc-title)] decoration-[var(--pc-border-strong)] underline-offset-[3px] transition group-hover:underline";

  return (
    <article
      style={cssVars}
      className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--pc-border)] bg-[var(--pc-surface)] shadow-[var(--pc-shadow)] transition duration-200 hover:border-[var(--pc-border-strong)] hover:shadow-[var(--pc-shadow-hover)] motion-safe:hover:-translate-y-[2px]"
    >
      {/* Status lives in the section heading and this accent bar — no chip needed. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--pc-status)] opacity-80" />
      <span className="sr-only">{isOngoing ? "Ongoing research. " : "Published. "}</span>

      <div className="flex flex-1 flex-col py-4 pl-5 pr-4 sm:pl-6 sm:pr-5">
        {/* Metadata on the left, actions on the right — one line, so actions add no height. */}
        <div className="flex min-w-0 items-center gap-3 text-[12px] leading-5 text-[var(--pc-muted)]">
          <p className="m-0 flex min-w-0 flex-1 items-center gap-x-2">
            {showYear && <span className="shrink-0 font-semibold text-[var(--pc-body)] [font-variant-numeric:tabular-nums]">{p.year}</span>}
            {showYear && p.journal && (
              <span aria-hidden="true" className="text-[var(--pc-faint)]">
                ·
              </span>
            )}
            {p.journal && <span className="min-w-0 truncate italic">{p.journal}</span>}
          </p>
          <span className="flex shrink-0 items-center gap-3">
            {onOpenDetails && paperUrl && (
              <a
                href={paperUrl}
                target="_blank"
                rel="noreferrer"
                className="relative z-10 inline-flex items-center gap-1 rounded-md text-[12px] font-semibold text-[var(--pc-muted)] transition hover:text-[var(--pc-title)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pc-status)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pc-surface)]"
              >
                Paper <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            {onOpenDetails && (
              <span aria-hidden="true" className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--pc-title)]">
                Details
                <span className="transition-transform motion-safe:group-hover:translate-x-0.5">→</span>
              </span>
            )}
          </span>
        </div>

        <h3 className="mt-2 text-[17px] leading-snug">
          {onOpenDetails ? (
            <button type="button" onClick={onOpenDetails} className={`${titleClass} ${stretched}`}>
              {p.title}
            </button>
          ) : paperUrl ? (
            <a href={paperUrl} target="_blank" rel="noreferrer" className={`${titleClass} ${stretched}`}>
              {p.title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className={titleClass}>{p.title}</span>
          )}
        </h3>

        {p.authors && <p className="mt-1 line-clamp-1 text-[13px] font-medium leading-5 text-[var(--pc-body)]">{p.authors}</p>}

        {abstract && <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-6 text-[var(--pc-muted)]">{abstract}</p>}
      </div>
    </article>
  );
};

export default PublicationCard;
