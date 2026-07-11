import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppIcon, { type AppIconName } from "../components/AppIcon";
import EditableText from "../components/EditableText";
import { useThemeContext } from "../context/ThemeContext";
import {
  useAnnouncements,
  useCollaborators,
  useGallery, // ── ADDED: gallery hook
  usePublications,
  useResearchIdeas,
  useSiteContent,
} from "../firebase/hooks";

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

// ── Main Component ─────────────────────────────────────────────
const Home: React.FC = () => {
  const { content, loading } = useSiteContent();
  const { theme } = useThemeContext();
  const announcements = useAnnouncements();
  const { collaborators } = useCollaborators();
  const { ongoing, published } = usePublications();
  const { ideas } = useResearchIdeas();
  const { gallery } = useGallery(); // ── ADDED: gallery data
  const [bannerImgErr, setBannerImgErr] = useState(false);
  const [visible, setVisible] = useState(false);

  const isDarkTheme = React.useMemo(() => {
    const clean = (theme.backgroundColor ?? "").replace("#", "").trim();
    if (clean.length !== 6) return false;
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance < 140;
  }, [theme.backgroundColor]);

  const sectionTextPrimary = isDarkTheme ? "#e5e7eb" : "#1f2937";
  const sectionTextSecondary = isDarkTheme ? "#cbd5e1" : "#374151";
  const sectionTextMuted = isDarkTheme ? "#94a3b8" : "#9ca3af";
  const sectionCardBg = isDarkTheme ? "rgba(15,23,42,0.7)" : "#ffffff";
  const sectionCardBorder = isDarkTheme ? "rgba(148,163,184,0.22)" : "#e5e7eb";
  const stripBg = isDarkTheme ? "#0b1220" : "#ffffff";
  const stripBorder = isDarkTheme ? "rgba(148,163,184,0.2)" : "#e5e7eb";

  useEffect(() => {
    if (!loading) setTimeout(() => setVisible(true), 80);
  }, [loading]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
          style={{
            borderColor: "var(--color-primary)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );

  const stats = [
    {
      value: collaborators.length,
      label: content["home.statsLabel1"] ?? "Collaborators",
      icon: "collaborators" as AppIconName,
    },
    {
      value: published.length,
      label: content["home.statsLabel2"] ?? "Publications",
      icon: "paper" as AppIconName,
    },
    {
      value: ongoing.length,
      label: content["home.statsLabel3"] ?? "Ongoing Projects",
      icon: "lab" as AppIconName,
    },
    {
      value: ideas.length,
      label: content["home.statsLabel4"] ?? "Research Ideas",
      icon: "ideas" as AppIconName,
    },
  ];

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

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.5s ease" }}>
      {/* ══════════════════════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden " style={{ minHeight: 600 }}>
        {/* Background image */}
        {content["home.bannerUrl"] && !bannerImgErr ? (
          <img
            src={content["home.bannerUrl"]}
            alt=""
            onError={() => setBannerImgErr(true)}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.45)" }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "var(--color-primary)" }}
          />
        )}

        {/* Gradient overlay — dark left, lighter right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, rgba(10, 20, 45, 0.65) 0%, rgba(20, 40, 90, 0.25) 55%, rgba(15, 30, 70, 0.33) 100%)",
          }}
        />

        {/* Decorative dots pattern top-right */}
        <div
          className="absolute top-0 right-0 w-96 h-96 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Accent glow bottom-left */}
        <div
          className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{
            background: "var(--color-accent)",
            transform: "translate(-30%, 30%)",
          }}
        />

        {/* Content */}
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
            {/* BUET badge */}
            <div
              className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border"
              style={{
                borderColor: "rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--color-accent)" }}
              />
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                <EditableText
                  id="home.buetBadge"
                  tag="span"
                  defaultValue="Bangladesh University of Engineering and Technology"
                  className="inline"
                />
              </span>
            </div>

            {/* Main heading */}
            <span
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
                defaultValue={
                  content["home.heroTitle"] ?? "Rahman Research Lab"
                }
              />
            </span>

            {/* Accent line */}
            <div className="flex justify-center lg:justify-start mb-5">
              <div
                className="h-1 w-20 rounded-full"
                style={{ background: "var(--color-accent)" }}
              />
            </div>

            {/* Subtitle */}
            <span
              style={{
                color: "rgba(255,255,255,0.78)",
                maxWidth: 500,
                margin: "0 auto 2.5rem auto",
              }}
            >
              <EditableText
                id="home.heroSubtitle"
                tag="p"
                className="text-base lg:text-lg leading-relaxed mb-10"
                defaultValue={
                  content["home.heroSubtitle"] ??
                  "Advancing the frontiers of science and technology."
                }
              />
            </span>

            {/* CTA buttons */}
            <div className="flex gap-3 flex-wrap justify-center lg:justify-start">
              <Link
                to="/research-ideas"
                className="no-underline font-black px-7 py-3.5 rounded-xl text-sm"
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
                  defaultValue={
                    content["home.heroCta"] ?? "Explore Research Ideas"
                  }
                  className="inline"
                />{" "}
                →
              </Link>
              <Link
                to="/about"
                className="no-underline font-bold px-7 py-3.5 rounded-xl text-sm text-white"
                style={{
                  border: "1.5px solid rgba(255,255,255,0.35)",
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <EditableText
                  id="home.aboutButton"
                  tag="span"
                  defaultValue="About the Lab"
                  className="inline"
                />
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
                  boxShadow:
                    "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                {/* Accent top bar */}
                <div
                  className="h-1 w-full"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--color-accent), var(--color-secondary))",
                  }}
                />

                {/* Photo */}
                <div className="flex justify-center pt-7 pb-4">
                  <LabHeadAvatar
                    photo={labHead.photo}
                    name={labHead.name}
                    size={220}
                    rounded="full"
                  />
                </div>

                {/* Info */}
                <div className="px-6 pb-6 text-center">
                  <div
                    className="inline-block px-3 py-0.5 rounded-full text-xs font-bold mb-2"
                    style={{
                      background: "rgba(245,158,11,0.15)",
                      color: "var(--color-accent)",
                    }}
                  >
                    <EditableText
                      id="home.labDirectorBadge"
                      tag="span"
                      defaultValue="Lab Director"
                      className="inline"
                    />
                  </div>
                  <h2
                    className="text-white font-black text-xl leading-tight"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <EditableText
                      id="labhead.name"
                      tag="span"
                      defaultValue={labHead.name || "Lab Head Name"}
                      className="text-white font-black text-xl leading-tight"
                    />
                  </h2>
                  {labHead.title && (
                    <p
                      className="text-xs mt-1.5 font-semibold"
                      style={{ color: "rgba(255,255,255,0.6)" }}
                    >
                      <EditableText
                        id="labhead.title"
                        tag="span"
                        defaultValue={labHead.title || "Lab Head Title"}
                        className="text-xs mt-1.5 font-semibold"
                      />
                    </p>
                  )}
                  {labHead.department && (
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      <EditableText
                        id="labhead.department"
                        tag="span"
                        defaultValue={labHead.department || "Department"}
                        className="text-xs mt-0.5"
                      />
                    </p>
                  )}

                  {/* Divider */}
                  <div
                    className="my-4 h-px w-full"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  />

                  {labHead.shortBio && (
                    <p
                      className="text-xs leading-relaxed mb-5"
                      style={{
                        color: "rgba(255,255,255,0.65)",
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      <EditableText
                        id="labhead.shortBio"
                        tag="span"
                        defaultValue={labHead.shortBio || "Short bio..."}
                        className="text-xs leading-relaxed"
                        multiline
                      />
                    </p>
                  )}

                  {/* Social icons row */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {[
                      {
                        href: labHead.linkedin,
                        icon: "linkedin" as AppIconName,
                        label: "LinkedIn",
                        color: "#ffffff",
                      },
                      {
                        href: labHead.scholar,
                        icon: "scholar" as AppIconName,
                        label: "Google Scholar",
                        color: "#ffffff",
                      },
                      {
                        href: labHead.orcid,
                        icon: "orcid" as AppIconName,
                        label: "ORCID",
                        color: "#ffffff",
                      },
                      {
                        href: labHead.researchgate,
                        icon: "researchgate" as AppIconName,
                        label: "ResearchGate",
                        color: "#ffffff",
                      },
                    ]
                      .filter((l) => l.href)
                      .map((l) => (
                        <a
                          key={l.icon}
                          href={l.href}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="no-underline font-black text-white rounded-lg flex items-center justify-center transition-all"
                          aria-label={l.label}
                          title={l.label}
                          style={{
                            background: l.color,
                            width: 30,
                            height: 30,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.transform =
                              "translateY(-2px)";
                            (e.currentTarget as HTMLElement).style.boxShadow =
                              "0 4px 12px rgba(0,0,0,0.2)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.transform =
                              "translateY(0)";
                            (e.currentTarget as HTMLElement).style.boxShadow =
                              "none";
                          }}
                        >
                          <AppIcon name={l.icon} size={13} />
                        </a>
                      ))}
                  </div>

                  <Link
                    to="/lab-head"
                    className="w-full inline-flex items-center justify-center no-underline text-sm font-black py-2.5 rounded-xl"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-accent), #f97316)",
                      color: "#1f2937",
                      boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
                    }}
                  >
                    <EditableText
                      id="labhead.fullProfileCta"
                      defaultValue="Full Profile →"
                      className="font-black text-sm"
                    />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STATS STRIP
      ══════════════════════════════════════════════════════════ */}
      <section style={{ background: "var(--color-primary)" }}>
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="text-center py-6 px-4"
              style={{
                borderRight:
                  i < stats.length - 1
                    ? "1px solid rgba(255,255,255,0.1)"
                    : "none",
              }}
            >
              <div className="mb-1 inline-flex text-white/80">
                <AppIcon name={s.icon} size={20} />
              </div>
              <div
                className="text-3xl font-black leading-none"
                style={{
                  color: "var(--color-accent)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {s.value}
              </div>
              <div
                className="text-xs mt-1.5 font-medium"
                style={{
                  color: "rgba(255,255,255,0.6)",
                  letterSpacing: "0.5px",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          ABOUT + ANNOUNCEMENTS
      ══════════════════════════════════════════════════════════ */}
      <div
        className="max-w-7xl mx-auto px-6 lg:px-8 py-20 grid grid-cols-1 lg:grid-cols-3 gap-14"
        style={{ background: "var(--color-bg)" }}
      >
        {/* About the Lab */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-1 h-8 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
            <span
              style={{
                color: sectionTextPrimary,
                fontFamily: "var(--font-heading)",
              }}
            >
              <EditableText
                id="home.introTitle"
                tag="h2"
                className="font-black text-2xl"
                defaultValue={content["home.introTitle"] ?? "About the Lab"}
              />
            </span>
          </div>
          <div
            className="w-16 h-0.5 ml-4 mb-7 rounded"
            style={{ background: "var(--color-accent)", opacity: 0.4 }}
          />

          <span
            style={{
              whiteSpace: "pre-line",
              lineHeight: 1.85,
              color: sectionTextSecondary,
            }}
          >
            <EditableText
              id="home.introText"
              tag="p"
              className="leading-relaxed text-base mb-8"
              defaultValue={content["home.introText"] ?? ""}
            />
          </span>

          <div className="flex gap-3 flex-wrap">
            <Link
              to="/about"
              className="no-underline font-bold text-sm px-6 py-2.5 rounded-xl text-white"
              style={{
                background: "var(--color-primary)",
                boxShadow: "0 2px 12px rgba(30,58,95,0.25)",
              }}
            >
              <EditableText
                id="home.readMore"
                defaultValue="Read More"
                className="font-bold text-sm"
              />
            </Link>
            <Link
              to="/collaborators"
              className="no-underline font-bold text-sm px-6 py-2.5 rounded-xl border-2"
              style={{
                color: isDarkTheme
                  ? sectionTextPrimary
                  : "var(--color-primary)",
                borderColor: isDarkTheme
                  ? "rgba(148,163,184,0.45)"
                  : "var(--color-primary)",
                background: isDarkTheme ? "rgba(15,23,42,0.4)" : "transparent",
              }}
            >
              <EditableText
                id="home.meetTheTeam"
                defaultValue="Meet the Team"
                className="font-bold text-sm"
              />
            </Link>
            <Link
              to="/publications"
              className="no-underline font-bold text-sm px-6 py-2.5 rounded-xl"
              style={{ color: "var(--color-secondary)", background: "#eff6ff" }}
            >
              <EditableText
                id="home.publicationsCta"
                defaultValue="Publications →"
                className="font-bold text-sm"
              />
            </Link>
          </div>
        </div>

        {/* Announcements */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-1 h-8 rounded-full"
              style={{ background: "var(--color-secondary)" }}
            />
            <span
              style={{
                color: sectionTextPrimary,
                fontFamily: "var(--font-heading)",
              }}
            >
              <EditableText
                id="home.announcementsTitle"
                tag="h2"
                className="font-black text-xl"
                defaultValue={
                  content["home.announcementsTitle"] ?? "Latest Updates"
                }
              />
            </span>
          </div>
          <div
            className="w-12 h-0.5 ml-4 mb-6 rounded"
            style={{ background: "var(--color-secondary)", opacity: 0.3 }}
          />

          <div className="flex flex-col gap-3">
            {announcements.length === 0 ? (
              <div
                className="text-center py-8 rounded-xl border-2 border-dashed"
                style={{ borderColor: sectionCardBorder }}
              >
                <p className="text-sm" style={{ color: sectionTextMuted }}>
                  <EditableText
                    id="home.noAnnouncements"
                    defaultValue="No announcements yet."
                    className="text-sm"
                  />
                </p>
              </div>
            ) : (
              announcements.map((a, idx) => (
                <div
                  key={a.id}
                  className="rounded-xl p-4"
                  style={{
                    background: sectionCardBg,
                    border: `1px solid ${sectionCardBorder}`,
                    borderLeft: "3px solid var(--color-accent)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateX(0)" : "translateX(16px)",
                    transition: `opacity 0.5s ease ${0.1 + idx * 0.08}s, transform 0.5s ease ${0.1 + idx * 0.08}s`,
                  }}
                >
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: sectionTextSecondary }}
                  >
                    {a.content}
                  </p>
                  <p
                    className="text-xs mt-2 font-medium"
                    style={{ color: sectionTextMuted }}
                  >
                    {new Date(a.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          QUICK LINKS STRIP
      ══════════════════════════════════════════════════════════ */}
      <div
        className="border-t border-b"
        style={{ borderColor: stripBorder, background: stripBg }}
      >
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              to: "/collaborators",
              icon: "handshake" as AppIconName,
              title: "Collaborators",
              desc: "Meet the researchers behind our work.",
              color: "var(--color-primary)",
            },
            {
              to: "/publications",
              icon: "publications" as AppIconName,
              title: "Publications",
              desc: "Explore our published and ongoing research.",
              color: "var(--color-secondary)",
            },
            {
              to: "/research-ideas",
              icon: "ideas" as AppIconName,
              title: "Research Ideas",
              desc: "Discover open research questions and collaborate.",
              color: "#f59e0b",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="no-underline group flex items-start gap-4 p-5 rounded-2xl border transition-all"
              style={{ borderColor: stripBorder }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = item.color;
                (e.currentTarget as HTMLElement).style.boxShadow =
                  `0 4px 20px rgba(0,0,0,0.07)`;
                (e.currentTarget as HTMLElement).style.transform =
                  "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  stripBorder;
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
                (e.currentTarget as HTMLElement).style.transform =
                  "translateY(0)";
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${item.color}15` }}
              >
                <AppIcon name={item.icon} size={20} />
              </div>
              <div>
                <p className="font-black text-sm" style={{ color: item.color }}>
                  {item.title}
                </p>
                <p
                  className="text-xs mt-0.5 leading-relaxed"
                  style={{ color: sectionTextMuted }}
                >
                  {item.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ── ADDED: TEAM + GALLERY COMBINED SECTION ──
          Two equal columns side by side.
          Left = one collaborator at a time. Right = gallery slideshow.
          Remove this entire block if not needed.
      ══════════════════════════════════════════════════════════ */}
      {(collaborators.length > 0 || gallery.length > 0) && (
        <TeamAndGallery
          collaborators={collaborators}
          gallery={gallery}
          isDarkTheme={isDarkTheme}
        />
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// ── ADDED: TEAM + GALLERY — SINGLE COMBINED SECTION ──
// Two equal columns: left = one collaborator at a time,
// right = gallery slideshow. Both same height, same card style.
// Remove this entire block if not needed.
// ══════════════════════════════════════════════════════════════
const TeamAndGallery: React.FC<{
  collaborators: any[];
  gallery: any[];
  isDarkTheme: boolean;
}> = ({ collaborators, gallery, isDarkTheme }) => {
  // ── Collaborator state ──
  const [collabIdx, setCollabIdx] = useState(0);
  const collabTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetCollabTimer = () => {
    if (collabTimer.current) clearInterval(collabTimer.current);
    if (collaborators.length < 2) return;
    collabTimer.current = setInterval(() => {
      setCollabIdx((c) => (c + 1) % collaborators.length);
    }, 3500);
  };

  useEffect(() => {
    resetCollabTimer();
    return () => {
      if (collabTimer.current) clearInterval(collabTimer.current);
    };
  }, [collaborators.length]);

  const prevCollab = () => {
    setCollabIdx((c) => (c - 1 + collaborators.length) % collaborators.length);
    resetCollabTimer();
  };
  const nextCollab = () => {
    setCollabIdx((c) => (c + 1) % collaborators.length);
    resetCollabTimer();
  };

  // ── Gallery state ──
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [imgErr, setImgErr] = useState<Record<number, boolean>>({});
  const galleryTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetGalleryTimer = () => {
    if (galleryTimer.current) clearInterval(galleryTimer.current);
    if (gallery.length < 2) return;
    galleryTimer.current = setInterval(() => {
      setGalleryIdx((c) => (c + 1) % gallery.length);
    }, 5000);
  };

  useEffect(() => {
    resetGalleryTimer();
    return () => {
      if (galleryTimer.current) clearInterval(galleryTimer.current);
    };
  }, [gallery.length]);

  const prevGallery = () => {
    setGalleryIdx((c) => (c - 1 + gallery.length) % gallery.length);
    resetGalleryTimer();
  };
  const nextGallery = () => {
    setGalleryIdx((c) => (c + 1) % gallery.length);
    resetGalleryTimer();
  };

  const collab = collaborators[collabIdx];
  const galleryItem = gallery[galleryIdx];

  const headingText = isDarkTheme ? "#e5e7eb" : "var(--color-primary)";
  const softText = isDarkTheme ? "#cbd5e1" : "#6b7280";
  const mutedText = isDarkTheme ? "#94a3b8" : "#9ca3af";
  const sectionBorder = isDarkTheme ? "rgba(148,163,184,0.2)" : "#f0f0f0";
  const cardBg = isDarkTheme
    ? "linear-gradient(160deg, rgba(15,23,42,0.95) 60%, rgba(17,24,39,0.95) 100%)"
    : "linear-gradient(160deg, rgba(255,255,255,0.97) 60%, rgba(235,240,255,0.95) 100%)";

  // Shared card height so both columns are equal
  const CARD_HEIGHT = 420;

  return (
    <section
      style={{
        background: "var(--color-bg)",
        borderTop: `1px solid ${sectionBorder}`,
      }}
      className="py-16 px-6"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section heading row */}
        <div className="flex items-center gap-3 mb-10">
          <div
            className="w-1 h-8 rounded-full"
            style={{
              background:
                "linear-gradient(180deg, var(--color-accent), var(--color-secondary))",
            }}
          />
          <div>
            <h2
              className="font-black text-2xl"
              style={{
                color: headingText,
                fontFamily: "var(--font-heading)",
              }}
            >
              <EditableText
                id="home.teamGalleryHeader"
                tag="span"
                defaultValue="Our Team & Gallery"
                className="inline"
              />
            </h2>
            <div
              className="h-0.5 mt-1 rounded-full"
              style={{
                width: "60%",
                background:
                  "linear-gradient(90deg, var(--color-accent), var(--color-navbar), transparent)",
              }}
            />
          </div>
        </div>

        {/* Two equal columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── LEFT: Collaborator card ── */}
          {collaborators.length > 0 && (
            <div className="flex flex-col">
              {/* Sub-header */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold" style={{ color: headingText }}>
                  <EditableText
                    id="home.ourCollaboratorsHeader"
                    defaultValue="✦ Our Collaborators"
                    className="text-sm font-bold"
                  />
                </p>
                <div className="flex gap-2">
                  {[prevCollab, nextCollab].map((fn, i) => (
                    <button
                      key={i}
                      onClick={fn}
                      disabled={collaborators.length < 2}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold cursor-pointer transition-all"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--color-accent), var(--color-navbar))",
                        color: "white",
                        border: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      }}
                      aria-label={
                        i === 0 ? "Previous collaborator" : "Next collaborator"
                      }
                    >
                      {i === 0 ? "‹" : "›"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rotating gradient border wrapper */}
              <div
                className="rotating-border"
                style={{
                  borderRadius: "1.25rem",
                  padding: "3px",
                  height: CARD_HEIGHT,
                }}
              >
                <Link
                  to="/collaborators"
                  className="no-underline flex flex-col items-center justify-center text-center"
                  style={{
                    borderRadius: "calc(1.25rem - 3px)",
                    height: "100%",
                    overflow: "hidden",
                    transition: "transform 0.3s, box-shadow 0.3s",
                    background: cardBg,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
                    backdropFilter: "blur(8px)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform =
                      "translateY(-3px)";
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 16px 40px rgba(0,0,0,0.13)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform =
                      "translateY(0)";
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 4px 24px rgba(0,0,0,0.07)";
                  }}
                >
                  {/* Accent top bar */}
                  <div
                    className="w-full h-1.5"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--color-accent), var(--color-primary))",
                      flexShrink: 0,
                    }}
                  />

                  <div className="flex flex-col items-center justify-center flex-1 px-8 py-8">
                    {/* Avatar with glow ring */}
                    <div
                      style={{
                        borderRadius: "8%",
                        padding: "3px",
                        display: "inline-block",
                        background:
                          "linear-gradient(135deg, var(--color-accent), var(--color-navbar))",
                        boxShadow:
                          "0 0 24px rgba(99,102,241,0.25), 0 0 48px rgba(99,102,241,0.1)",
                      }}
                    >
                      <div
                        style={{
                          borderRadius: "8%",
                          overflow: "hidden",
                          lineHeight: 0,
                        }}
                      >
                        <CollabAvatar
                          photo={collab.photo}
                          name={collab.name}
                          size={200}
                        />
                      </div>
                    </div>

                    <h3
                      className="font-black text-xl mt-5 leading-tight"
                      style={{ color: headingText }}
                    >
                      {collab.name}
                    </h3>

                    {collab.designation && (
                      <p
                        className="text-sm font-semibold mt-2 px-4 py-1 rounded-full"
                        style={{
                          color: "white",
                          background:
                            "linear-gradient(90deg, var(--color-accent), var(--color-navbar))",
                          boxShadow: "0 2px 10px rgba(99,102,241,0.3)",
                        }}
                      >
                        {collab.designation}
                      </p>
                    )}

                    {collab.affiliation && (
                      <p
                        className="text-sm mt-2 font-medium inline-flex items-center gap-1.5"
                        style={{ color: mutedText }}
                      >
                        <AppIcon name="building" size={14} />{" "}
                        {collab.affiliation}
                      </p>
                    )}

                    {collab.shortBio && (
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
                        {collab.shortBio}
                      </p>
                    )}

                    {/* Pagination pill */}
                    <div
                      className="mt-5 px-4 py-1 rounded-full text-xs font-bold"
                      style={{
                        background: "rgba(99,102,241,0.08)",
                        color: "var(--color-accent)",
                        border: "1px solid rgba(99,102,241,0.2)",
                      }}
                    >
                      {collabIdx + 1} / {collaborators.length}
                    </div>
                  </div>
                </Link>
              </div>

              {/* View all link */}
              <div className="text-center mt-3">
                <Link
                  to="/collaborators"
                  className="no-underline text-xs font-bold px-4 py-1.5 rounded-full transition-all"
                  style={{
                    color: "var(--color-secondary)",
                    border: "1px solid var(--color-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--color-secondary)";
                    (e.currentTarget as HTMLElement).style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--color-secondary)";
                  }}
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

          {/* ── RIGHT: Gallery slideshow ── */}
          {gallery.length > 0 && (
            <div className="flex flex-col">
              {/* Sub-header */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold" style={{ color: headingText }}>
                  <EditableText
                    id="home.galleryHeader"
                    defaultValue="✦ Gallery"
                    className="text-sm font-bold"
                  />
                </p>
                <div className="flex items-center gap-2">
                  {[prevGallery, nextGallery].map((fn, i) => (
                    <button
                      key={i}
                      onClick={fn}
                      disabled={gallery.length < 2}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold cursor-pointer"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--color-accent), var(--color-navbar))",
                        color: "white",
                        border: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      }}
                      aria-label={i === 0 ? "Previous image" : "Next image"}
                    >
                      {i === 0 ? "‹" : "›"}
                    </button>
                  ))}
                  <Link
                    to="/gallery"
                    className="no-underline text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-accent), var(--color-navbar))",
                      color: "white",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    <EditableText
                      id="home.galleryAllCta"
                      defaultValue="All →"
                      className="text-xs font-bold"
                    />
                  </Link>
                </div>
              </div>

              {/* Rotating gradient border wrapper */}
              <div
                className="rotating-border"
                style={{
                  borderRadius: "1.25rem",
                  padding: "3px",
                  height: CARD_HEIGHT,
                }}
              >
                {/* Inner container — must be relative for absolute children */}
                <div
                  className="relative w-full h-full overflow-hidden"
                  style={{ borderRadius: "calc(1.25rem - 3px)" }}
                >
                  {/* Image with Ken Burns zoom */}
                  {galleryItem.imageUrl && !imgErr[galleryIdx] ? (
                    <img
                      key={galleryIdx}
                      src={galleryItem.imageUrl}
                      alt={galleryItem.title}
                      onError={() =>
                        setImgErr((e) => ({ ...e, [galleryIdx]: true }))
                      }
                      className="ken-burns w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: "#f3f4f6" }}
                    >
                      <AppIcon name="gallery" size={42} />
                    </div>
                  )}

                  {/* Dark gradient overlay */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
                      zIndex: 1,
                    }}
                  />

                  {/* Top gradient for badge readability */}
                  <div
                    className="absolute inset-x-0 top-0"
                    style={{
                      height: "80px",
                      background:
                        "linear-gradient(to bottom, rgba(0,0,0,0.35), transparent)",
                      zIndex: 1,
                    }}
                  />

                  {/* Caption — glassmorphism */}
                  <div
                    className="absolute bottom-0 left-0 right-0 px-6 pb-5 pt-8"
                    style={{ zIndex: 2 }}
                  >
                    <h3 className="text-white font-black text-lg leading-tight mb-1 drop-shadow">
                      {galleryItem.title}
                    </h3>
                    {galleryItem.description && (
                      <p
                        className="text-xs mt-1"
                        style={{
                          color: "rgba(255,255,255,0.75)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {galleryItem.description}
                      </p>
                    )}
                  </div>

                  {/* Counter badge */}
                  <div
                    className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-accent), var(--color-secondary))",
                      color: "white",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                      zIndex: 2,
                    }}
                  >
                    {galleryIdx + 1} / {gallery.length}
                  </div>
                </div>
              </div>

              {/* Dot indicators */}
              {gallery.length <= 20 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {gallery.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setGalleryIdx(i);
                        resetGalleryTimer();
                      }}
                      className="rounded-full border-none cursor-pointer transition-all"
                      style={{
                        width: i === galleryIdx ? 24 : 8,
                        height: 8,
                        background:
                          i === galleryIdx
                            ? "linear-gradient(90deg, var(--color-accent), var(--color-secondary))"
                            : "#d1d5db",
                        padding: 0,
                        boxShadow:
                          i === galleryIdx
                            ? "0 0 8px rgba(99,102,241,0.5)"
                            : "none",
                      }}
                      aria-label={`Go to image ${i + 1}`}
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

// ── ADDED: Small avatar helper used inside TeamAndGallery ──
const CollabAvatar: React.FC<{
  photo: string;
  name: string;
  size: number;
}> = ({ photo, name, size }) => {
  const [err, setErr] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (photo && !err) {
    return (
      <img
        src={photo}
        alt={name}
        onError={() => setErr(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "8%",
          objectFit: "cover",
          border: "1px solid #f0f0f0",
        }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center text-white font-black"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--color-secondary)",
        fontSize: size * 0.3,
      }}
    >
      {initials}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// LAB HEAD AVATAR
// ══════════════════════════════════════════════════════════════
const LabHeadAvatar: React.FC<{
  photo: string;
  name: string;
  size: number;
  rounded?: "full" | "xl";
}> = ({ photo, name, size, rounded = "full" }) => {
  const [err, setErr] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const borderRadius = rounded === "full" ? "50%" : "16px";

  if (photo && !err) {
    return (
      <img
        src={photo}
        alt={name}
        onError={() => setErr(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "5%",
          objectFit: "cover",
          border: "1px solid var(--color-primary, --color-secondary)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center text-white font-black"
      style={{
        width: size,
        height: size,
        borderRadius,
        background: "var(--color-secondary)",
        fontSize: size * 0.3,
        border: "3px solid rgba(255,255,255,0.3)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      {initials}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// LAB HEAD MODAL
// ══════════════════════════════════════════════════════════════
const LabHeadModal: React.FC<{
  labHead: LabHeadData;
  isDarkTheme: boolean;
  onClose: () => void;
}> = ({ labHead, isDarkTheme, onClose }) => {
  const interests = labHead.researchInterests
    ? labHead.researchInterests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const links = [
    { href: labHead.linkedin, label: "LinkedIn", color: "#ffffff" },
    { href: labHead.scholar, label: "Google Scholar", color: "#ffffff" },
    { href: labHead.orcid, label: "ORCID", color: "#ffffff" },
    { href: labHead.researchgate, label: "ResearchGate", color: "#ffffff" },
  ].filter((l) => l.href);

  const modalSurface = isDarkTheme ? "#0f172a" : "#ffffff";
  const modalBodyBorder = isDarkTheme ? "rgba(148,163,184,0.2)" : "#f3f4f6";
  const softPanelBg = isDarkTheme ? "rgba(15,23,42,0.65)" : "#f9fafb";
  const softPanelBorder = isDarkTheme ? "rgba(148,163,184,0.2)" : "#f0f0f0";
  const softHeading = isDarkTheme ? "#cbd5e1" : "#9ca3af";
  const softText = isDarkTheme ? "#e2e8f0" : "#4b5563";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-3xl w-full max-w-5xl my-8 overflow-hidden shadow-2xl"
        style={{
          background: modalSurface,
          boxShadow: "0 40px 80px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="relative"
          style={{ background: "var(--color-primary)" }}
        >
          {/* Decorative dots */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          {/* Accent bar */}
          <div
            className="h-1 w-full"
            style={{
              background:
                "linear-gradient(90deg, var(--color-accent), var(--color-secondary), var(--color-accent))",
            }}
          />

          {/* Close button */}
          <div className="flex justify-end px-5 pt-4 relative z-10">
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full text-white text-lg font-bold"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              ×
            </button>
          </div>

          {/* ===== SPLIT HEADER ===== */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-0 px-20 pb-10">
            {/* LEFT: PROFILE */}

            <div className="md:col-span-1 flex flex-col items-center text-center pt-4">
              {/* ROTATING BORDER WRAPPER */}
              <div
                className="rotating-border"
                style={{
                  borderRadius: "1.25rem",
                  padding: "4px",
                }}
              >
                {/* INNER CONTAINER (clips properly) */}
                <div
                  style={{
                    borderRadius: "1.1rem",
                    overflow: "hidden",
                    filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))",
                  }}
                >
                  <LabHeadAvatar
                    photo={labHead.photo}
                    name={labHead.name}
                    size={220}
                    rounded="xl"
                  />
                </div>
              </div>

              <div
                className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  background: "rgba(245,158,11,0.2)",
                  color: "var(--color-accent)",
                }}
              >
                ● Lab Director
              </div>

              <h2 className="text-white font-black text-xl mt-3 leading-tight">
                {labHead.name}
              </h2>

              {labHead.title && (
                <p className="text-sm mt-1 font-semibold text-white/80">
                  {labHead.title}
                </p>
              )}

              {labHead.department && (
                <p className="text-xs mt-1 text-white/60">
                  {labHead.department}
                </p>
              )}
            </div>

            {/* RIGHT: ABOUT */}
            <div className="md:col-span-2 mt-6 md:mt-0 md:pl-8">
              {(labHead.fullBio || labHead.shortBio) && (
                <div
                  className="bg-white/10 rounded-2xl p-5 backdrop-blur-sm"
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <h3 className="font-black text-xs text-white/60 uppercase tracking-widest mb-3">
                    About
                  </h3>
                  <p className="text-white text-sm leading-relaxed whitespace-pre-line">
                    {labHead.fullBio || labHead.shortBio}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div
          className="p-7 flex flex-col gap-6 border-t"
          style={{ borderColor: modalBodyBorder }}
        >
          {/* Research Interests */}
          {interests.length > 0 && (
            <div>
              <h3
                className="font-black text-xs uppercase tracking-widest mb-3"
                style={{ color: softHeading }}
              >
                Research Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {interests.map((r) => (
                  <span
                    key={r}
                    className="text-xs px-3 py-1.5 rounded-full font-semibold"
                    style={{
                      background: "var(--color-primary)",
                      color: "white",
                      opacity: 0.85,
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contact + Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {(labHead.email || labHead.phone) && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: softPanelBg,
                  border: `1px solid ${softPanelBorder}`,
                }}
              >
                <h3
                  className="font-black text-xs uppercase tracking-widest mb-3"
                  style={{ color: softHeading }}
                >
                  Contact
                </h3>
                <div className="flex flex-col gap-2">
                  {labHead.email && (
                    <a
                      href={`mailto:${labHead.email}`}
                      className="text-xs font-semibold flex items-center gap-2"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      <AppIcon name="contact" size={13} /> {labHead.email}
                    </a>
                  )}
                  {labHead.phone && (
                    <p
                      className="text-xs inline-flex items-center gap-1.5"
                      style={{ color: softText }}
                    >
                      <AppIcon name="phone" size={13} /> {labHead.phone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {links.length > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: softPanelBg,
                  border: `1px solid ${softPanelBorder}`,
                }}
              >
                <h3
                  className="font-black text-xs uppercase tracking-widest mb-3"
                  style={{ color: softHeading }}
                >
                  Academic Profiles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {links.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg text-white font-bold"
                      style={{ background: l.color }}
                    >
                      {l.label} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full text-sm font-black py-3 rounded-xl text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
              boxShadow: "0 4px 16px rgba(30,58,95,0.3)",
            }}
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
