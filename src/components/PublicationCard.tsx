import React from "react";
import { useThemeContext } from "../context/ThemeContext";
import type { Publication } from "../types";

interface Props {
  publication: Publication;
  onOpenDetails?: () => void;
}

const PublicationCard: React.FC<Props> = ({
  publication: p,
  onOpenDetails,
}) => {
  const isOngoing = p.type === "ongoing";
  const { theme } = useThemeContext();

  const clean = theme.backgroundColor.replace("#", "").trim();
  const isDarkTheme =
    clean.length === 6
      ? (() => {
          const r = parseInt(clean.slice(0, 2), 16);
          const g = parseInt(clean.slice(2, 4), 16);
          const b = parseInt(clean.slice(4, 6), 16);
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          return luminance < 140;
        })()
      : false;

  const surfaceBg = isDarkTheme ? "#111827" : "white";
  const surfaceAltBg = isDarkTheme ? "#0f172a" : "#f8fafc";
  const borderColor = isDarkTheme ? "rgba(148,163,184,0.28)" : "#e8eef4";
  const mutedText = isDarkTheme ? "#94a3b8" : "#64748b";
  const subtleText = isDarkTheme ? "#cbd5e1" : "#475569";
  const titleColor = isDarkTheme ? "#f3f4f6" : "#0f172a";

  const createdTags = (p.tags ?? []).slice(0, 4).join("; ");

  const visibleTags = (p.tags ?? []).slice(0, 3);
  const extraTagCount = Math.max(0, (p.tags ?? []).length - visibleTags.length);

  return (
    <article
      className="group relative overflow-hidden rounded-[18px] transition duration-300 hover:-translate-y-0.5"
      style={{
        background: surfaceBg,
        border: `1px solid ${borderColor}`,
        boxShadow: isDarkTheme
          ? "0 8px 22px rgba(0,0,0,0.30)"
          : "0 8px 22px rgba(15,23,42,0.06)",
      }}
    >
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, var(--color-primary), var(--color-secondary))` }} />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.14em]" style={{ background: isOngoing ? "rgba(245,158,11,.13)" : "rgba(16,185,129,.13)", color: isOngoing ? "#b45309" : "#047857" }}>{isOngoing ? "In progress" : "Published"}</span>
          <span className="rounded-xl border px-3 py-1.5 text-xs font-black" style={{ borderColor, color: mutedText }}>{p.year}</span>
        </div>

        <h3
          className="mb-2 text-lg font-black leading-snug"
          style={{ color: titleColor, lineHeight: 1.4 }}
        >
          {!isOngoing && p.url ? (
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              style={{ color: titleColor, textDecoration: "none" }}
            >
              {p.title}
            </a>
          ) : (
            p.title
          )}
        </h3>

        {p.authors && (
          <p className="mb-1 line-clamp-2 text-sm font-semibold leading-5" style={{ color: subtleText }}>
            {p.authors}
          </p>
        )}

        <div className="mb-2 text-sm" style={{ color: subtleText }}>
          {p.journal && (
            <span>
              <em>{p.journal}</em>
            </span>
          )}
        </div>

        {p.doi && (
          <div className="mb-1 text-xs" style={{ color: mutedText }}>
            DOI: {p.doi}
          </div>
        )}

        {createdTags && (
          <div className="mb-3 mt-3 flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => <span key={tag} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ borderColor, background: surfaceAltBg, color: mutedText }}>{tag}</span>)}
            {extraTagCount > 0 && <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ borderColor, color: mutedText }}>+{extraTagCount}</span>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor }}>
          {onOpenDetails && (
            <button
              onClick={onOpenDetails}
              className="cursor-pointer rounded-xl border px-4 py-2 text-xs font-black"
              style={{ color: "var(--color-secondary)", borderColor }}
            >
              View details
            </button>
          )}
          {!isOngoing && p.url && (
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl px-4 py-2 text-xs font-black text-white no-underline"
              style={{
                background: "var(--color-secondary)",
              }}
            >
              View paper
            </a>
          )}
        </div>
      </div>
    </article>
  );
};

export default PublicationCard;
