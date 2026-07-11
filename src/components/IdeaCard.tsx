import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeContext } from "../context/ThemeContext";
import type { ResearchIdea } from "../types";
import AppIcon from "./AppIcon";
import { useCanonicalCollaborator } from "../hooks/useCanonicalCollaborator";

interface Props {
  idea: ResearchIdea;
}

const IdeaCard: React.FC<Props> = ({ idea }) => {
  const [imgErr, setImgErr] = useState(false);
  const navigate = useNavigate();
  const { theme } = useThemeContext();
  const author = useCanonicalCollaborator(idea.authorId, { name: idea.authorName, photo: idea.authorPhoto });

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
  const borderColor = isDarkTheme ? "rgba(148,163,184,0.25)" : "#e8eef4";
  const titleColor = isDarkTheme ? "#e5e7eb" : "var(--color-primary)";
  const bodyColor = isDarkTheme ? "#cbd5e1" : "#4b5563";
  const mutedColor = isDarkTheme ? "#94a3b8" : "#9ca3af";

  const initials = author.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const createdLabel = new Date(idea.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const openIdea = () => navigate(`/research-ideas/${idea.id}`);

  const onCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openIdea();
    }
  };

  return (
    <div
      onClick={openIdea}
      onKeyDown={onCardKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Open idea: ${idea.title}`}
      className="group relative overflow-hidden rounded-2xl cursor-pointer flex flex-col"
      style={{
        background: surfaceBg,
        border: `1px solid ${borderColor}`,
        boxShadow: isDarkTheme
          ? "0 2px 14px rgba(0,0,0,0.32)"
          : "0 2px 12px rgba(0,0,0,0.05)",
        transition: "box-shadow 0.22s ease, transform 0.22s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = isDarkTheme
          ? "0 14px 38px rgba(0,0,0,0.45)"
          : "0 16px 40px rgba(0,0,0,0.12)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = isDarkTheme
          ? "0 2px 14px rgba(0,0,0,0.32)"
          : "0 2px 12px rgba(0,0,0,0.05)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      <div
        className="h-1 w-full flex-shrink-0"
        style={{
          background: "var(--color-secondary)",
        }}
      />

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-4">
          {author.photo && !imgErr ? (
            <img
              src={author.photo}
              alt={author.name}
              onError={() => setImgErr(true)}
              className="rounded-full object-cover flex-shrink-0"
              style={{
                width: 46,
                height: 46,
                border: `1px solid ${borderColor}`,
              }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center text-white font-black flex-shrink-0"
              style={{
                width: 46,
                height: 46,
                background: "var(--color-primary)",
                fontSize: 15,
                border: `1px solid ${borderColor}`,
              }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-bold truncate"
              style={{ color: titleColor }}
            >
              {author.name}
            </p>
            <p className="text-xs" style={{ color: mutedColor }}>
              {createdLabel}
            </p>
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
            style={{
              background: surfaceAltBg,
              border: `1px solid ${borderColor}`,
              color: "var(--color-secondary)",
            }}
          >
            <AppIcon name="ideas" size={16} />
          </div>
        </div>

        <h3
          className="font-bold text-lg leading-snug mb-3"
          style={{ color: titleColor, lineHeight: 1.4 }}
        >
          {idea.title}
        </h3>

        <p
          className="text-sm leading-relaxed mb-4 flex-1"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.75,
            color: bodyColor,
          }}
        >
          {idea.shortDescription}
        </p>

        {idea.tags && idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {idea.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{
                  background: surfaceAltBg,
                  color: mutedColor,
                  border: `1px solid ${borderColor}`,
                }}
              >
                {t}
              </span>
            ))}
            {idea.tags.length > 3 && (
              <span
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{
                  background: surfaceAltBg,
                  color: mutedColor,
                  border: `1px solid ${borderColor}`,
                }}
              >
                +{idea.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded"
              style={{ background: surfaceAltBg, color: mutedColor }}
            >
              <AppIcon name="message" size={13} />
              <span>{idea.commentCount ?? 0}</span>
            </div>
          </div>
          <span
            className="text-xs font-semibold flex items-center gap-1"
            style={{ color: "var(--color-secondary)" }}
          >
            Details <span style={{ fontSize: 14 }}>→</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default IdeaCard;
