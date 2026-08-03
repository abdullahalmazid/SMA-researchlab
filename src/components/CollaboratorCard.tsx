import React, { useState } from "react";
import type { CollaboratorProfile } from "../types";
import AppIcon, { type AppIconName } from "./AppIcon";

interface Props {
  collaborator: CollaboratorProfile;
  onClick?: () => void;
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2";

/**
 * Slides up on pointer hover and on keyboard focus — hover alone would leave
 * the bio unreachable for anyone tabbing through the grid. Dropped entirely on
 * devices with no hover; the in-flow copy below takes over.
 *
 * pointer-events-none matters: the panel sits over the click overlay, so
 * without it the card stops responding the moment the panel opens.
 */
const PANEL =
  "pointer-events-none translate-y-full transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-hover:translate-y-0 group-focus-within:translate-y-0 motion-reduce:transition-none [@media(hover:none)]:hidden";

/** Touch only — mirrors PANEL so the photo is never permanently covered. */
const BIO_INLINE = "hidden [@media(hover:none)]:block";

const CollaboratorCard: React.FC<Props> = ({ collaborator: c, onClick }) => {
  const [imgErr, setImgErr] = useState(false);
  const isLabHead = c.uid === String(import.meta.env.VITE_LAB_HEAD_UID || "");

  const initials = c.name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const socialLinks = (
    [
      { href: c.linkedin, label: "LinkedIn", icon: "linkedin" as AppIconName },
      { href: c.scholar, label: "Google Scholar", icon: "scholar" as AppIconName },
      { href: c.orcid, label: "ORCID", icon: "orcid" as AppIconName },
      { href: c.researchgate, label: "ResearchGate", icon: "researchgate" as AppIconName },
      { href: c.facebook, label: "Facebook", icon: "facebook" as AppIconName },
    ] as const
  ).filter((link) => link.href);

  const interests = c.researchInterests ?? [];
  const visibleInterests = interests.slice(0, 2);

  return (
    <article
      className={`group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)] motion-safe:hover:-translate-y-0.5 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {c.photo && !imgErr ? (
          <img
            src={c.photo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgErr(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-5xl font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
            }}
          >
            {initials}
          </div>
        )}

        {isLabHead && (
          <span
            className="absolute left-3 top-3 z-20 rounded-md px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em]"
            style={{
              background: "color-mix(in srgb, var(--color-accent) 92%, white)",
              color: "#3d2600",
            }}
          >
            Principal investigator
          </span>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3.5 pt-12">
          <h3
            className="text-[16.5px] font-bold leading-snug text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {c.name}
          </h3>
          {c.designation && (
            <p className="mt-0.5 line-clamp-1 text-[12.5px] font-medium text-white/80">
              {c.designation}
            </p>
          )}
        </div>

        {c.bio && (
          <div
            className={`absolute inset-x-0 bottom-0 z-20 px-4 pb-3.5 pt-3.5 ${PANEL}`}
            style={{ background: "color-mix(in srgb, var(--color-primary) 94%, black)" }}
          >
            <p className="line-clamp-3 text-[12.5px] leading-6 text-white/85">{c.bio}</p>
            {onClick && (
              <p
                className="mt-2.5 flex items-center gap-1.5 border-t border-white/15 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--color-accent)" }}
              >
                Click for full profile <span aria-hidden="true">→</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {c.affiliation && (
          <p className="flex items-center gap-1.5 text-[12px] leading-5 text-slate-500">
            <AppIcon name="building" size={12} />
            <span className="line-clamp-1">{c.affiliation}</span>
          </p>
        )}

        {c.bio && (
          <p className={`mt-2.5 line-clamp-3 text-[13px] leading-6 text-slate-600 ${BIO_INLINE}`}>
            {c.bio}
          </p>
        )}

        {visibleInterests.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {visibleInterests.map((interest) => (
              <li
                key={interest}
                className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium leading-none text-slate-600"
              >
                {interest}
              </li>
            ))}
            {interests.length > visibleInterests.length && (
              <li className="px-1 py-1 text-[11px] font-medium leading-none text-slate-400">
                +{interests.length - visibleInterests.length}
              </li>
            )}
          </ul>
        )}

        {/* mt-auto keeps footers aligned across a grid of uneven cards.
            z-40 puts these above the click overlay so they stay clickable. */}
        <div className="mt-auto flex items-center gap-1 pt-4">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${c.name} on ${link.label}`}
              onClick={(event) => event.stopPropagation()}
              className={`relative z-40 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 ${FOCUS}`}
            >
              <AppIcon name={link.icon} size={16} />
            </a>
          ))}

          {onClick && (
            <span
              aria-hidden="true"
              className="ml-auto text-sm text-slate-400 transition group-hover:text-slate-900 motion-safe:group-hover:translate-x-0.5"
            >
              →
            </span>
          )}
        </div>
      </div>

      {/* The click target. A direct child of <article> at z-30, so it covers the
          whole card and sits above the hover panel. Empty and aria-labelled, so
          the heading above stays a heading instead of being swallowed into one
          long link announcement. */}
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          aria-label={`View ${c.name}'s profile`}
          className="absolute inset-0 z-30 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-secondary)]"
        />
      )}
    </article>
  );
};

export default CollaboratorCard;
