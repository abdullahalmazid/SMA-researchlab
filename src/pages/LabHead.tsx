import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppIcon from "../components/AppIcon";
import EditableText from "../components/EditableText";
import LabHeadCustomSections from "../components/LabHeadCustomSections";
import { useThemeContext } from "../context/ThemeContext";
import { useCollaborators, useSiteContent } from "../firebase/hooks";

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

/* ------------------------------------------------------------------ *
 * Colour utilities
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

/** Proper WCAG relative luminance — the raw-channel version misjudges mid greens and blues. */
const relativeLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/* ------------------------------------------------------------------ *
 * Small building blocks
 * ------------------------------------------------------------------ */

/** Fluid rather than a fixed pixel size: ~220px on phones, up to 320px on wide screens. */
const LabHeadAvatar: React.FC<{ photo: string; name: string }> = ({ photo, name }) => {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const shared: React.CSSProperties = {
    width: "clamp(220px, 24vw, 320px)",
    aspectRatio: "1 / 1",
    borderRadius: 28,
    border: "4px solid rgba(255,255,255,0.3)",
    boxShadow: "0 24px 56px rgba(0,0,0,0.28)",
  };

  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        decoding="async"
        onError={() => setFailed(true)}
        style={{ ...shared, objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center font-semibold text-white"
      style={{
        ...shared,
        background: "rgba(255,255,255,0.12)",
        fontSize: "clamp(64px, 7vw, 96px)",
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
};

/**
 * One heading device for the whole page: hairline, small-caps eyebrow, heading.
 * The original used an accent bar plus a second underline rule on every section.
 */
const SectionHeading: React.FC<{
  id: string;
  eyebrow: React.ReactNode;
  tone: { border: string; muted: string };
  as?: "h2" | "h3";
}> = ({ id, eyebrow, tone, as: Tag = "h2" }) => (
  <div className="mb-6">
    <div className="h-px w-10" style={{ background: tone.border }} />
    <Tag
      id={id}
      className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em]"
      style={{ color: tone.muted }}
    >
      {eyebrow}
    </Tag>
  </div>
);

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const LabHead: React.FC = () => {
  const { content, loading } = useSiteContent();
  const { collaborators, loading: collaboratorsLoading } = useCollaborators();
  const { theme } = useThemeContext();

  const tone = useMemo(() => {
    const isDark = relativeLuminance(theme.backgroundColor ?? "#ffffff") < 0.22;
    return {
      isDark,
      page: `color-mix(in srgb, ${theme.primaryColor} ${isDark ? 6 : 4}%, ${theme.backgroundColor})`,
      surface: theme.backgroundColor,
      surfaceMuted: withAlpha(theme.primaryColor, isDark ? 0.1 : 0.05),
      border: withAlpha(theme.primaryColor, isDark ? 0.2 : 0.13),
      borderStrong: withAlpha(theme.primaryColor, isDark ? 0.36 : 0.26),
      heading: theme.primaryColor,
      body: withAlpha(theme.primaryColor, isDark ? 0.86 : 0.8),
      muted: withAlpha(theme.primaryColor, isDark ? 0.66 : 0.6),
      shadow: isDark ? "0 1px 2px rgba(0,0,0,0.4)" : "0 1px 2px rgba(15,23,42,0.05)",
    };
  }, [theme.backgroundColor, theme.primaryColor]);

  const labHeadUid =
    content["labhead.profileUid"] || String(import.meta.env.VITE_LAB_HEAD_UID || "");
  const canonicalProfile = collaborators.find((profile) => profile.uid === labHeadUid);

  const labHead: LabHeadData = {
    name: canonicalProfile?.name || content["labhead.name"] || "",
    title: canonicalProfile?.designation || content["labhead.title"] || "",
    department: canonicalProfile?.affiliation || content["labhead.department"] || "",
    photo: canonicalProfile?.photo || content["labhead.photo"] || "",
    shortBio: canonicalProfile?.bio || content["labhead.shortBio"] || "",
    fullBio: content["labhead.fullBio"] || canonicalProfile?.bio || "",
    email: canonicalProfile?.email || content["labhead.email"] || "",
    phone: content["labhead.phone"] ?? "",
    linkedin: canonicalProfile?.linkedin || content["labhead.linkedin"] || "",
    scholar: canonicalProfile?.scholar || content["labhead.scholar"] || "",
    orcid: canonicalProfile?.orcid || content["labhead.orcid"] || "",
    researchgate: canonicalProfile?.researchgate || content["labhead.researchgate"] || "",
    researchInterests:
      canonicalProfile?.researchInterests?.join(", ") ||
      content["labhead.researchInterests"] ||
      "",
  };

  const interests = labHead.researchInterests
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const links = [
    { href: labHead.linkedin, label: "LinkedIn", icon: "linkedin" as const },
    { href: labHead.scholar, label: "Google Scholar", icon: "scholar" as const },
    { href: labHead.orcid, label: "ORCID", icon: "orcid" as const },
    { href: labHead.researchgate, label: "ResearchGate", icon: "researchgate" as const },
  ].filter((link) => link.href);

  const hasSecondBio = Boolean(labHead.fullBio) && labHead.fullBio !== labHead.shortBio;

  const panelStyle: React.CSSProperties = {
    background: tone.surface,
    border: `1px solid ${tone.border}`,
    boxShadow: tone.shadow,
  };

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--focus-offset)]";

  const focusVars = {
    "--focus-ring": theme.accentColor || theme.secondaryColor,
    "--focus-offset": tone.surface,
  } as React.CSSProperties;

  const heroGradient = `linear-gradient(130deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 70%)`;

  /* ---------------------------------------------------------------- *
   * Loading and empty states
   * ---------------------------------------------------------------- */

  if (loading || collaboratorsLoading) {
    return (
      <main
        className="min-h-screen"
        style={{ background: tone.page }}
        aria-busy="true"
        role="status"
      >
        <span className="sr-only">Loading the lab head profile</span>

        <div
          className="px-4 py-16 motion-safe:animate-pulse md:py-20"
          style={{ background: heroGradient }}
        >
          <div className="mx-auto max-w-6xl">
            <div className="h-3 w-28 rounded-full bg-white/20" />
            <div className="mt-8 flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-12">
              <div
                className="shrink-0 rounded-[28px] bg-white/15"
                style={{ width: "clamp(220px, 24vw, 320px)", aspectRatio: "1 / 1" }}
              />
              <div className="w-full max-w-xl space-y-4">
                <div className="h-6 w-28 rounded-full bg-white/15" />
                <div className="h-10 w-3/4 rounded-lg bg-white/20" />
                <div className="h-4 w-1/2 rounded-full bg-white/15" />
                <div className="h-11 w-40 rounded-xl bg-white/20" />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-72 rounded-[20px] motion-safe:animate-pulse" style={panelStyle} />
          <div className="h-56 rounded-[20px] motion-safe:animate-pulse" style={panelStyle} />
        </div>
      </main>
    );
  }

  if (!labHead.name) {
    return (
      <main
        className="grid min-h-[70vh] place-items-center px-4 py-16"
        style={{ background: tone.page }}
      >
        <div className="max-w-lg rounded-[20px] p-10 text-center" style={panelStyle}>
          <div
            className="mx-auto mb-5 inline-flex rounded-2xl p-3"
            style={{ background: tone.surfaceMuted }}
          >
            <AppIcon name="admin" size={24} style={{ color: theme.primaryColor }} />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: tone.heading, fontFamily: "var(--font-heading)" }}
          >
            Lab Head Profile
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: tone.muted }}>
            No lab head profile has been published yet. Add one from the admin Content Editor
            under the Lab Head tab.
          </p>
          <Link
            to="/"
            style={{ ...focusVars, background: theme.primaryColor, color: theme.backgroundColor }}
            className={`mt-7 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold no-underline transition hover:opacity-90 ${focusRing}`}
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------- *
   * Page
   * ---------------------------------------------------------------- */

  return (
    <main style={{ background: tone.page }}>
      {/* Hero — the person, not the page. Name is the H1 and sits above the fold. */}
      <section
        aria-labelledby="labhead-name"
        className="relative overflow-hidden px-4 py-16 md:py-20"
        style={{ background: heroGradient }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle, ${withAlpha(theme.backgroundColor, 0.7)} 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            <EditableText
              id="labhead.heroTitle"
              defaultValue="Meet the Lab Head"
              className="inline"
            />
          </p>

          <div className="mt-8 flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:gap-12 md:text-left">
            <div className="shrink-0">
              <LabHeadAvatar photo={labHead.photo} name={labHead.name} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: theme.accentColor }}
                />
                <EditableText id="labhead.roleLabel" defaultValue="Lab Head" className="inline" />
              </p>

              <h1
                id="labhead-name"
                className="mt-4 text-[30px] font-bold leading-[1.15] tracking-[-0.02em] text-white md:text-[46px]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <EditableText id="labhead.name" defaultValue={labHead.name} className="inline" />
              </h1>

              {(labHead.title || labHead.department) && (
                <p className="mt-4 text-[15px] leading-7 text-white/85">
                  {labHead.title && (
                    <EditableText
                      id="labhead.title"
                      defaultValue={labHead.title}
                      className="inline"
                    />
                  )}
                  {labHead.title && labHead.department && (
                    <span aria-hidden="true" className="mx-2 text-white/40">
                      /
                    </span>
                  )}
                  {labHead.department && (
                    <EditableText
                      id="labhead.department"
                      defaultValue={labHead.department}
                      className="inline"
                    />
                  )}
                </p>
              )}

              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-white/70">
                <EditableText
                  id="labhead.heroSubtitle"
                  defaultValue="Research direction, academic profile, and contact information."
                  className="inline"
                />
              </p>

              {(labHead.email || labHead.phone) && (
                <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
                  {labHead.email && (
                    <a
                      href={`mailto:${labHead.email}`}
                      style={
                        {
                          "--focus-ring": "#ffffff",
                          "--focus-offset": theme.primaryColor,
                          background: theme.backgroundColor,
                          color: theme.primaryColor,
                        } as React.CSSProperties
                      }
                      className={`inline-flex min-h-[44px] items-center rounded-xl px-5 text-sm font-semibold no-underline shadow-lg transition hover:opacity-90 ${focusRing}`}
                    >
                      Email {labHead.name.split(" ")[0]}
                    </a>
                  )}
                  {labHead.phone && (
                    <a
                      href={`tel:${labHead.phone}`}
                      style={
                        {
                          "--focus-ring": "#ffffff",
                          "--focus-offset": theme.primaryColor,
                        } as React.CSSProperties
                      }
                      className={`inline-flex min-h-[44px] items-center rounded-xl border border-white/35 px-5 text-sm font-semibold text-white no-underline transition hover:border-white/70 hover:bg-white/10 ${focusRing}`}
                    >
                      Call {labHead.phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Body — a single content column plus a record sidebar, on one neutral
          surface. The original stacked four full-bleed tinted bands, which gave
          every section identical weight. */}
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="h-px w-10" style={{ background: tone.border }} />
        <h2
          id="labhead-about"
          className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: tone.muted }}
        >
          <EditableText
            id="labhead.aboutTitle"
            defaultValue="About the Lab Head"
            className="inline"
          />
        </h2>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <section
              aria-labelledby="labhead-bio"
              className="rounded-[20px] p-6 md:p-9"
              style={panelStyle}
            >
              <SectionHeading
                id="labhead-bio"
                tone={tone}
                eyebrow={
                  <EditableText id="labhead.bioTitle" defaultValue="Biography" className="inline" />
                }
              />

              <p
                className="max-w-[68ch] text-[15.5px]"
                style={{ whiteSpace: "pre-line", lineHeight: 1.8, color: tone.body }}
              >
                <EditableText
                  id="labhead.shortBio"
                  defaultValue={labHead.shortBio || labHead.fullBio}
                  wrapperClassName="block"
                />
              </p>

              {hasSecondBio && (
                <div className="mt-8 border-t pt-7" style={{ borderColor: tone.border }}>
                  <h3
                    className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: tone.muted }}
                  >
                    <EditableText
                      id="labhead.detailedBioTitle"
                      defaultValue="Detailed Biography"
                      wrapperClassName="block"
                    />
                  </h3>
                  <p
                    className="mt-5 max-w-[68ch] text-[15.5px]"
                    style={{ whiteSpace: "pre-line", lineHeight: 1.8, color: tone.body }}
                  >
                    <EditableText
                      id="labhead.fullBio"
                      defaultValue={labHead.fullBio}
                      wrapperClassName="block"
                    />
                  </p>
                </div>
              )}
            </section>

            <section
              aria-labelledby="labhead-interests"
              className="rounded-[20px] p-6 md:p-9"
              style={panelStyle}
            >
              <SectionHeading
                id="labhead-interests"
                tone={tone}
                eyebrow={
                  <EditableText
                    id="labhead.researchInterestsTitle"
                    defaultValue="Research Interests"
                    className="inline"
                  />
                }
              />

              {interests.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {interests.map((interest) => (
                    <li
                      key={interest}
                      className="rounded-lg px-3 py-2 text-[13px] font-medium"
                      style={{ background: tone.surfaceMuted, color: tone.body }}
                    >
                      {interest}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[15px]" style={{ color: tone.muted }}>
                  <EditableText
                    id="labhead.noResearchInterestsText"
                    defaultValue="Research interests are not available yet."
                    className="inline"
                  />
                </p>
              )}
            </section>
          </div>

          {/* Record sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
            <section
              aria-labelledby="labhead-links"
              className="rounded-[20px] p-6"
              style={panelStyle}
            >
              <SectionHeading
                id="labhead-links"
                tone={tone}
                eyebrow={
                  <EditableText
                    id="labhead.linksTitle"
                    defaultValue="Academic Profiles"
                    className="inline"
                  />
                }
              />

              {links.length === 0 ? (
                <p className="text-sm" style={{ color: tone.muted }}>
                  <EditableText
                    id="labhead.noLinksText"
                    defaultValue="No profile links yet."
                    className="inline"
                  />
                </p>
              ) : (
                /* Labelled links, not 38px icon-only squares: a title attribute is
                   not a reliable accessible name, and 38px misses the 44px target. */
                <ul className="grid gap-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        style={
                          {
                            ...focusVars,
                            "--hover-border": tone.borderStrong,
                            borderColor: tone.border,
                            color: tone.body,
                          } as React.CSSProperties
                        }
                        className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-3.5 text-sm font-medium no-underline transition hover:border-[color:var(--hover-border)] ${focusRing}`}
                      >
                        <AppIcon name={link.icon} size={16} />
                        <span className="flex-1">{link.label}</span>
                        <span aria-hidden="true" style={{ color: tone.muted }}>
                          ↗
                        </span>
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(labHead.email || labHead.phone) && (
              <section
                aria-labelledby="labhead-contact"
                className="rounded-[20px] p-6"
                style={panelStyle}
              >
                <SectionHeading
                  id="labhead-contact"
                  tone={tone}
                  eyebrow={
                    <EditableText
                      id="labhead.contactInfoLabel"
                      defaultValue="Contact Info"
                      className="inline"
                    />
                  }
                />

                <dl className="grid gap-4">
                  {labHead.email && (
                    <div>
                      <dt
                        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: tone.muted }}
                      >
                        <EditableText
                          id="labhead.emailLabel"
                          defaultValue="Email"
                          className="inline"
                        />
                      </dt>
                      <dd className="mt-1.5 break-all text-sm font-medium">
                        <a
                          href={`mailto:${labHead.email}`}
                          style={{ ...focusVars, color: theme.secondaryColor }}
                          className={`rounded-sm underline decoration-transparent underline-offset-4 transition hover:decoration-current ${focusRing}`}
                        >
                          {labHead.email}
                        </a>
                      </dd>
                    </div>
                  )}

                  {labHead.phone && (
                    <div className="border-t pt-4" style={{ borderColor: tone.border }}>
                      <dt
                        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: tone.muted }}
                      >
                        <EditableText
                          id="labhead.phoneLabel"
                          defaultValue="Phone"
                          className="inline"
                        />
                      </dt>
                      <dd className="mt-1.5 text-sm font-medium">
                        <a
                          href={`tel:${labHead.phone}`}
                          style={{ ...focusVars, color: theme.secondaryColor }}
                          className={`rounded-sm underline decoration-transparent underline-offset-4 transition hover:decoration-current ${focusRing}`}
                        >
                          {labHead.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </aside>
        </div>
      </div>

      <LabHeadCustomSections />

      {/* Onward navigation. The self-link to /lab-head is removed — it pointed at
          the page the reader is already on. */}
      <section
        aria-labelledby="labhead-explore"
        className="border-t px-4 py-14"
        style={{ borderColor: tone.border, background: tone.surfaceMuted }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="h-px w-10" style={{ background: tone.borderStrong }} />
          <h2
            id="labhead-explore"
            className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: tone.muted }}
          >
            Continue exploring
          </h2>

          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                to: "/about",
                icon: "building" as const,
                title: "About",
                desc: "Learn more about the lab and mission.",
                color: theme.secondaryColor,
              },
              {
                to: "/research-ideas",
                icon: "ideas" as const,
                title: "Research Ideas",
                desc: "Discover open questions to collaborate on.",
                color: theme.accentColor,
              },
              {
                to: "/collaborators#collaborator-request",
                icon: "handshake" as const,
                title: "Request Collaboration",
                desc: "Jump directly to the collaborator request form.",
                color: theme.primaryColor,
              },
            ].map((item) => (
              <li key={item.to}>
                {/* Hover is CSS, not onMouseEnter style mutation — so it also
                    responds to keyboard focus and respects reduced motion. */}
                <Link
                  to={item.to}
                  style={
                    {
                      ...focusVars,
                      "--card-accent": item.color,
                      background: tone.surface,
                      borderColor: tone.border,
                      boxShadow: tone.shadow,
                    } as React.CSSProperties
                  }
                  className={`group flex h-full items-start gap-4 rounded-[16px] border p-5 no-underline transition duration-200 hover:border-[color:var(--card-accent)] motion-safe:hover:-translate-y-0.5 ${focusRing}`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: withAlpha(item.color, 0.12), color: item.color }}
                  >
                    <AppIcon name={item.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold" style={{ color: tone.heading }}>
                      <EditableText
                        id={`labhead.cardTitle.${item.icon}`}
                        defaultValue={item.title}
                        className="inline"
                      />
                    </span>
                    <span className="mt-1 block text-xs leading-5" style={{ color: tone.muted }}>
                      <EditableText
                        id={`labhead.cardDesc.${item.icon}`}
                        defaultValue={item.desc}
                        className="inline"
                      />
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-auto self-center text-sm transition-transform motion-safe:group-hover:translate-x-0.5"
                    style={{ color: tone.muted }}
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
};

export default LabHead;
