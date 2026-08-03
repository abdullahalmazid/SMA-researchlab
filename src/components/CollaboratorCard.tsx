import React, { useState } from "react";
import type { CollaboratorProfile } from "../types";
import AppIcon, { type AppIconName } from "./AppIcon";

interface Props {
  collaborator: CollaboratorProfile;
  onClick?: () => void;
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2";

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

  /**
   * The name is the single primary target. Its ::after overlay makes the whole
   * card clickable while a screen reader still gets a heading — the old
   * role="link" div announced every child as one unstructured string.
   * Social links sit above the overlay at z-10.
   */
  const stretched =
    "after:absolute after:inset-0 after:rounded-[16px] after:content-['']";

  return (
    <article className="group relative isolate flex h-full flex-col rounded-[16px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-200 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] motion-safe:hover:-translate-y-0.5">
      <div className="flex flex-1 flex-col p-5">
        {/* Identity row — replaces the 160px gradient photo band. */}
        <div className="flex items-start gap-4">
          {c.photo && !imgErr ? (
            <img
              src={c.photo}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgErr(true)}
              className="h-[72px] w-[72px] shrink-0 rounded-[14px] border border-slate-200 object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[14px] text-xl font-semibold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
              }}
            >
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3
              className="text-[16px] font-bold leading-snug tracking-[-0.01em] text-slate-900"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {onClick ? (
                <button
                  type="button"
                  onClick={onClick}
                  className={`text-left decoration-slate-300 underline-offset-2 group-hover:underline ${stretched} ${FOCUS} focus-visible:after:ring-2 focus-visible:after:ring-[color:var(--color-secondary)] focus-visible:after:ring-offset-2`}
                >
                  {c.name}
                </button>
              ) : (
                c.name
              )}
            </h3>

            {c.designation && (
              <p
                className="mt-1 line-clamp-1 text-[13px] font-semibold leading-5"
                style={{ color: "var(--color-secondary)" }}
              >
                {c.designation}
              </p>
            )}

            {c.affiliation && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-5 text-slate-500">
                <AppIcon name="building" size={12} />
                <span className="line-clamp-1">{c.affiliation}</span>
              </p>
            )}

            {isLabHead && (
              <p
                className="mt-2 inline-flex rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 20%, white)",
                  color: "var(--color-primary)",
                }}
              >
                Principal Investigator
              </p>
            )}
          </div>
        </div>

        {c.bio && (
          <p className="mt-4 line-clamp-2 text-[13.5px] leading-6 text-slate-600">{c.bio}</p>
        )}

        {visibleInterests.length > 0 && (
          <ul className="mt-3.5 flex flex-wrap gap-1.5">
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
                +{interests.length - visibleInterests.length} more
              </li>
            )}
          </ul>
        )}

        {/* mt-auto keeps footers aligned across a grid of uneven cards. */}
        <div className="mt-auto flex items-center gap-1 pt-5">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${c.name} on ${link.label}`}
              onClick={(event) => event.stopPropagation()}
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 ${FOCUS}`}
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
    </article>
  );
};

export default CollaboratorCard;
