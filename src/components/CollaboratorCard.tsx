import React, { memo, useId, useMemo, useState } from "react";
import type { CollaboratorProfile } from "../types";
import AppIcon, { type AppIconName } from "./AppIcon";

export interface CollaboratorCardProps {
  collaborator: CollaboratorProfile;
  onClick?: () => void;
  /**
   * Overrides the env-based lookup. Prefer passing this from the list that
   * already knows who runs the lab — it keeps this component testable outside
   * Vite (Storybook, unit tests) and avoids a per-card env read.
   */
  isLabHead?: boolean;
  /** Cards above the fold should not lazy-load; it delays LCP. */
  priority?: boolean;
  /**
   * Renders the bio in-flow instead of behind the hover reveal. For the live
   * preview in the request form, where the point is to show someone their bio —
   * hiding it until they hover over their own card would be absurd.
   */
  previewMode?: boolean;
}

/** Empty env var must never match an empty uid, or everyone becomes the PI. */
const LAB_HEAD_UID = String(import.meta.env?.VITE_LAB_HEAD_UID ?? "").trim();

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2";

/**
 * The bio expands the existing caption block instead of sliding a panel over
 * it, so the name and designation stay readable the whole time. Animating
 * grid-template-rows between 0fr and 1fr gives a real height transition
 * without hard-coding the bio's height.
 *
 * Opens on pointer hover and on keyboard focus — hover alone would leave the
 * bio unreachable for anyone tabbing through the grid.
 *
 * Note the direction of the query. The touch layout is the default and the
 * hover treatment is what gets opted into, so a device that reports something
 * ambiguous lands on the layout that works without a pointer. Testing for
 * `hover: none` the other way round leaves those devices with a bio nobody can
 * reach. It's a capability query, not a breakpoint: a narrow window on a laptop
 * still has a mouse, and a large tablet still doesn't.
 *
 * These strings are written out in full on purpose — Tailwind scans source text
 * for complete class names, so building them by interpolation silently produces
 * no CSS at all.
 */
const REVEAL =
  "hidden grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:grid";

/** Shown only where there's a real pointer. */
const HOVER_ONLY = "hidden [@media(hover:hover)_and_(pointer:fine)]:block";

/** The default. Hidden once we know the device can hover. */
const TOUCH_ONLY = "[@media(hover:hover)_and_(pointer:fine)]:hidden";

type SocialKey = "linkedin" | "scholar" | "orcid" | "researchgate" | "facebook";
type Social = { key: SocialKey; label: string; icon: AppIconName };
type ResolvedSocial = Social & { href: string };

const SOCIALS: readonly Social[] = [
  { key: "linkedin", label: "LinkedIn", icon: "linkedin" },
  { key: "scholar", label: "Google Scholar", icon: "scholar" },
  { key: "orcid", label: "ORCID", icon: "orcid" },
  { key: "researchgate", label: "ResearchGate", icon: "researchgate" },
  { key: "facebook", label: "Facebook", icon: "facebook" },
];

const HONORIFIC = /^(dr|prof|mr|mrs|ms|md|mohd|engr)\.?$/i;

/** First + last initial, skipping honorifics, safe on multi-byte characters. */
function toInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const named = words.filter((word) => !HONORIFIC.test(word));
  const source = named.length > 0 ? named : words;
  const picked = source.length > 1 ? [source[0], source[source.length - 1]] : source.slice(0, 1);

  return picked
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

const CollaboratorCard: React.FC<CollaboratorCardProps> = ({
  collaborator: c,
  onClick,
  isLabHead,
  priority = false,
  previewMode = false,
}) => {
  /**
   * Tracks *which* photo failed rather than a bare boolean. A plain flag stays
   * stuck when the same card instance is reused for a different person after a
   * filter or sort, leaving a valid photo hidden behind the initials.
   */
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const headingId = useId();

  const showPhoto = Boolean(c.photo) && failedPhoto !== c.photo;
  const showsLabHeadBadge = isLabHead ?? (LAB_HEAD_UID !== "" && c.uid === LAB_HEAD_UID);

  const initials = useMemo(() => toInitials(c.name), [c.name]);

  const socialLinks = useMemo(
    () =>
      SOCIALS.map((social) => ({ ...social, href: c[social.key] })).filter(
        (social): social is ResolvedSocial => Boolean(social.href),
      ),
    [c.linkedin, c.scholar, c.orcid, c.researchgate, c.facebook],
  );

  const interests = c.researchInterests ?? [];
  const visibleInterests = interests.slice(0, 2);
  const hiddenInterests = interests.slice(visibleInterests.length);

  return (
    <article
      aria-labelledby={headingId}
      className={`group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)] motion-safe:hover:-translate-y-0.5 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {showPhoto ? (
          <img
            src={c.photo}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={() => setFailedPhoto(c.photo ?? null)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]"
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

        {showsLabHeadBadge && (
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

        {/* Caption + bio share one block, so the bio pushes the block taller
            instead of covering the name. pointer-events-none keeps the click
            overlay underneath reachable for text-drag and middle-click. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 overflow-hidden px-4 pb-3.5 pt-12">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-transparent"
          />
          {/* Translucent, so the photo stays visible through the open bio. The
              small backdrop blur is what keeps the text readable over a busy
              image — drop the alpha further and raise the blur, not the other
              way round. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 opacity-0 backdrop-blur-[3px] transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
            style={{
              background:
                "linear-gradient(to top, color-mix(in srgb, var(--color-primary) 72%, transparent) 45%, color-mix(in srgb, var(--color-primary) 28%, transparent))",
            }}
          />

          <h3
            id={headingId}
            className="text-[16.5px] font-bold leading-snug text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {c.name}
          </h3>
          {c.designation && (
            <p
              title={c.designation}
              className="mt-0.5 line-clamp-1 text-[12.5px] font-medium text-white/80"
            >
              {c.designation}
            </p>
          )}

          {c.bio && !previewMode && (
            <div className={REVEAL}>
              <div className="overflow-hidden">
                <p className="mt-2 line-clamp-3 text-[12.5px] leading-6 text-white/85">{c.bio}</p>
                {onClick && (
                  <p
                    className="mt-2.5 flex items-center gap-1.5 border-t border-white/15 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "var(--color-accent)" }}
                  >
                    View full profile <span aria-hidden="true">→</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {c.affiliation && (
          <p className="flex items-center gap-1.5 text-[12px] leading-5 text-slate-500">
            <AppIcon name="building" size={12} />
            <span className="line-clamp-1">{c.affiliation}</span>
          </p>
        )}

        {c.bio && (
          <p
            className={`mt-2.5 line-clamp-3 text-[13px] leading-6 text-slate-600 ${
              previewMode ? "" : TOUCH_ONLY
            }`}
          >
            {c.bio}
          </p>
        )}

        {visibleInterests.length > 0 && (
          <ul aria-label="Research interests" className="mt-3 flex flex-wrap gap-1.5">
            {visibleInterests.map((interest) => (
              <li
                key={interest}
                className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium leading-none text-slate-600"
              >
                {interest}
              </li>
            ))}
            {hiddenInterests.length > 0 && (
              <li
                title={hiddenInterests.join(", ")}
                aria-label={`${hiddenInterests.length} more: ${hiddenInterests.join(", ")}`}
                className="px-1 py-1 text-[11px] font-medium leading-none text-slate-400"
              >
                +{hiddenInterests.length}
              </li>
            )}
          </ul>
        )}

        {/* mt-auto keeps footers aligned across a grid of uneven cards.
            z-40 puts these above the click overlay so they stay clickable. */}
        <div className="mt-auto flex items-center gap-1 pt-4">
          {socialLinks.map((link) => (
            <a
              key={link.key}
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
              className={`ml-auto text-sm text-slate-400 transition group-hover:text-slate-900 motion-safe:group-hover:translate-x-0.5 ${HOVER_ONLY}`}
            >
              →
            </span>
          )}
        </div>

        {/* Touch gets a target it can see. Deliberately not a <button>: the
            overlay below already covers the whole card, and it sits above this
            in the stack, so a tap here still lands on it. A second real button
            would just mean the same action announced twice. */}
        {onClick && (
          <span
            aria-hidden="true"
            className={`mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-slate-600 ${TOUCH_ONLY}`}
          >
            View profile →
          </span>
        )}
      </div>

      {/* The click target. A direct child of <article> at z-30, so it covers the
          whole card and sits above the caption block. Empty and aria-labelled,
          so the heading above stays a heading instead of being swallowed into
          one long link announcement. */}
      {onClick && (
        <button
          type="button"
          onClick={onClick}
          aria-label={`View ${c.name}'s profile`}
          className="absolute inset-0 z-30 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-secondary)]"
        />
      )}
    </article>
  );
};

/**
 * Memoised: a directory page re-renders every card on each keystroke of a
 * search or filter box, and each card carries an image and five icons.
 */
export default memo(CollaboratorCard);
