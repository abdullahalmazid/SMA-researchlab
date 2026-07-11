import React, { useState } from "react";
import type { CollaboratorProfile } from "../types";
import AppIcon from "./AppIcon";

interface Props {
  collaborator: CollaboratorProfile;
  onClick?: () => void;
}

const CollaboratorCard: React.FC<Props> = ({ collaborator: c, onClick }) => {
  const [imgErr, setImgErr] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isLabHead = c.uid === String(import.meta.env.VITE_LAB_HEAD_UID || "");

  const initials = c.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const socialLinks = [
    {
      href: c.linkedin,
      label: "LinkedIn",
      icon: "linkedin" as const,
    },
    {
      href: c.scholar,
      label: "Google Scholar",
      icon: "scholar" as const,
    },
    {
      href: c.orcid,
      label: "ORCID",
      icon: "orcid" as const,
    },
    {
      href: c.researchgate,
      label: "ResearchGate",
      icon: "researchgate" as const,
    },
    {
      href: c.facebook,
      label: "Facebook",
      icon: "facebook" as const,
    },
  ].filter((s) => s.href);

  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && onClick) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "link" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `View ${c.name}'s collaborator profile` : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl overflow-hidden cursor-pointer flex flex-col focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
      style={{
        background: "white",
        border: "1px solid #e8eef4",
        boxShadow: hovered
          ? "0 20px 48px rgba(0,0,0,0.14)"
          : "0 2px 12px rgba(0,0,0,0.06)",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        transition: "box-shadow 0.28s ease, transform 0.28s ease",
      }}
    >
      {/* Photo header with gradient mesh */}
      <div
        className="relative flex items-center justify-center py-8 overflow-hidden"
        style={{
          background: `linear-gradient(145deg, var(--color-primary) 0%, var(--color-secondary) 60%, var(--color-primary) 100%)`,
          minHeight: 160,
        }}
      >
        {/* Decorative dots */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        {/* Accent glow */}
        <div
          className="absolute bottom-0 left-1/2 w-32 h-32 rounded-full opacity-30 blur-2xl"
          style={{
            background: "var(--color-accent)",
            transform: "translateX(-50%) translateY(50%)",
          }}
        />

        {/* Avatar with glow ring */}
        <div
          className="relative z-10"
          style={{
            padding: 3,
            borderRadius: "50%",
            background: hovered
              ? "linear-gradient(135deg, var(--color-accent), var(--color-secondary))"
              : "rgba(255,255,255,0.3)",
            transition: "background 0.3s ease",
            boxShadow: hovered ? "0 0 24px rgba(245,158,11,0.5)" : "none",
          }}
        >
          {c.photo && !imgErr ? (
            <img
              src={c.photo}
              alt={c.name}
              onError={() => setImgErr(true)}
              className="rounded-full object-cover"
              style={{ width: 100, height: 100, display: "block" }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center text-white font-black"
              style={{
                width: 100,
                height: 100,
                background:
                  "linear-gradient(135deg, var(--color-secondary), var(--color-primary))",
                fontSize: 32,
              }}
            >
              {initials}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col flex-1">
        <h3
          className="font-black text-gray-900 text-lg leading-tight mb-1 text-center"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {c.name}
        </h3>
        {isLabHead && <span className="mx-auto mb-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider" style={{ background: "color-mix(in srgb, var(--color-accent) 22%, white)", color: "var(--color-primary)" }}>Lab Head · Principal Investigator</span>}
        <p
          className="text-sm font-bold mb-1 text-center"
          style={{ color: "var(--color-secondary)" }}
        >
          {c.designation}
        </p>
        <p className="text-xs text-gray-400 mb-3 text-center flex items-center justify-center gap-1">
          <AppIcon name="building" size={12} /> {c.affiliation}
        </p>

        {/* Bio */}
        <p
          className="text-sm text-gray-600 leading-relaxed mb-4 flex-1 text-center"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.7,
          }}
        >
          {c.bio}
        </p>

        {/* Research interests */}
        {c.researchInterests && c.researchInterests.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-4">
            {c.researchInterests.slice(0, 2).map((r) => (
              <span
                key={r}
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: "#f0fdf4",
                  color: "#166534",
                  border: "1px solid #bbf7d0",
                }}
              >
                {r}
              </span>
            ))}
            {c.researchInterests.length > 2 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: "#f8fafc",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                }}
              >
                +{c.researchInterests.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <div className="flex items-center justify-center gap-2 mb-4">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={s.label}
                className="no-underline font-black text-black rounded-lg flex items-center justify-center transition-all"
                style={{
                  background: "#ffffff",
                  border: "1px solid #111827",
                  width: 30,
                  height: 30,
                  fontSize: 11,
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
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <AppIcon name={s.icon} size={14} />
              </a>
            ))}
          </div>
        )}

        {/* CTA */}
        <div
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all"
          style={{
            background: hovered ? "var(--color-primary)" : "#f1f5f9",
            color: hovered ? "white" : "var(--color-primary)",
            transition: "background 0.25s ease, color 0.25s ease",
          }}
        >
          View Full Profile →
        </div>
      </div>
    </div>
  );
};

export default CollaboratorCard;
