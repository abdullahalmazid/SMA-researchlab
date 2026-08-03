import React, { useMemo, useState } from "react";
import type { CollaboratorProfile, CollaboratorPublication, GalleryItem } from "../types";
import AppIcon, { type AppIconName } from "./AppIcon";

interface Props {
  c: CollaboratorProfile;
  linkedPublications: CollaboratorPublication[];
  galleryItems?: GalleryItem[];
  onBack: () => void;
}

/* ------------------------------------------------------------------ *
 * Shared class strings
 * ------------------------------------------------------------------ */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2";
const FOCUS_ON_HERO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-primary)]";
const PANEL =
  "rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/**
 * One heading device for the page: hairline, small-caps eyebrow, optional
 * count. The count belongs here, labelling a section — not in a stat strip.
 */
const Eyebrow: React.FC<{ id: string; children: React.ReactNode; count?: number }> = ({
  id,
  children,
  count,
}) => (
  <div className="mb-6">
    <div className="h-px w-10 bg-slate-200" />
    <h2
      id={id}
      className="mt-4 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
    >
      {children}
      {typeof count === "number" && (
        <span className="font-medium text-slate-400 [font-variant-numeric:tabular-nums]">
          {count}
        </span>
      )}
    </h2>
  </div>
);

/* ------------------------------------------------------------------ *
 * Avatar — squared. A circle crops the sides off most headshots and its
 * symmetry pulls the whole header into a centred vertical stack.
 * ------------------------------------------------------------------ */

const ProfileAvatar: React.FC<{ photo?: string; name: string }> = ({ photo, name }) => {
  const [failed, setFailed] = useState(false);
  const initials = (name || "Unknown")
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const shared: React.CSSProperties = {
    width: "clamp(124px, 14vw, 168px)",
    aspectRatio: "1 / 1",
    borderRadius: 20,
    border: "3px solid rgba(255,255,255,0.3)",
    boxShadow: "0 16px 36px rgba(0,0,0,0.24)",
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
        background: "rgba(255,255,255,0.14)",
        fontSize: "clamp(42px, 5vw, 56px)",
      }}
    >
      {initials}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

const CollaboratorPublicProfile: React.FC<Props> = ({
  c,
  linkedPublications,
  galleryItems = [],
  onBack,
}) => {
  const mergedPublications = useMemo(() => {
    const all = [...(c.publications ?? []), ...(linkedPublications ?? [])];
    const seen = new Set<string>();

    return all
      .filter((item) => {
        // Prefer the id when there is one; two records sharing an id are the
        // same record even if a title was edited between sources.
        const key = item.id
          ? `id:${item.id}`
          : `k:${String(item.title ?? "").trim().toLowerCase()}::${item.year ?? 0}::${(
              item.url ?? ""
            )
              .trim()
              .toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(
        (a, b) =>
          (b.year ?? 0) - (a.year ?? 0) ||
          String(a.title ?? "").localeCompare(String(b.title ?? "")),
      );
  }, [c.publications, linkedPublications]);

  const interests = c.researchInterests ?? [];

  const links = (
    [
      { href: c.linkedin, label: "LinkedIn", icon: "linkedin" as AppIconName },
      { href: c.scholar, label: "Google Scholar", icon: "scholar" as AppIconName },
      { href: c.orcid, label: "ORCID", icon: "orcid" as AppIconName },
      { href: c.researchgate, label: "ResearchGate", icon: "researchgate" as AppIconName },
      { href: c.facebook, label: "Facebook", icon: "facebook" as AppIconName },
    ] as const
  ).filter((link) => link.href);

  const visibleGallery = galleryItems.slice(0, 9);

  return (
    <main className="bg-slate-50">
      {/* Compact header: one horizontal row instead of a centred stack of
          avatar → name → designation → affiliation → 3-up stat grid, which was
          what made this section so tall. */}
      <header
        aria-labelledby="collaborator-name"
        className="relative overflow-hidden px-4 py-10 md:py-12"
        style={{
          background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-7 text-center sm:flex-row sm:items-center sm:gap-9 sm:text-left">
          <div className="shrink-0">
            <ProfileAvatar photo={c.photo} name={c.name} />
          </div>

          <div className="min-w-0 flex-1">
            <h1
              id="collaborator-name"
              className="text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-white md:text-[36px]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {c.name}
            </h1>

            {c.designation && (
              <p
                className="mt-3 text-[15px] font-semibold leading-6"
                style={{ color: "var(--color-accent)" }}
              >
                {c.designation}
              </p>
            )}

            {c.affiliation && (
              <p className="mt-1.5 text-[14px] leading-6 text-white/75">{c.affiliation}</p>
            )}

            {c.email && (
              <div className="mt-6 flex justify-center sm:justify-start">
                <a
                  href={`mailto:${c.email}`}
                  className={`inline-flex min-h-[42px] items-center rounded-xl bg-white px-5 text-sm font-semibold no-underline shadow-lg transition hover:opacity-90 ${FOCUS_ON_HERO}`}
                  style={{ color: "var(--color-primary)" }}
                >
                  Contact {c.name.split(" ")[0]}
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <button
          type="button"
          onClick={onBack}
          className={`group mb-9 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:text-slate-900 hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)] ${FOCUS}`}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <span className="transition-transform motion-safe:group-hover:-translate-x-0.5">
            <AppIcon name="back" size={16} />
          </span>
          Back to Collaborators
        </button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            {c.bio && (
              <section aria-labelledby="about-heading" className={`${PANEL} p-6 md:p-8`}>
                <Eyebrow id="about-heading">About</Eyebrow>
                <p
                  className="max-w-[68ch] text-[15.5px] text-slate-700"
                  style={{ whiteSpace: "pre-line", lineHeight: 1.8 }}
                >
                  {c.bio}
                </p>
              </section>
            )}

            <section aria-labelledby="publications-heading" className={`${PANEL} p-6 md:p-8`}>
              <Eyebrow id="publications-heading" count={mergedPublications.length}>
                Publications
              </Eyebrow>

              {mergedPublications.length === 0 ? (
                <p className="text-[15px] text-slate-500">
                  No publications are linked to this profile yet.
                </p>
              ) : (
                /* Year rail instead of a left accent stripe — it encodes the
                   axis people actually scan, and matches PublicationCard. */
                <ul className="grid gap-2.5">
                  {mergedPublications.map((publication, index) => {
                    const body = (
                      <>
                        <span className="hidden shrink-0 self-stretch border-r border-slate-200 pr-4 text-sm font-bold leading-6 text-slate-900 [font-variant-numeric:tabular-nums] sm:block">
                          {publication.year ?? "—"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-semibold leading-snug text-slate-900 decoration-slate-300 underline-offset-2 group-hover:underline">
                            {publication.title || "Untitled publication"}
                          </span>
                          <span className="mt-1 block text-[12.5px] leading-5 text-slate-500">
                            {publication.journal && (
                              <span className="italic">{publication.journal}</span>
                            )}
                            {publication.journal && publication.year && (
                              <span aria-hidden="true" className="mx-1.5 text-slate-300">
                                ·
                              </span>
                            )}
                            <span className="sm:hidden [font-variant-numeric:tabular-nums]">
                              {publication.year}
                            </span>
                          </span>
                        </span>
                      </>
                    );

                    const key = publication.id ?? `${publication.title}-${index}`;

                    return (
                      <li key={key}>
                        {publication.url ? (
                          <a
                            href={publication.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`group flex items-start gap-4 rounded-[14px] border border-slate-200 p-4 no-underline transition hover:border-slate-300 hover:shadow-[0_6px_16px_rgba(15,23,42,0.06)] ${FOCUS}`}
                          >
                            {body}
                            <span aria-hidden="true" className="self-center text-sm text-slate-400">
                              ↗
                            </span>
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ) : (
                          <div className="flex items-start gap-4 rounded-[14px] border border-slate-200 p-4">
                            {body}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {visibleGallery.length > 0 && (
              <section aria-labelledby="gallery-heading" className={`${PANEL} p-6 md:p-8`}>
                <Eyebrow id="gallery-heading" count={galleryItems.length}>
                  Contributor gallery
                </Eyebrow>

                <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {visibleGallery.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`group relative block aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${FOCUS}`}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition duration-300 motion-safe:group-hover:scale-105"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8 text-[11.5px] font-semibold leading-tight text-white">
                          {item.title}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>

                {galleryItems.length > visibleGallery.length && (
                  <p className="mt-4 text-[12.5px] text-slate-500">
                    Showing {visibleGallery.length} of {galleryItems.length} images.
                  </p>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
            {interests.length > 0 && (
              <section aria-labelledby="interests-heading" className={`${PANEL} p-6`}>
                <Eyebrow id="interests-heading">Research interests</Eyebrow>
                {/* Was hardcoded #eff6ff / #1d4ed8 — blue whatever the theme. */}
                <ul className="flex flex-wrap gap-2">
                  {interests.map((interest) => (
                    <li
                      key={interest}
                      className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[12.5px] font-medium text-slate-700"
                    >
                      {interest}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {links.length > 0 && (
              <section aria-labelledby="links-heading" className={`${PANEL} p-6`}>
                <Eyebrow id="links-heading">Academic profiles</Eyebrow>
                <ul className="grid gap-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-slate-700 no-underline transition hover:border-slate-400 hover:text-slate-900 ${FOCUS}`}
                      >
                        <AppIcon name={link.icon} size={17} />
                        <span className="flex-1">{link.label}</span>
                        <span aria-hidden="true" className="text-slate-400">
                          ↗
                        </span>
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {c.email && (
              <section aria-labelledby="contact-heading" className={`${PANEL} p-6`}>
                <Eyebrow id="contact-heading">Contact</Eyebrow>
                <dl>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Email
                  </dt>
                  <dd className="mt-1.5 break-all text-sm font-medium">
                    <a
                      href={`mailto:${c.email}`}
                      className={`rounded-sm underline decoration-slate-300 underline-offset-4 transition hover:decoration-current ${FOCUS}`}
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {c.email}
                    </a>
                  </dd>
                </dl>

                <a
                  href={`mailto:${c.email}`}
                  className={`mt-5 flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-white no-underline transition hover:opacity-90 ${FOCUS}`}
                  style={{ background: "var(--color-primary)" }}
                >
                  Contact researcher
                </a>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
};

export default CollaboratorPublicProfile;
