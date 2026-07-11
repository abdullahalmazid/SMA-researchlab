import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useSiteContent } from "../firebase/hooks";
import AppIcon, { type AppIconName } from "./AppIcon";
import EditableText from "./EditableText";

const Footer: React.FC = () => {
  const { content } = useSiteContent();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  // Added IDs to match Navbar for synchronized editing
  const navLinks = [
    { to: "/", label: "Home", icon: "home" as AppIconName, id: "nav-home" },
    {
      to: "/about",
      label: "About",
      icon: "about" as AppIconName,
      id: "nav-about",
    },
    {
      to: "/collaborators",
      label: "Collaborators",
      icon: "collaborators" as AppIconName,
      id: "nav-collaborators",
    },
    {
      to: "/publications",
      label: "Publications",
      icon: "publications" as AppIconName,
      id: "nav-publications",
    },
    {
      to: "/research-ideas",
      label: "Research Ideas",
      icon: "ideas" as AppIconName,
      id: "nav-research-ideas",
    },
    {
      to: "/gallery",
      label: "Gallery",
      icon: "gallery" as AppIconName,
      id: "nav-gallery",
    },
    {
      to: "/contact",
      label: "Contact",
      icon: "contact" as AppIconName,
      id: "nav-contact",
    },
  ];

  const socialLinks = [
    {
      href: content["labhead.linkedin"],
      label: "LinkedIn",
      icon: "linkedin" as AppIconName,
      color: "#ffffff",
    },
    {
      href: content["labhead.scholar"],
      label: "Scholar",
      icon: "scholar" as AppIconName,
      color: "#ffffff",
    },
    {
      href: content["labhead.orcid"],
      label: "ORCID",
      icon: "orcid" as AppIconName,
      color: "#ffffff",
    },
    {
      href: content["labhead.researchgate"],
      label: "ResearchGate",
      icon: "researchgate" as AppIconName,
      color: "#ffffff",
    },
  ].filter((s) => s.href);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const labHeadName = content["labhead.name"];
  const labHeadTitle = content["labhead.title"];
  const labHeadPhoto = content["labhead.photo"];

  return (
    <footer style={{ background: "var(--color-footer)" }} className="mt-16">
      {/* ── Top accent bar ── */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--color-accent), var(--color-secondary), var(--color-accent))",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* ── Column 1: Branding ── */}
          <div className="md:col-span-4">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-5">
              {content["branding.logoUrl"] ? <img src={content["branding.logoUrl"]} alt="Lab logo" className="h-10 w-10 flex-shrink-0 rounded-xl object-contain" /> : <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-accent), #f97316)",
                  color: "#1f2937",
                  boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
                }}
              >
                R
              </div>}
              <div>
                <div
                  className="font-black text-lg leading-tight"
                  style={{
                    color: "var(--color-accent)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  <EditableText
                    id="footer.brandName"
                    defaultValue={content["branding.labName"] || "Rahman Research Lab"}
                    className="inline"
                  />
                </div>
                <div
                  className="text-xs"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  <EditableText
                    id="footer.institution"
                    defaultValue="Bangladesh University of Engineering and Technology"
                    className="inline"
                  />
                </div>
              </div>
            </div>

            {/* Tagline */}
            <p
              className="text-sm leading-relaxed mb-6"
              style={{
                color: "rgba(255,255,255,0.55)",
                maxWidth: 300,
                lineHeight: 1.75,
              }}
            >
              <EditableText
                id="footer.tagline"
                defaultValue="Advancing the frontiers of artificial intelligence, signal processing, and data science at BUET."
                className="inline"
              />
            </p>

            {/* Lab Head mini card */}
            {labHeadName && (
              <div
                className="flex items-center gap-3 p-3 rounded-2xl mb-5"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {labHeadPhoto ? (
                  <img
                    src={labHeadPhoto}
                    alt={labHeadName}
                    className="rounded-xl object-cover flex-shrink-0"
                    style={{ width: 44, height: 44 }}
                  />
                ) : (
                  <div
                    className="rounded-xl flex items-center justify-center text-white font-black flex-shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background:
                        "linear-gradient(135deg, var(--color-accent), var(--color-secondary))",
                      fontSize: 16,
                    }}
                  >
                    {labHeadName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-white font-black text-sm truncate">
                    {labHeadName}
                  </p>
                  {labHeadTitle && (
                    <p
                      className="text-xs truncate"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      {labHeadTitle}
                    </p>
                  )}
                  <span
                    className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-1"
                    style={{
                      background: "rgba(245,158,11,0.15)",
                      color: "var(--color-accent)",
                    }}
                  >
                    <EditableText
                      id="footer.labDirectorLabel"
                      defaultValue="Lab Director"
                      className="inline"
                    />
                  </span>
                </div>
              </div>
            )}

            {/* Social links */}
            {socialLinks.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    title={s.label}
                    className="no-underline font-black text-white rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: s.color,
                      width: 34,
                      height: 34,
                      fontSize: 11,
                      boxShadow: `0 2px 8px ${s.color}40`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-2px)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        `0 6px 16px ${s.color}60`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        `0 2px 8px ${s.color}40`;
                    }}
                  >
                    <AppIcon name={s.icon} size={14} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* ── Column 2: Navigation ── */}
          <div className="md:col-span-4">
            <div
              className="text-xs font-black uppercase tracking-widest mb-5"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <EditableText
                id="footer.quickLinksTitle"
                defaultValue="Quick Links"
                className="inline"
              />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="no-underline flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm transition-all"
                  style={{
                    color:
                      hoveredLink === l.to ? "white" : "rgba(255,255,255,0.6)",
                    background:
                      hoveredLink === l.to
                        ? "rgba(255,255,255,0.08)"
                        : "transparent",
                    fontWeight: hoveredLink === l.to ? 600 : 400,
                  }}
                  onMouseEnter={() => setHoveredLink(l.to)}
                  onMouseLeave={() => setHoveredLink(null)}
                >
                  <AppIcon name={l.icon} size={13} />
                  <EditableText
                    id={l.label}
                    defaultValue={l.label}
                    className="inline"
                  />
                </Link>
              ))}
            </div>

            {/* Portal links */}
            <div
              className="mt-6 pt-5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div
                className="text-xs font-black uppercase tracking-widest mb-3"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                <EditableText
                  id="footer.portalAccessTitle"
                  defaultValue="Portal Access"
                  className="inline"
                />
              </div>
              <Link
                to="/login"
                className="no-underline inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg transition-all"
                style={{
                  background: "var(--color-accent)",
                  color: "#1f2937",
                  boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-1px)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 4px 16px rgba(245,158,11,0.45)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 2px 8px rgba(245,158,11,0.3)";
                }}
              >
                <AppIcon name="login" size={14} />
                <EditableText
                  id="footer.portalLoginBtn"
                  defaultValue="Portal Login"
                  className="inline"
                />
              </Link>
            </div>
          </div>

          {/* ── Column 3: Contact ── */}
          <div className="md:col-span-4">
            <div
              className="text-xs font-black uppercase tracking-widest mb-5"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <EditableText
                id="footer.getInTouchTitle"
                defaultValue="Get In Touch"
                className="inline"
              />
            </div>

            <div className="flex flex-col gap-4">
              {content["contact.address"] && (
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <AppIcon name="location" size={14} />
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {content["contact.address"]}
                  </p>
                </div>
              )}

              {content["contact.email"] && (
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <AppIcon name="contact" size={14} />
                  </div>
                  <a
                    href={`mailto:${content["contact.email"]}`}
                    className="text-sm no-underline font-semibold transition-colors"
                    style={{ color: "var(--color-accent)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "white")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--color-accent)")
                    }
                  >
                    {content["contact.email"]}
                  </a>
                </div>
              )}

              {content["contact.phone"] && (
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <AppIcon name="phone" size={14} />
                  </div>
                  <a
                    href={`tel:${content["contact.phone"]}`}
                    className="text-sm no-underline"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "white")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "rgba(255,255,255,0.6)")
                    }
                  >
                    {content["contact.phone"]}
                  </a>
                </div>
              )}

              {/* Contact CTA */}
              <Link
                to="/contact"
                className="no-underline inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg mt-2 transition-all"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  width: "fit-content",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.14)";
                  (e.currentTarget as HTMLElement).style.color = "white";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.color =
                    "rgba(255,255,255,0.7)";
                }}
              >
                <EditableText
                  id="footer.sendMessageBtn"
                  defaultValue="Send a Message →"
                  className="inline"
                />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div
        className="border-t"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            <EditableText
              id="footer.copyright"
              defaultValue={`© ${new Date().getFullYear()} Rahman Research Lab — Bangladesh University of Engineering and Technology`}
              className="inline"
            />
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="no-underline text-xs"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.7)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.3)")
              }
            >
              <EditableText
                id="footer.adminLink"
                defaultValue="Admin"
                className="inline"
              />
            </Link>
            {/* Back to top */}
            <button
              onClick={scrollToTop}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-none cursor-pointer transition-all"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--color-accent)";
                (e.currentTarget as HTMLElement).style.color = "#1f2937";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.6)";
              }}
            >
              <EditableText
                id="footer.backToTopBtn"
                defaultValue="↑ Back to top"
                className="inline"
              />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
