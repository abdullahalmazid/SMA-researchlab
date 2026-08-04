import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppIcon, { type AppIconName } from "../components/AppIcon";
import EditableText from "../components/EditableText";
import { useThemeContext } from "../context/ThemeContext";
import {
  useAnnouncements,
  useCollaborators,
  useGallery,
  usePublications,
  useResearchIdeas,
  useSiteContent,
} from "../firebase/hooks";
import type { Announcement, CollaboratorProfile, GalleryItem } from "../types";

// ── Types ──────────────────────────────────────────────────────
interface LabHeadData {
  name: string;
  title: string;
  department: string;
  photo: string;
  shortBio: string;
  fullBio: string;
  email: string;
  phone: string;
  linkedin: string;
  scholar: string;
  orcid: string;
  researchgate: string;
  researchInterests: string;
}

/** The optional fields ManageAnnouncements writes. Declared locally so this
 *  file compiles against the existing Announcement type. */
type AnnouncementPost = Announcement & {
  title?: string;
  body?: string;
  category?: string;
};

const HOME_ANNOUNCEMENT_LIMIT = 4;
const ANNOUNCEMENT_NEW_DAYS = 21;

/** Slowed from 3.5s and 5s. Nobody reads a name, role and affiliation in
 *  three and a half seconds, and the old pace made the card unreadable. */
const COLLAB_INTERVAL = 7000;
const GALLERY_INTERVAL = 8000;

function announcementTitle(post: AnnouncementPost): string {
  if (post.title?.trim()) return post.title.trim();
  const first = (post.content || "").split(/(?<=[.!?])\s/)[0]?.trim() ?? "";
  return first.length > 72 ? `${first.slice(0, 70).trimEnd()}…` : first || "Untitled";
}

const announcementIsNew = (iso: string) => {
  const date = new Date(iso);
  return (
    !Number.isNaN(date.getTime()) &&
    (Date.now() - date.getTime()) / 86_400_000 < ANNOUNCEMENT_NEW_DAYS
  );
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Autoplay that can actually be stopped.
 *
 * WCAG 2.2.2 requires any auto-moving content running longer than five seconds
 * to have a pause mechanism. Hover alone doesn't satisfy it — there is no hover
 * on touch and none while tabbing — so this also exposes an explicit toggle.
 *
 * Including `index` in the deps restarts the countdown after manual navigation,
 * which is what the old resetTimer() calls were doing by hand.
 */
function useCarousel(length: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);

  // An admin deleting a record shrinks the array under a live snapshot. Without
  // this clamp the index points past the end and the render throws on undefined.
  const safeIndex = length > 0 ? Math.min(index, length - 1) : 0;

  useEffect(() => {
    if (paused || length < 2) return;
    const id = window.setInterval(() => {
      setIndex((c) => (c + 1) % length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [paused, length, intervalMs, safeIndex]);

  const prev = useCallback(() => setIndex((c) => (c - 1 + length) % length), [length]);
  const next = useCallback(() => setIndex((c) => (c + 1) % length), [length]);

  return { index: safeIndex, setIndex, prev, next, paused, setPaused };
}

const PauseButton: React.FC<{ paused: boolean; onToggle: () => void; label: string }> = ({
  paused, onToggle, label,
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="hm-ctrl"
    aria-label={paused ? `Resume ${label}` : `Pause ${label}`}
  >
    {paused ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7 4l13 8-13 8z" />
      </svg>
    ) : (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7 4h4v16H7zM13 4h4v16h-4z" />
      </svg>
    )}
  </button>
);

// ── Main Component ─────────────────────────────────────────────
const Home: React.FC = () => {
  const { content, loading } = useSiteContent();
  const { theme } = useThemeContext();
  const announcements = useAnnouncements();
  const { collaborators } = useCollaborators();
  const { ongoing, published } = usePublications();
  const { ideas } = useResearchIdeas();
  const { gallery } = useGallery();
  const [bannerImgErr, setBannerImgErr] = useState(false);
  const [visible, setVisible] = useState(false);

  /**
   * Proper WCAG relative luminance. Threshold 0.22 matches PublicationCard, so
   * the two can't disagree about whether the same theme colour counts as dark.
   */
  const isDarkTheme = useMemo(() => {
    const clean = (theme.backgroundColor ?? "").replace("#", "").trim();
    const full =
      clean.length === 3
        ? clean.split("").map((char) => char + char).join("")
        : clean;
    if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return false;

    const channel = (offset: number) => {
      const value = Number.parseInt(full.slice(offset, offset + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4) < 0.22;
  }, [theme.backgroundColor]);

  const sectionTextPrimary = isDarkTheme ? "#e5e7eb" : "#1f2937";
  const sectionTextSecondary = isDarkTheme ? "#cbd5e1" : "#374151";
  const sectionTextMuted = isDarkTheme ? "#94a3b8" : "#6b7280";
  const sectionCardBg = isDarkTheme ? "rgba(15,23,42,0.7)" : "#ffffff";
  const sectionCardBorder = isDarkTheme ? "rgba(148,163,184,0.22)" : "#e5e7eb";
  const stripBg = isDarkTheme ? "#0b1220" : "#ffffff";
  const stripBorder = isDarkTheme ? "rgba(148,163,184,0.2)" : "#e5e7eb";

  // The old timeout was never cleared, so unmounting mid-delay left a pending
  // setState on a dead component.
  useEffect(() => {
    if (loading) return;
    const id = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(id);
  }, [loading]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen" role="status" aria-label="Loading">
        <div
          className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );

  const stats = [
    { value: collaborators.length, label: content["home.statsLabel1"] ?? "Collaborators", icon: "collaborators" as AppIconName },
    { value: published.length, label: content["home.statsLabel2"] ?? "Publications", icon: "paper" as AppIconName },
    { value: ongoing.length, label: content["home.statsLabel3"] ?? "Ongoing Projects", icon: "lab" as AppIconName },
    { value: ideas.length, label: content["home.statsLabel4"] ?? "Research Ideas", icon: "ideas" as AppIconName },
  ];

  const publishedAnnouncements = (announcements as AnnouncementPost[])
    .filter((post) => !post.isHidden)
    .sort(
      (a, b) =>
        Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) ||
        String(b.createdAt).localeCompare(String(a.createdAt)),
    );

  const latestAnnouncements = publishedAnnouncements.slice(0, HOME_ANNOUNCEMENT_LIMIT);

  const labHead: LabHeadData = {
    name: content["labhead.name"] ?? "",
    title: content["labhead.title"] ?? "",
    department: content["labhead.department"] ?? "",
    photo: content["labhead.photo"] ?? "",
    shortBio: content["labhead.shortBio"] ?? "",
    fullBio: content["labhead.fullBio"] ?? "",
    email: content["labhead.email"] ?? "",
    phone: content["labhead.phone"] ?? "",
    linkedin: content["labhead.linkedin"] ?? "",
    scholar: content["labhead.scholar"] ?? "",
    orcid: content["labhead.orcid"] ?? "",
    researchgate: content["labhead.researchgate"] ?? "",
    researchInterests: content["labhead.researchInterests"] ?? "",
  };

  const hasLabHead = !!labHead.name;

  const heroLinks = [
    { href: labHead.linkedin, icon: "linkedin" as AppIconName, label: "LinkedIn" },
    { href: labHead.scholar, icon: "scholar" as AppIconName, label: "Google Scholar" },
    { href: labHead.orcid, icon: "orcid" as AppIconName, label: "ORCID" },
    { href: labHead.researchgate, icon: "researchgate" as AppIconName, label: "ResearchGate" },
  ].filter((l) => l.href);

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.5s ease" }}>
      <style>{CSS}</style>

      {/* ══════════════ HERO ══════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: 600 }}>
        {content["home.bannerUrl"] && !bannerImgErr ? (
          <img
            src={content["home.bannerUrl"]}
            alt=""
            onError={() => setBannerImgErr(true)}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.45)" }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: "var(--color-primary)" }} />
        )}

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, rgba(10, 20, 45, 0.65) 0%, rgba(20, 40, 90, 0.25) 55%, rgba(15, 30, 70, 0.33) 100%)",
          }}
        />

        <div
          aria-hidden="true"
          className="absolute top-0 right-0 w-96 h-96 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--color-accent)", transform: "translate(-30%, 30%)" }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-10 lg:px-20 py-4 lg:py-5 flex flex-col lg:flex-row items-center gap-14">
          {/* ── Left: Text ── */}
          <div
            className="flex-1 text-center lg:text-left"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
            }}
          >
            <div
              className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border"
              style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)" }}
            >
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full motion-safe:animate-pulse"
                style={{ background: "var(--color-accent)" }}
              />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.75)" }}>
                <EditableText
                  id="home.buetBadge"
                  tag="span"
                  defaultValue="Bangladesh University of Engineering and Technology"
                  className="inline"
                />
              </span>
            </div>

            {/* A <span> cannot contain an <h1>. These wrappers are divs now —
                the old markup was invalid and browsers silently reparented it. */}
            <div
              style={{
                fontSize: "clamp(2.4rem, 5.5vw, 4rem)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "-2px",
                textShadow: "0 2px 20px rgba(0,0,0,0.3)",
              }}
            >
              <EditableText
                id="home.heroTitle"
                tag="h1"
                className="font-black text-white leading-none mb-5"
                defaultValue={content["home.heroTitle"] ?? "DASS Research Lounge"}
              />
            </div>

            <div className="flex justify-center lg:justify-start mb-5">
              <div className="h-1 w-20 rounded-full" style={{ background: "var(--color-accent)" }} />
            </div>

            <div style={{ color: "rgba(255,255,255,0.8)", maxWidth: 500, margin: "0 auto 2.5rem auto" }}>
              <EditableText
                id="home.heroSubtitle"
                tag="p"
                className="text-base lg:text-lg leading-relaxed mb-10"
                defaultValue={
                  content["home.heroSubtitle"] ?? "Advancing the frontiers of science and technology."
                }
              />
            </div>

            <div className="flex gap-3 flex-wrap justify-center lg:justify-start">
              <Link
                to="/research-ideas"
                className="hm-cta no-underline font-black px-7 py-3.5 rounded-xl text-sm"
                style={{
                  background: "var(--color-accent)",
                  color: "#1f2937",
                  boxShadow: "0 4px 20px rgba(245,158,11,0.35)",
                  letterSpacing: "-0.3px",
                }}
              >
                <EditableText
                  id="home.heroCta"
                  tag="span"
                  defaultValue={content["home.heroCta"] ?? "Explore Research Ideas"}
                  className="inline"
                />{" "}
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                to="/about"
                className="hm-cta no-underline font-bold px-7 py-3.5 rounded-xl text-sm text-white"
                style={{
                  border: "1.5px solid rgba(255,255,255,0.35)",
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <EditableText id="home.aboutButton" tag="span" defaultValue="About the Lab" className="inline" />
              </Link>
            </div>
          </div>

          {/* ── Right: Lab Head Card ── */}
          {hasLabHead && (
            <div
              className="flex-shrink-0 w-full lg:w-80"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.7s ease 0.3s, transform 0.7s ease 0.3s",
              }}
            >
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className="h-1 w-full"
                  style={{ background: "linear-gradient(90deg, var(--color-accent), var(--color-secondary))" }}
                />

                <div className="flex justify-center pt-7 pb-4">
                  <LabHeadAvatar photo={labHead.photo} name={labHead.name} size={200} rounded="xl" />
                </div>

                <div className="px-6 pb-6 text-center">
                  <div
                    className="inline-block px-3 py-0.5 rounded-full text-xs font-bold mb-2"
                    style={{ background: "rgba(245,158,11,0.15)", color: "var(--color-accent)" }}
                  >
                    <EditableText id="home.labDirectorBadge" tag="span" defaultValue="Lab Director" className="inline" />
                  </div>

                  <h2 className="text-white font-black text-xl leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
                    <EditableText id="labhead.name" tag="span" defaultValue={labHead.name} className="inline" />
                  </h2>

                  {labHead.title && (
                    <p className="text-xs mt-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <EditableText id="labhead.title" tag="span" defaultValue={labHead.title} className="inline" />
                    </p>
                  )}
                  {labHead.department && (
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                      <EditableText id="labhead.department" tag="span" defaultValue={labHead.department} className="inline" />
                    </p>
                  )}

                  <div className="my-4 h-px w-full" style={{ background: "rgba(255,255,255,0.1)" }} />

                  {labHead.shortBio && (
                    <p
                      className="text-xs leading-relaxed mb-5"
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      <EditableText
                        id="labhead.shortBio"
                        tag="span"
                        defaultValue={labHead.shortBio}
                        className="inline"
                        multiline
                      />
                    </p>
                  )}

                  {/* These were background:#ffffff with text-white — white icons
                      on a white chip, invisible against the glass card. */}
                  {heroLinks.length > 0 && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      {heroLinks.map((l) => (
                        <a
                          key={l.icon}
                          href={l.href}
                          target="_blank"
                          rel="noreferrer"
                          className="hm-social no-underline"
                          aria-label={`${labHead.name} on ${l.label}`}
                        >
                          <AppIcon name={l.icon} size={15} />
                        </a>
                      ))}
                    </div>
                  )}

                  <Link
                    to="/lab-head"
                    className="hm-cta w-full inline-flex items-center justify-center no-underline text-sm font-black py-2.5 rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, var(--color-accent), var(--color-secondary))",
                      color: "#1f2937",
                      boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
                    }}
                  >
                    <EditableText id="labhead.fullProfileCta" defaultValue="Full Profile →" className="font-black text-sm" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════ STATS ══════════════ */}
      <section style={{ background: "var(--color-primary)" }}>
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="text-center py-6 px-4"
              style={{ borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}
            >
              <div className="mb-1 inline-flex text-white/80" aria-hidden="true">
                <AppIcon name={s.icon} size={20} />
              </div>
              <div
                className="text-3xl font-black leading-none"
                style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
              >
                {s.value}
              </div>
              <div className="text-xs mt-1.5 font-medium" style={{ color: "rgba(255,255,255,0.65)", letterSpacing: "0.5px" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════ ABOUT + ANNOUNCEMENTS ══════════════ */}
      <div
        className="max-w-7xl mx-auto px-6 lg:px-8 py-20 grid grid-cols-1 lg:grid-cols-3 gap-14"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-8 rounded-full" style={{ background: "var(--color-accent)" }} />
            <div style={{ color: sectionTextPrimary, fontFamily: "var(--font-heading)" }}>
              <EditableText
                id="home.introTitle"
                tag="h2"
                className="font-black text-2xl"
                defaultValue={content["home.introTitle"] ?? "About the Lab"}
              />
            </div>
          </div>
          <div className="w-16 h-0.5 ml-4 mb-7 rounded" style={{ background: "var(--color-accent)", opacity: 0.4 }} />

          <div style={{ whiteSpace: "pre-line", lineHeight: 1.85, color: sectionTextSecondary }}>
            <EditableText
              id="home.introText"
              tag="p"
              className="leading-relaxed text-base mb-8"
              defaultValue={content["home.introText"] ?? ""}
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <Link
              to="/about"
              className="hm-cta no-underline font-bold text-sm px-6 py-2.5 rounded-xl text-white"
              style={{ background: "var(--color-primary)", boxShadow: "0 2px 12px rgba(30,58,95,0.25)" }}
            >
              <EditableText id="home.readMore" defaultValue="Read More" className="font-bold text-sm" />
            </Link>
            <Link
              to="/collaborators"
              className="hm-cta no-underline font-bold text-sm px-6 py-2.5 rounded-xl border-2"
              style={{
                color: isDarkTheme ? sectionTextPrimary : "var(--color-primary)",
                borderColor: isDarkTheme ? "rgba(148,163,184,0.45)" : "var(--color-primary)",
                background: isDarkTheme ? "rgba(15,23,42,0.4)" : "transparent",
              }}
            >
              <EditableText id="home.meetTheTeam" defaultValue="Meet the Team" className="font-bold text-sm" />
            </Link>
            <Link
              to="/publications"
              className="hm-cta no-underline font-bold text-sm px-6 py-2.5 rounded-xl"
              style={{ color: "#1f2937", background: "var(--color-accent)" }}
            >
              <EditableText id="home.publicationsCta" defaultValue="Publications →" className="font-bold text-sm" />
            </Link>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-8 rounded-full" style={{ background: "var(--color-secondary)" }} />
            <div style={{ color: sectionTextPrimary, fontFamily: "var(--font-heading)" }}>
              <EditableText
                id="home.announcementsTitle"
                tag="h2"
                className="font-black text-xl"
                defaultValue={content["home.announcementsTitle"] ?? "Latest Updates"}
              />
            </div>
          </div>
          <div className="w-12 h-0.5 ml-4 mb-6 rounded" style={{ background: "var(--color-secondary)", opacity: 0.3 }} />

          <div className="flex flex-col gap-3">
            {latestAnnouncements.length === 0 ? (
              <div className="text-center py-8 rounded-xl border-2 border-dashed" style={{ borderColor: sectionCardBorder }}>
                <p className="text-sm" style={{ color: sectionTextMuted }}>
                  <EditableText id="home.noAnnouncements" defaultValue="No announcements yet." className="text-sm" />
                </p>
              </div>
            ) : (
              latestAnnouncements.map((a, idx) => (
                <Link
                  key={a.id}
                  to={`/announcements?a=${encodeURIComponent(a.id)}`}
                  className="hm-note no-underline block rounded-xl p-4"
                  style={{
                    background: sectionCardBg,
                    border: `1px solid ${sectionCardBorder}`,
                    borderLeft: `3px solid ${a.isPinned ? "var(--color-accent)" : "var(--color-secondary)"}`,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateX(0)" : "translateX(16px)",
                    transition: `opacity 0.5s ease ${0.1 + idx * 0.08}s, transform 0.5s ease ${0.1 + idx * 0.08}s`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {a.isPinned && (
                      <span
                        className="text-[9.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(245,158,11,0.15)", color: "var(--color-accent)" }}
                      >
                        Pinned
                      </span>
                    )}
                    {announcementIsNew(a.createdAt) && (
                      <span
                        className="text-[9.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{
                          background: "color-mix(in srgb, var(--color-secondary) 15%, transparent)",
                          color: "var(--color-secondary)",
                        }}
                      >
                        New
                      </span>
                    )}
                    <span className="text-xs font-medium ml-auto" style={{ color: sectionTextMuted }}>
                      {new Date(a.createdAt).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </span>
                  </div>

                  <p className="font-bold text-sm leading-snug" style={{ color: sectionTextPrimary, fontFamily: "var(--font-heading)" }}>
                    {announcementTitle(a)}
                  </p>

                  <p
                    className="text-xs mt-1.5 leading-relaxed"
                    style={{
                      color: sectionTextSecondary,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {a.content}
                  </p>
                </Link>
              ))
            )}

            {publishedAnnouncements.length > latestAnnouncements.length && (
              <Link
                to="/announcements"
                className="hm-cta no-underline text-xs font-bold text-center py-2.5 rounded-xl border"
                style={{ color: "var(--color-secondary)", borderColor: sectionCardBorder }}
              >
                <EditableText id="home.viewAllAnnouncements" defaultValue="View all announcements →" className="font-bold text-xs" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ QUICK LINKS ══════════════ */}
      <div className="border-t border-b" style={{ borderColor: stripBorder, background: stripBg }}>
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { to: "/collaborators", icon: "handshake" as AppIconName, title: "Collaborators", desc: "Meet the researchers behind our work.", color: "var(--color-primary)" },
            { to: "/publications", icon: "publications" as AppIconName, title: "Publications", desc: "Explore our published and ongoing research.", color: "var(--color-secondary)" },
            { to: "/research-ideas", icon: "ideas" as AppIconName, title: "Research Ideas", desc: "Discover open research questions and collaborate.", color: "var(--color-accent)" },
          ].map((item) => (
            /* Hover is CSS now, not onMouseEnter style mutation — so it also
               responds to keyboard focus and respects reduced motion. */
            <Link
              key={item.to}
              to={item.to}
              className="hm-quick no-underline flex items-start gap-4 p-5 rounded-2xl border"
              style={{ borderColor: stripBorder, ["--hm-accent" as string]: item.color }}
            >
              <span
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)`, color: item.color }}
              >
                <AppIcon name={item.icon} size={20} />
              </span>
              <span>
                <span className="block font-black text-sm" style={{ color: item.color }}>{item.title}</span>
                <span className="block text-xs mt-0.5 leading-relaxed" style={{ color: sectionTextMuted }}>{item.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {(collaborators.length > 0 || gallery.length > 0) && (
        <TeamAndGallery collaborators={collaborators} gallery={gallery} isDarkTheme={isDarkTheme} />
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// TEAM + GALLERY
// ══════════════════════════════════════════════════════════════
const TeamAndGallery: React.FC<{
  collaborators: CollaboratorProfile[];
  gallery: GalleryItem[];
  isDarkTheme: boolean;
}> = ({ collaborators, gallery, isDarkTheme }) => {
  const collabs = useCarousel(collaborators.length, COLLAB_INTERVAL);
  const shots = useCarousel(gallery.length, GALLERY_INTERVAL);
  const [imgErr, setImgErr] = useState<Record<number, boolean>>({});

  // Clamped by useCarousel, so these can't be undefined while the array is
  // non-empty — which is what used to crash when an admin deleted a record.
  const collab = collaborators[collabs.index];
  const shot = gallery[shots.index];

  const headingText = isDarkTheme ? "#e5e7eb" : "var(--color-primary)";
  const softText = isDarkTheme ? "#cbd5e1" : "#4b5563";
  const mutedText = isDarkTheme ? "#94a3b8" : "#6b7280";
  const sectionBorder = isDarkTheme ? "rgba(148,163,184,0.2)" : "#f0f0f0";
  const cardBg = isDarkTheme
    ? "linear-gradient(160deg, rgba(15,23,42,0.95) 60%, rgba(17,24,39,0.95) 100%)"
    : "linear-gradient(160deg, rgba(255,255,255,0.97) 60%, rgba(235,240,255,0.95) 100%)";

  const CARD_HEIGHT = 420;

  return (
    <section
      style={{ background: "var(--color-bg)", borderTop: `1px solid ${sectionBorder}` }}
      className="py-16 px-6"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <div
            className="w-1 h-8 rounded-full"
            style={{ background: "linear-gradient(180deg, var(--color-accent), var(--color-secondary))" }}
          />
          <div>
            <h2 className="font-black text-2xl" style={{ color: headingText, fontFamily: "var(--font-heading)" }}>
              <EditableText id="home.teamGalleryHeader" tag="span" defaultValue="Our Team & Gallery" className="inline" />
            </h2>
            <div
              className="h-0.5 mt-1 rounded-full"
              style={{
                width: "60%",
                background: "linear-gradient(90deg, var(--color-accent), var(--color-navbar), transparent)",
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── LEFT: Collaborator ── */}
          {collaborators.length > 0 && collab && (
            <div
              className="flex flex-col"
              onMouseEnter={() => collabs.setPaused(true)}
              onMouseLeave={() => collabs.setPaused(prefersReducedMotion())}
              onFocusCapture={() => collabs.setPaused(true)}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold" style={{ color: headingText }}>
                  <EditableText id="home.ourCollaboratorsHeader" defaultValue="✦ Our Collaborators" className="text-sm font-bold" />
                </p>
                <div className="flex gap-2">
                  {collaborators.length > 1 && (
                    <PauseButton
                      paused={collabs.paused}
                      onToggle={() => collabs.setPaused((p) => !p)}
                      label="collaborator slideshow"
                    />
                  )}
                  <button type="button" onClick={collabs.prev} disabled={collaborators.length < 2} className="hm-ctrl" aria-label="Previous collaborator">‹</button>
                  <button type="button" onClick={collabs.next} disabled={collaborators.length < 2} className="hm-ctrl" aria-label="Next collaborator">›</button>
                </div>
              </div>

              <div className="rotating-border" style={{ borderRadius: "1.25rem", padding: 3, height: CARD_HEIGHT }}>
                <Link
                  to="/collaborators"
                  className="hm-slide no-underline flex flex-col items-center justify-center text-center"
                  style={{
                    borderRadius: "calc(1.25rem - 3px)",
                    height: "100%",
                    overflow: "hidden",
                    background: cardBg,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <div
                    className="w-full h-1.5 flex-shrink-0"
                    style={{ background: "linear-gradient(90deg, var(--color-accent), var(--color-primary))" }}
                  />

                  <div className="flex flex-col items-center justify-center flex-1 px-8 py-8">
                    <div
                      style={{
                        borderRadius: "8%",
                        padding: 3,
                        display: "inline-block",
                        background: "linear-gradient(135deg, var(--color-accent), var(--color-navbar))",
                        boxShadow: "0 0 24px rgba(99,102,241,0.25), 0 0 48px rgba(99,102,241,0.1)",
                      }}
                    >
                      <div style={{ borderRadius: "8%", overflow: "hidden", lineHeight: 0 }}>
                        <CollabAvatar photo={collab.photo ?? ""} name={collab.name} size={180} />
                      </div>
                    </div>

                    <h3 className="font-black text-xl mt-5 leading-tight" style={{ color: headingText }}>
                      {collab.name}
                    </h3>

                    {collab.designation && (
                      <p
                        className="text-sm font-semibold mt-2 px-4 py-1 rounded-full"
                        style={{
                          color: "white",
                          background: "linear-gradient(90deg, var(--color-accent), var(--color-navbar))",
                          boxShadow: "0 2px 10px rgba(99,102,241,0.3)",
                        }}
                      >
                        {collab.designation}
                      </p>
                    )}

                    {collab.affiliation && (
                      <p className="text-sm mt-2 font-medium inline-flex items-center gap-1.5" style={{ color: mutedText }}>
                        <AppIcon name="building" size={14} /> {collab.affiliation}
                      </p>
                    )}

                    {/* Was collab.shortBio — a field CollaboratorProfile does not
                        have, so the bio never rendered. It is `bio`. */}
                    {collab.bio && (
                      <p
                        className="text-xs mt-4 leading-relaxed"
                        style={{
                          color: softText,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          maxWidth: 280,
                        }}
                      >
                        {collab.bio}
                      </p>
                    )}

                    <div
                      className="mt-5 px-4 py-1 rounded-full text-xs font-bold"
                      style={{
                        background: "rgba(99,102,241,0.08)",
                        color: "var(--color-accent)",
                        border: "1px solid rgba(99,102,241,0.2)",
                      }}
                    >
                      {collabs.index + 1} / {collaborators.length}
                    </div>
                  </div>
                </Link>
              </div>

              <div className="text-center mt-3">
                <Link
                  to="/collaborators"
                  className="hm-pill no-underline text-xs font-bold px-4 py-1.5 rounded-full"
                >
                  <EditableText
                    id="home.viewAllCollaborators"
                    defaultValue={`View all ${collaborators.length} collaborators →`}
                    className="font-bold text-xs"
                  />
                </Link>
              </div>
            </div>
          )}

          {/* ── RIGHT: Gallery ── */}
          {gallery.length > 0 && shot && (
            <div
              className="flex flex-col"
              onMouseEnter={() => shots.setPaused(true)}
              onMouseLeave={() => shots.setPaused(prefersReducedMotion())}
              onFocusCapture={() => shots.setPaused(true)}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold" style={{ color: headingText }}>
                  <EditableText id="home.galleryHeader" defaultValue="✦ Gallery" className="text-sm font-bold" />
                </p>
                <div className="flex items-center gap-2">
                  {gallery.length > 1 && (
                    <PauseButton paused={shots.paused} onToggle={() => shots.setPaused((p) => !p)} label="gallery slideshow" />
                  )}
                  <button type="button" onClick={shots.prev} disabled={gallery.length < 2} className="hm-ctrl" aria-label="Previous image">‹</button>
                  <button type="button" onClick={shots.next} disabled={gallery.length < 2} className="hm-ctrl" aria-label="Next image">›</button>
                  <Link to="/gallery" className="hm-ctrl hm-ctrl-wide no-underline">
                    <EditableText id="home.galleryAllCta" defaultValue="All →" className="text-xs font-bold" />
                  </Link>
                </div>
              </div>

              <div className="rotating-border" style={{ borderRadius: "1.25rem", padding: 3, height: CARD_HEIGHT }}>
                <div className="relative w-full h-full overflow-hidden" style={{ borderRadius: "calc(1.25rem - 3px)" }}>
                  {shot.imageUrl && !imgErr[shots.index] ? (
                    <img
                      key={shots.index}
                      src={shot.imageUrl}
                      alt={shot.title}
                      loading="lazy"
                      onError={() => setImgErr((e) => ({ ...e, [shots.index]: true }))}
                      className="ken-burns w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "#f3f4f6" }}>
                      <AppIcon name="gallery" size={42} />
                    </div>
                  )}

                  <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
                      zIndex: 1,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0"
                    style={{ height: 80, background: "linear-gradient(to bottom, rgba(0,0,0,0.35), transparent)", zIndex: 1 }}
                  />

                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 pt-8" style={{ zIndex: 2 }}>
                    <h3 className="text-white font-black text-lg leading-tight mb-1 drop-shadow">{shot.title}</h3>
                    {shot.description && (
                      <p
                        className="text-xs mt-1"
                        style={{
                          color: "rgba(255,255,255,0.8)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {shot.description}
                      </p>
                    )}
                  </div>

                  <div
                    className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, var(--color-accent), var(--color-secondary))",
                      color: "white",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                      zIndex: 2,
                    }}
                  >
                    {shots.index + 1} / {gallery.length}
                  </div>
                </div>
              </div>

              {gallery.length > 1 && gallery.length <= 20 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {gallery.map((item, i) => (
                    <button
                      key={item.id ?? i}
                      type="button"
                      onClick={() => shots.setIndex(i)}
                      className="hm-dot"
                      aria-label={`Go to image ${i + 1}`}
                      aria-current={i === shots.index}
                      style={{
                        width: i === shots.index ? 24 : 8,
                        background:
                          i === shots.index
                            ? "linear-gradient(90deg, var(--color-accent), var(--color-secondary))"
                            : "#cbd5e1",
                        boxShadow: i === shots.index ? "0 0 8px rgba(99,102,241,0.5)" : "none",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// ══════════════════════════════════════════════════════════════
// AVATARS
// ══════════════════════════════════════════════════════════════
const initialsOf = (name: string) =>
  name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

const CollabAvatar: React.FC<{ photo: string; name: string; size: number }> = ({ photo, name, size }) => {
  const [err, setErr] = useState(false);
  if (photo && !err) {
    return (
      <img
        src={photo}
        alt=""
        loading="lazy"
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: "8%", objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center text-white font-black"
      style={{
        width: size, height: size, borderRadius: "8%",
        background: "var(--color-secondary)", fontSize: size * 0.3,
      }}
    >
      {initialsOf(name)}
    </div>
  );
};

const LabHeadAvatar: React.FC<{
  photo: string;
  name: string;
  size: number;
  rounded?: "full" | "xl";
}> = ({ photo, name, size, rounded = "full" }) => {
  const [err, setErr] = useState(false);
  // The photo branch used to hardcode 5%, so rounded="full" did nothing.
  const borderRadius = rounded === "full" ? "50%" : "16px";

  if (photo && !err) {
    return (
      <img
        src={photo}
        alt=""
        onError={() => setErr(true)}
        style={{
          width: size,
          height: size,
          borderRadius,
          objectFit: "cover",
          display: "block",
          // Was var(--color-primary, --color-secondary) — an invalid fallback,
          // so this border never rendered at all.
          border: "3px solid rgba(255,255,255,0.3)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center text-white font-black"
      style={{
        width: size, height: size, borderRadius,
        background: "var(--color-secondary)",
        fontSize: size * 0.3,
        border: "3px solid rgba(255,255,255,0.3)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      {initialsOf(name)}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
 * Styles — hover and focus in CSS rather than inline handlers, so
 * keyboard users get the same affordances and motion can be opted out of.
 * ══════════════════════════════════════════════════════════════ */

const CSS = `
.hm-cta{transition:transform .2s ease,box-shadow .2s ease,filter .2s ease}
.hm-cta:hover{filter:brightness(1.06)}
.hm-cta:focus-visible{outline:2px solid var(--color-accent);outline-offset:3px}
@media (prefers-reduced-motion:no-preference){.hm-cta:hover{transform:translateY(-2px)}}

.hm-social{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;
  color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);
  transition:background .2s ease,transform .2s ease}
.hm-social:hover{background:rgba(255,255,255,.24)}
.hm-social:focus-visible{outline:2px solid #fff;outline-offset:2px}
@media (prefers-reduced-motion:no-preference){.hm-social:hover{transform:translateY(-2px)}}

.hm-note{transition:transform .2s ease,box-shadow .2s ease}
.hm-note:focus-visible{outline:2px solid var(--color-secondary);outline-offset:2px}
@media (prefers-reduced-motion:no-preference){.hm-note:hover{transform:translateY(-2px)}}

.hm-quick{transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease}
.hm-quick:hover{border-color:var(--hm-accent)!important;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.hm-quick:focus-visible{outline:2px solid var(--hm-accent);outline-offset:2px}
@media (prefers-reduced-motion:no-preference){.hm-quick:hover{transform:translateY(-2px)}}

.hm-ctrl{display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:9px;
  font-size:16px;font-weight:700;line-height:1;color:#fff;cursor:pointer;
  background:linear-gradient(135deg,var(--color-accent),var(--color-navbar));
  box-shadow:0 2px 8px rgba(0,0,0,.15);transition:filter .2s ease}
.hm-ctrl:hover{filter:brightness(1.1)}
.hm-ctrl:disabled{opacity:.4;cursor:not-allowed}
.hm-ctrl:focus-visible{outline:2px solid var(--color-secondary);outline-offset:2px}
.hm-ctrl-wide{width:auto;padding:0 12px;font-size:12px}

.hm-slide{transition:transform .3s ease,box-shadow .3s ease}
.hm-slide:focus-visible{outline:2px solid var(--color-secondary);outline-offset:3px}
@media (prefers-reduced-motion:no-preference){
  .hm-slide:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(0,0,0,.13)!important}
}

.hm-pill{color:var(--color-secondary);border:1px solid var(--color-secondary);
  transition:background .2s ease,color .2s ease}
.hm-pill:hover{background:var(--color-secondary);color:#fff}
.hm-pill:focus-visible{outline:2px solid var(--color-secondary);outline-offset:2px}

.hm-dot{height:8px;padding:0;border:0;border-radius:99px;cursor:pointer;
  transition:width .25s ease,background .25s ease}
.hm-dot:focus-visible{outline:2px solid var(--color-secondary);outline-offset:3px}
`;

export default Home;
