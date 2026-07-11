import React from "react";
import { Link } from "react-router-dom";
import AppIcon from "../components/AppIcon";
import LabHeadCustomSections from "../components/LabHeadCustomSections";
import EditableText from "../components/EditableText";
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

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return { r: 255, g: 255, b: 255 };
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
};

const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const LabHeadAvatar: React.FC<{
  photo: string;
  name: string;
  size: number;
}> = ({ photo, name, size }) => {
  const [err, setErr] = React.useState(false);
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
          borderRadius: 20,
          objectFit: "cover",
          border:
            "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
          boxShadow:
            "0 12px 34px color-mix(in srgb, var(--color-primary) 18%, transparent)",
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
        borderRadius: 20,
        background:
          "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
        fontSize: size * 0.28,
        border:
          "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
        boxShadow:
          "0 12px 34px color-mix(in srgb, var(--color-primary) 18%, transparent)",
      }}
    >
      {initials}
    </div>
  );
};

const LabHead: React.FC = () => {
  const { content, loading } = useSiteContent();
  const { collaborators, loading: collaboratorsLoading } = useCollaborators();
  const { theme } = useThemeContext();

  const isDarkTheme = React.useMemo(() => {
    const clean = (theme.backgroundColor ?? "").replace("#", "").trim();
    if (clean.length !== 6) return false;
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance < 140;
  }, [theme.backgroundColor]);

  const labHeadUid = content["labhead.profileUid"] || String(import.meta.env.VITE_LAB_HEAD_UID || "");
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
    researchInterests: canonicalProfile?.researchInterests?.join(", ") || content["labhead.researchInterests"] || "",
  };

  const interests = labHead.researchInterests
    ? labHead.researchInterests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const links = [
    {
      href: labHead.linkedin,
      label: "LinkedIn",
      icon: "linkedin" as const,
    },
    {
      href: labHead.scholar,
      label: "Google Scholar",
      icon: "scholar" as const,
    },
    {
      href: labHead.orcid,
      label: "ORCID",
      icon: "orcid" as const,
    },
    {
      href: labHead.researchgate,
      label: "ResearchGate",
      icon: "researchgate" as const,
    },
  ].filter((l) => l.href);

  const softText = withAlpha(theme.primaryColor, isDarkTheme ? 0.82 : 0.76);
  const softMuted = withAlpha(theme.secondaryColor, isDarkTheme ? 0.72 : 0.62);
  const sectionTextPrimary = theme.primaryColor;
  const sectionTextSecondary = withAlpha(
    theme.primaryColor,
    isDarkTheme ? 0.82 : 0.74,
  );
  const sectionTextMuted = withAlpha(
    theme.secondaryColor,
    isDarkTheme ? 0.72 : 0.62,
  );
  const sectionCardBg = withAlpha(
    theme.backgroundColor,
    isDarkTheme ? 0.72 : 1,
  );
  const sectionCardBorder = withAlpha(
    theme.primaryColor,
    isDarkTheme ? 0.18 : 0.12,
  );
  const stripBg = withAlpha(theme.secondaryColor, isDarkTheme ? 0.08 : 0.06);
  const stripBorder = withAlpha(theme.primaryColor, isDarkTheme ? 0.18 : 0.12);
  const pageBg = theme.backgroundColor;
  const mainSectionBg = withAlpha(
    theme.primaryColor,
    isDarkTheme ? 0.08 : 0.04,
  );
  const bioSectionBg = withAlpha(
    theme.secondaryColor,
    isDarkTheme ? 0.1 : 0.06,
  );
  const interestSectionBg = withAlpha(
    theme.accentColor,
    isDarkTheme ? 0.08 : 0.05,
  );
  const borderColor = withAlpha(theme.primaryColor, isDarkTheme ? 0.28 : 0.22);
  const headerGradient = `linear-gradient(130deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 70%)`;
  const sectionDividerColor = withAlpha(
    theme.primaryColor,
    isDarkTheme ? 0.18 : 0.12,
  );

  if (loading || collaboratorsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{
            borderColor: "var(--color-primary)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  if (!labHead.name) {
    return (
      <div className="min-h-[70vh]" style={{ background: pageBg }}>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div
            className="rounded-3xl border p-10 text-center"
            style={{
              borderColor,
              background: withAlpha(
                theme.backgroundColor,
                isDarkTheme ? 0.8 : 1,
              ),
              boxShadow: `0 20px 50px ${withAlpha(theme.primaryColor, 0.08)}`,
            }}
          >
            <div
              className="inline-flex mb-4 p-3 rounded-2xl"
              style={{ background: withAlpha(theme.primaryColor, 0.12) }}
            >
              <AppIcon
                name="admin"
                size={24}
                style={{ color: theme.primaryColor }}
              />
            </div>
            <h1
              className="text-3xl font-black"
              style={{
                color: theme.primaryColor,
                fontFamily: "var(--font-heading)",
              }}
            >
              Lab Head Profile
            </h1>
            <p className="text-sm mt-3" style={{ color: softMuted }}>
              No lab head profile has been published yet. Update it from the
              admin Content Editor under the Lab Head tab.
            </p>
            <Link
              to="/"
              className="inline-flex mt-5 rounded-full px-5 py-2.5 text-sm font-bold no-underline"
              style={{
                background: theme.primaryColor,
                color: theme.backgroundColor,
              }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: pageBg }}>
      <section
        className="relative min-h-[320px] overflow-hidden py-20 text-center px-4 flex items-center justify-center"
        style={{ background: headerGradient }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle, ${withAlpha(theme.backgroundColor, 0.6)} 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{
            background: "var(--color-accent)",
            transform: "translate(30%, 40%)",
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border"
            style={{
              borderColor: withAlpha(theme.backgroundColor, 0.2),
              background: withAlpha(theme.backgroundColor, 0.08),
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--color-accent)" }}
            />
            <span
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: withAlpha(theme.backgroundColor, 0.7) }}
            >
              Leadership Profile
            </span>
          </div>
          <h1
            className="font-black text-white mb-4"
            style={{
              fontSize: "clamp(2.2rem, 4.5vw, 3.5rem)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "-1px",
            }}
          >
            <EditableText
              id="labhead.heroTitle"
              defaultValue="Meet the Lab Head"
              className="inline"
            />
          </h1>
          <div
            className="mx-auto mb-5 h-1 w-16 rounded-full"
            style={{ background: "var(--color-accent)" }}
          />
          <p
            className="text-base max-w-2xl mx-auto leading-relaxed"
            style={{ color: withAlpha(theme.backgroundColor, 0.78) }}
          >
            <EditableText
              id="labhead.heroSubtitle"
              defaultValue="Research direction, academic profile, and contact information."
              className="inline"
            />
          </p>
        </div>
      </section>

      <section
        className="py-16 px-4 border-b"
        style={{ background: mainSectionBg, borderColor: sectionDividerColor }}
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-1 h-8 rounded-full"
                style={{ background: "var(--color-accent)" }}
              />
              <h2
                className="font-black text-2xl"
                style={{
                  color: sectionTextPrimary,
                  fontFamily: "var(--font-heading)",
                }}
              >
                <EditableText
                  id="labhead.aboutTitle"
                  defaultValue="About the Lab Head"
                  className="inline"
                />
              </h2>
            </div>
            <div
              className="w-16 h-0.5 ml-4 mb-7 rounded"
              style={{ background: "var(--color-accent)", opacity: 0.4 }}
            />

            <div className="flex flex-col items-center gap-6 mb-6 sm:flex-row sm:items-start sm:gap-8">
              <LabHeadAvatar
                photo={labHead.photo}
                name={labHead.name}
                size={200}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs uppercase tracking-[0.18em] font-black mb-2"
                  style={{ color: sectionTextMuted }}
                >
                  <EditableText
                    id="labhead.roleLabel"
                    defaultValue="Lab Head"
                    className="inline"
                  />
                </p>
                <h3
                  className="font-black text-2xl"
                  style={{
                    color: sectionTextPrimary,
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  <EditableText
                    id="labhead.name"
                    defaultValue={labHead.name}
                    className="inline"
                  />
                </h3>
                <div className="mt-2 space-y-1">
                  {labHead.title && (
                    <p
                      className="text-sm font-semibold"
                      style={{ color: sectionTextSecondary }}
                    >
                      <EditableText
                        id="labhead.title"
                        defaultValue={labHead.title}
                        className="inline"
                      />
                    </p>
                  )}
                  {labHead.department && (
                    <p className="text-sm" style={{ color: sectionTextMuted }}>
                      <EditableText
                        id="labhead.department"
                        defaultValue={labHead.department}
                        className="inline"
                      />
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-1 h-8 rounded-full"
                style={{ background: "var(--color-secondary)" }}
              />
              <h2
                className="font-black text-xl"
                style={{
                  color: sectionTextPrimary,
                  fontFamily: "var(--font-heading)",
                }}
              >
                <EditableText
                  id="labhead.linksTitle"
                  defaultValue="Academic Profiles"
                  className="inline"
                />
              </h2>
            </div>
            <div
              className="w-12 h-0.5 ml-4 mb-6 rounded"
              style={{ background: "var(--color-secondary)", opacity: 0.3 }}
            />
            <div className="flex flex-wrap gap-2">
              {links.length === 0 ? (
                <div
                  className="text-center py-4 rounded-lg border-2 border-dashed w-full"
                  style={{ borderColor: sectionCardBorder }}
                >
                  <p className="text-xs" style={{ color: sectionTextMuted }}>
                    <EditableText
                      id="labhead.noLinksText"
                      defaultValue="No profile links yet."
                      className="inline"
                    />
                  </p>
                </div>
              ) : (
                links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    title={link.label}
                    className="no-underline rounded-lg flex items-center justify-center transition-all"
                    style={{
                      width: 38,
                      height: 38,
                      background: "#ffffff",
                      border: "1px solid #111827",
                      color: "#111827",
                      boxShadow: `0 2px 10px ${withAlpha(theme.primaryColor, 0.05)}`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-2px)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 4px 12px rgba(17,24,39,0.25)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        `0 2px 10px ${withAlpha(theme.primaryColor, 0.05)}`;
                    }}
                  >
                    <AppIcon name={link.icon} size={16} />
                  </a>
                ))
              )}
            </div>

            {(labHead.email || labHead.phone) && (
              <div
                className="mt-6 pt-4 border-t space-y-2"
                style={{ borderColor: sectionDividerColor }}
              >
                <h3
                  className="text-xs uppercase tracking-[0.18em] font-black"
                  style={{ color: sectionTextMuted }}
                >
                  <EditableText
                    id="labhead.contactInfoLabel"
                    defaultValue="Contact Info"
                    className="inline"
                  />
                </h3>
                {labHead.email && (
                  <p
                    className="text-sm"
                    style={{ color: sectionTextSecondary }}
                  >
                    <span className="font-semibold">
                      <EditableText
                        id="labhead.emailLabel"
                        defaultValue="Email:"
                        className="inline"
                      />
                    </span>{" "}
                    <a href={`mailto:${labHead.email}`} className="font-semibold no-underline hover:underline" style={{ color: sectionTextSecondary }}>{labHead.email}</a>
                  </p>
                )}
                {labHead.phone && (
                  <p
                    className="text-sm"
                    style={{ color: sectionTextSecondary }}
                  >
                    <span className="font-semibold">
                      <EditableText
                        id="labhead.phoneLabel"
                        defaultValue="Phone:"
                        className="inline"
                      />
                    </span>{" "}
                    <a href={`tel:${labHead.phone}`} className="font-semibold no-underline hover:underline" style={{ color: sectionTextSecondary }}>{labHead.phone}</a>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        className="py-12 px-4 border-y"
        style={{ background: bioSectionBg, borderColor: sectionDividerColor }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-1 h-8 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
            <div>
              <h2
                className="font-black text-2xl"
                style={{
                  color: sectionTextPrimary,
                  fontFamily: "var(--font-heading)",
                }}
              >
                <EditableText
                  id="labhead.bioTitle"
                  defaultValue="Biography"
                  wrapperClassName="block"
                />
              </h2>
            </div>
          </div>
          <div>
            <p
              className="leading-relaxed text-base"
              style={{
                whiteSpace: "pre-line",
                lineHeight: 1.85,
                color: sectionTextSecondary,
              }}
            >
              <EditableText
                id="labhead.shortBio"
                defaultValue={labHead.shortBio || labHead.fullBio}
                wrapperClassName="block"
              />
            </p>
            {labHead.fullBio && labHead.fullBio !== labHead.shortBio && (
              <div
                className="mt-8 pt-6 border-t"
                style={{ borderColor: sectionDividerColor }}
              >
                <h3
                  className="font-black text-lg mb-3"
                  style={{
                    color: sectionTextPrimary,
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  <EditableText
                    id="labhead.detailedBioTitle"
                    defaultValue="Detailed Biography"
                    wrapperClassName="block"
                  />
                </h3>
                <p
                  className="leading-relaxed text-base"
                  style={{
                    whiteSpace: "pre-line",
                    lineHeight: 1.9,
                    color: sectionTextSecondary,
                  }}
                >
                  <EditableText
                    id="labhead.fullBio"
                    defaultValue={labHead.fullBio}
                    wrapperClassName="block"
                  />
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        className="py-12 px-4 border-y"
        style={{
          background: interestSectionBg,
          borderColor: sectionDividerColor,
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-1 h-8 rounded-full"
              style={{ background: theme.accentColor }}
            />
            <h2
              className="font-black text-2xl"
              style={{
                color: sectionTextPrimary,
                fontFamily: "var(--font-heading)",
              }}
            >
              <EditableText
                id="labhead.researchInterestsTitle"
                defaultValue="Research Interests"
                className="inline"
              />
            </h2>
          </div>
          <div
            className="w-16 h-0.5 ml-4 mb-7 rounded"
            style={{ background: theme.accentColor, opacity: 0.35 }}
          />
          {interests.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {interests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold"
                  style={{
                    background: sectionCardBg,
                    border: `1px solid ${sectionCardBorder}`,
                    color: sectionTextSecondary,
                    boxShadow: `0 2px 8px ${withAlpha(theme.primaryColor, 0.04)}`,
                  }}
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-base" style={{ color: sectionTextSecondary }}>
              <EditableText
                id="labhead.noResearchInterestsText"
                defaultValue="Research interests are not available yet."
                className="inline"
              />
            </p>
          )}
        </div>
      </section>

      <LabHeadCustomSections />

      <div
        className="border-t border-b"
        style={{ borderColor: stripBorder, background: stripBg }}
      >
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              to: "/lab-head",
              icon: "admin" as const,
              title: "Lab Head",
              desc: "Leadership profile and research direction.",
              color: "var(--color-primary)",
            },
            {
              to: "/about",
              icon: "building" as const,
              title: "About",
              desc: "Learn more about the lab and mission.",
              color: "var(--color-secondary)",
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
              color: "var(--color-accent)",
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
                  `0 4px 20px ${withAlpha(theme.primaryColor, 0.07)}`;
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
                  <EditableText
                    id={`labhead.cardTitle.${item.icon}`}
                    defaultValue={item.title}
                    className="inline"
                  />
                </p>
                <p
                  className="text-xs mt-0.5 leading-relaxed"
                  style={{ color: sectionTextMuted }}
                >
                  <EditableText
                    id={`labhead.cardDesc.${item.icon}`}
                    defaultValue={item.desc}
                    className="inline"
                  />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LabHead;
