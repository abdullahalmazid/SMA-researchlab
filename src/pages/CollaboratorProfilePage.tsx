import React, { useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import CollaboratorPublicProfile from "../components/CollaboratorPublicProfile";
import EditableText from "../components/EditableText";
import { useThemeContext } from "../context/ThemeContext";
import { useCollaborators, useGallery, usePublications } from "../firebase/hooks";
import type { CollaboratorPublication } from "../types";

/* ------------------------------------------------------------------ *
 * Colour utilities — the page previously hardcoded gray-900 / gray-500,
 * which disappears against a dark theme background.
 * ------------------------------------------------------------------ */

const hexToRgb = (hex: string) => {
  const raw = (hex ?? "").replace("#", "").trim();
  const clean =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  if (clean.length !== 6 || /[^0-9a-f]/i.test(clean)) return { r: 255, g: 255, b: 255 };
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
};

const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const relativeLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const CollaboratorProfilePage: React.FC = () => {
  const { uid = "" } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useThemeContext();

  const { collaborators, loading: collaboratorsLoading } = useCollaborators();
  const { gallery, loading: galleryLoading } = useGallery();
  const { ongoing, published, loading: publicationsLoading } = usePublications();

  const tone = useMemo(() => {
    const isDark = relativeLuminance(theme.backgroundColor ?? "#ffffff") < 0.22;
    return {
      page: `color-mix(in srgb, ${theme.primaryColor} ${isDark ? 6 : 4}%, ${theme.backgroundColor})`,
      surface: theme.backgroundColor,
      surfaceMuted: withAlpha(theme.primaryColor, isDark ? 0.1 : 0.05),
      border: withAlpha(theme.primaryColor, isDark ? 0.2 : 0.13),
      heading: theme.primaryColor,
      muted: withAlpha(theme.primaryColor, isDark ? 0.66 : 0.6),
      shadow: isDark ? "0 1px 2px rgba(0,0,0,0.4)" : "0 1px 2px rgba(15,23,42,0.05)",
    };
  }, [theme.backgroundColor, theme.primaryColor]);

  const collaborator = useMemo(
    () => collaborators.find((item) => item.uid === uid),
    [collaborators, uid],
  );

  const linkedPublications = useMemo<CollaboratorPublication[]>(() => {
    if (!uid) return [];

    // A record can appear in both feeds, so dedupe by id before mapping.
    const seen = new Set<string>();

    return [...ongoing, ...published]
      .filter((publication) => {
        if (seen.has(publication.id)) return false;
        const isContributor =
          publication.contributorUids?.includes(uid) ||
          publication.authorEntries?.some(
            (author) => author.type === "linked" && author.uid === uid,
          );
        if (isContributor) seen.add(publication.id);
        return isContributor;
      })
      .map((publication) => ({
        id: publication.id,
        title: publication.title,
        journal: publication.journal,
        year: publication.year,
        url: publication.url,
      }))
      .sort(
        (a, b) =>
          (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title),
      );
  }, [ongoing, published, uid]);

  const galleryItems = useMemo(
    () => (collaborator ? gallery.filter((item) => item.uploaderUid === collaborator.uid) : []),
    [gallery, collaborator],
  );

  /**
   * Going back through history preserves the list's scroll position and any
   * filters the visitor had applied. A hard push to /collaborators throws both
   * away — so only fall back to it when this page was opened directly.
   */
  const handleBack = useCallback(() => {
    if (location.key === "default") navigate("/collaborators");
    else navigate(-1);
  }, [location.key, navigate]);

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--focus-offset)]";

  const focusVars = {
    "--focus-ring": theme.accentColor || theme.secondaryColor,
    "--focus-offset": tone.surface,
  } as React.CSSProperties;

  /* ---------------------------------------------------------------- *
   * Loading — a skeleton in the shape of a profile, so the layout does
   * not jump when the data lands.
   * ---------------------------------------------------------------- */

  if (collaboratorsLoading || galleryLoading || publicationsLoading) {
    const block = {
      background: tone.surfaceMuted,
      border: `1px solid ${tone.border}`,
    } as React.CSSProperties;

    return (
      <main
        className="min-h-screen"
        style={{ background: tone.page }}
        role="status"
        aria-busy="true"
      >
        <span className="sr-only">Loading collaborator profile</span>

        <div className="mx-auto max-w-6xl px-4 py-14 motion-safe:animate-pulse">
          <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:items-center sm:text-left">
            <div
              className="shrink-0 rounded-[24px]"
              style={{ ...block, width: "clamp(140px, 16vw, 180px)", aspectRatio: "1 / 1" }}
            />
            <div className="w-full max-w-lg space-y-4">
              <div className="mx-auto h-3 w-24 rounded-full sm:mx-0" style={block} />
              <div className="mx-auto h-8 w-3/4 rounded-lg sm:mx-0" style={block} />
              <div className="mx-auto h-4 w-1/2 rounded-full sm:mx-0" style={block} />
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-64 rounded-[20px]" style={block} />
            <div className="h-48 rounded-[20px]" style={block} />
          </div>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------- *
   * Not found
   * ---------------------------------------------------------------- */

  if (!collaborator) {
    return (
      <main
        className="grid min-h-[70vh] place-items-center px-4 py-16"
        style={{ background: tone.page }}
      >
        <div
          className="max-w-md rounded-[20px] p-10 text-center"
          style={{
            background: tone.surface,
            border: `1px solid ${tone.border}`,
            boxShadow: tone.shadow,
          }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: tone.muted }}
          >
            Collaborators
          </p>

          <h1
            className="mt-4 text-2xl font-bold tracking-tight"
            style={{ color: tone.heading, fontFamily: "var(--font-heading)" }}
          >
            <EditableText
              id="collaboratorProfile.notFoundTitle"
              defaultValue="Profile not found"
              className="inline"
            />
          </h1>

          <p className="mt-3 text-[15px] leading-7" style={{ color: tone.muted }}>
            <EditableText
              id="collaboratorProfile.notFoundDesc"
              defaultValue="This collaborator profile is not available."
              className="inline"
            />
          </p>

          <Link
            to="/collaborators"
            style={{ ...focusVars, background: theme.primaryColor, color: theme.backgroundColor }}
            className={`mt-7 inline-flex min-h-[44px] items-center rounded-xl px-5 text-sm font-semibold no-underline transition hover:opacity-90 ${focusRing}`}
          >
            Browse all collaborators
          </Link>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------- *
   * Profile
   * ---------------------------------------------------------------- */

  return (
    <>
      {/* React 19 hoists these into <head>. On React 18, wrap in react-helmet-async. */}
      <title>{`${collaborator.name} — Collaborators`}</title>
      {collaborator.bio && (
        <meta name="description" content={collaborator.bio.replace(/\s+/g, " ").slice(0, 300)} />
      )}

      <CollaboratorPublicProfile
        c={collaborator}
        linkedPublications={linkedPublications}
        galleryItems={galleryItems}
        onBack={handleBack}
      />
    </>
  );
};

export default CollaboratorProfilePage;
