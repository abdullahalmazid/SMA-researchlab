import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../firebase/config";
import { normalizePublication } from "../firebase/hooks";
import type { Publication, PublicationAuthorEntry } from "../types";

/* ------------------------------------------------------------------ *
 * Config — set these two to match your app.
 * ------------------------------------------------------------------ */

const SITE_NAME = "Your Research Group";
/** Route pattern for an internal author's profile page. */
const profilePath = (profileId: string) => `/team/${profileId}`;

/* ------------------------------------------------------------------ *
 * Author helpers
 * ------------------------------------------------------------------ */

/** Prefers ";" as the separator because "Smith, J." is one author, not two. */
const splitAuthorString = (raw: string): string[] =>
  (raw.includes(";") ? raw.split(";") : raw.split(","))
    .map((name) => name.trim())
    .filter(Boolean);

const resolveAuthors = (publication: Publication): PublicationAuthorEntry[] =>
  publication.authorEntries?.length
    ? publication.authorEntries
    : splitAuthorString(publication.authors ?? "").map(
        (name): PublicationAuthorEntry => ({ type: "external", name }),
      );

/** Returns an internal author's profile id. Adjust the probed keys to your schema. */
const authorProfileId = (author: PublicationAuthorEntry): string | null => {
  if (author.type === "external") return null;
  const record = author as unknown as Record<string, unknown>;
  const id = record.memberId ?? record.profileId ?? record.id ?? record.slug;
  return typeof id === "string" && id.length > 0 ? id : null;
};

const PARTICLES = new Set([
  "van", "von", "de", "del", "della", "der", "den", "di", "da",
  "dos", "du", "la", "le", "bin", "binte", "al", "ibn",
]);

/** "Jane A. Smith" -> { family: "Smith", given: ["Jane", "A."] } */
const parseName = (name: string): { family: string; given: string[] } => {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return { family: "", given: [] };

  if (clean.includes(",")) {
    const [family, rest = ""] = clean.split(",");
    return { family: family.trim(), given: rest.trim().split(" ").filter(Boolean) };
  }

  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return { family: parts[0], given: [] };

  let start = parts.length - 1;
  while (start > 1 && PARTICLES.has(parts[start - 1].toLowerCase())) start -= 1;
  return { family: parts.slice(start).join(" "), given: parts.slice(0, start) };
};

const toInitials = (given: string[]): string =>
  given.map((part) => `${part.charAt(0).toUpperCase()}.`).join(" ");

/** "Smith, J. A." */
const familyFirst = (name: string): string => {
  const { family, given } = parseName(name);
  const initials = toInitials(given);
  return initials ? `${family}, ${initials}` : family;
};

/* ------------------------------------------------------------------ *
 * Citation builders
 * ------------------------------------------------------------------ */

type CitationFormat = "bibtex" | "apa" | "mla";

const CITATION_FORMATS: { id: CitationFormat; label: string }[] = [
  { id: "bibtex", label: "BibTeX" },
  { id: "apa", label: "APA" },
  { id: "mla", label: "MLA" },
];

const canonicalPaperUrl = (publication: Publication): string =>
  publication.doi ? `https://doi.org/${publication.doi}` : publication.url || "";

const withPeriod = (value: string): string =>
  /[.?!]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;

const bibtexEscape = (value: string): string =>
  value.replace(/([&%$#_{}])/g, "\\$1").replace(/~/g, "\\textasciitilde{}");

const bibtexKey = (publication: Publication, firstAuthor: string): string => {
  const family = parseName(firstAuthor).family.toLowerCase().replace(/[^a-z]/g, "");
  const word =
    publication.title
      .toLowerCase()
      .split(/\s+/)
      .find((token) => token.length > 3)
      ?.replace(/[^a-z]/g, "") ?? "untitled";
  return `${family || "anon"}${publication.year ?? ""}${word}`;
};

const buildBibtex = (publication: Publication, names: string[]): string => {
  const entryType = publication.type === "ongoing" ? "unpublished" : "article";
  const fields: [string, string | undefined][] = [
    ["author", names.join(" and ")],
    ["title", `{${publication.title}}`],
    [entryType === "article" ? "journal" : "note", publication.journal],
    ["year", publication.year ? String(publication.year) : undefined],
    ["doi", publication.doi],
    ["url", publication.url || canonicalPaperUrl(publication) || undefined],
  ];

  const body = fields
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `  ${key} = {${bibtexEscape(value)}},`)
    .join("\n");

  return `@${entryType}{${bibtexKey(publication, names[0] ?? "")},\n${body}\n}`;
};

const buildApa = (publication: Publication, names: string[]): string => {
  const formatted = names.slice(0, 20).map(familyFirst);
  const authorList =
    formatted.length === 0
      ? ""
      : formatted.length === 1
        ? formatted[0]
        : `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;

  return [
    authorList,
    publication.year ? `(${publication.year}).` : "(n.d.).",
    withPeriod(publication.title),
    publication.journal ? withPeriod(publication.journal) : "",
    canonicalPaperUrl(publication),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const buildMla = (publication: Publication, names: string[]): string => {
  let authorList = "";
  if (names.length === 1) {
    authorList = withPeriod(familyFirst(names[0]));
  } else if (names.length === 2) {
    const { family, given } = parseName(names[1]);
    const second = [toInitials(given), family].filter(Boolean).join(" ");
    authorList = withPeriod(`${familyFirst(names[0])}, and ${second}`);
  } else if (names.length > 2) {
    authorList = withPeriod(`${familyFirst(names[0])}, et al`);
  }

  return withPeriod(
    [
      authorList,
      `"${withPeriod(publication.title)}"`,
      publication.journal ? `${publication.journal},` : "",
      publication.year ? `${publication.year},` : "",
      canonicalPaperUrl(publication),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  );
};

const buildCitation = (publication: Publication, format: CitationFormat): string => {
  const names = resolveAuthors(publication).map((author) => author.name);
  if (format === "bibtex") return buildBibtex(publication, names);
  if (format === "apa") return buildApa(publication, names);
  return buildMla(publication, names);
};

/* ------------------------------------------------------------------ *
 * Data
 * ------------------------------------------------------------------ */

type PublicationState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; publication: Publication };

const usePublication = (id: string | undefined): PublicationState => {
  const [state, setState] = useState<PublicationState>({ status: "loading" });

  useEffect(() => {
    if (!id) {
      setState({ status: "missing" });
      return;
    }

    setState({ status: "loading" });

    // Live subscription so admin edits appear without a refresh.
    // Swap for getDoc if you don't need that.
    return onSnapshot(
      doc(db, "publications", id),
      (snapshot) => {
        setState(
          snapshot.exists()
            ? { status: "ready", publication: normalizePublication(snapshot.id, snapshot.data()) }
            : { status: "missing" },
        );
      },
      () => setState({ status: "error" }),
    );
  }, [id]);

  return state;
};

/** Publications sharing at least one tag. Firestore caps array-contains-any at 10 values. */
const useRelatedPublications = (publication: Publication | null, max = 3): Publication[] => {
  const [related, setRelated] = useState<Publication[]>([]);
  const tagKey = publication?.tags?.join("|") ?? "";
  const currentId = publication?.id;

  useEffect(() => {
    const tags = tagKey ? tagKey.split("|").filter(Boolean) : [];
    if (!currentId || tags.length === 0) {
      setRelated([]);
      return;
    }

    let active = true;

    getDocs(
      query(
        collection(db, "publications"),
        where("tags", "array-contains-any", tags.slice(0, 10)),
        limit(max + 5),
      ),
    )
      .then((snapshot) => {
        if (!active) return;
        setRelated(
          snapshot.docs
            .filter((entry) => entry.id !== currentId)
            .map((entry) => normalizePublication(entry.id, entry.data()))
            .slice(0, max),
        );
      })
      .catch(() => {
        if (active) setRelated([]);
      });

    return () => {
      active = false;
    };
  }, [currentId, tagKey, max]);

  return related;
};

/* ------------------------------------------------------------------ *
 * Shared tokens
 *
 * slate-400 on white is 2.85:1 and fails WCAG AA, so every label that used
 * it has moved to slate-500 (4.76:1).
 * ------------------------------------------------------------------ */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500";
const PANEL =
  "rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/* ------------------------------------------------------------------ *
 * Presentational pieces
 * ------------------------------------------------------------------ */

/**
 * Requires React 19, which hoists <title>/<meta>/<link>/<script> into <head>
 * from anywhere in the tree. On React 18, wrap these tags in
 * react-helmet-async's <Helmet> instead.
 */
const PublicationSeo: React.FC<{ publication: Publication }> = ({ publication }) => {
  const names = resolveAuthors(publication).map((author) => author.name);
  const canonical = typeof window === "undefined" ? "" : window.location.href;
  const paperUrl = canonicalPaperUrl(publication);

  const raw =
    publication.abstract?.replace(/\s+/g, " ").trim() ||
    [publication.journal, publication.year].filter(Boolean).join(", ");
  const description = raw.length <= 300 ? raw : `${raw.slice(0, 299).trimEnd()}…`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: publication.title,
    name: publication.title,
    abstract: publication.abstract || undefined,
    datePublished: publication.year ? String(publication.year) : undefined,
    author: names.map((name) => ({ "@type": "Person", name })),
    keywords: publication.tags?.length ? publication.tags.join(", ") : undefined,
    isPartOf: publication.journal
      ? { "@type": "Periodical", name: publication.journal }
      : undefined,
    identifier: publication.doi ? `https://doi.org/${publication.doi}` : undefined,
    sameAs: paperUrl || undefined,
    url: canonical || undefined,
  };

  return (
    <>
      <title>{`${publication.title} — ${SITE_NAME}`}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Google Scholar indexing */}
      <meta name="citation_title" content={publication.title} />
      {names.map((name) => (
        <meta key={`citation_author_${name}`} name="citation_author" content={name} />
      ))}
      {publication.year && (
        <meta name="citation_publication_date" content={String(publication.year)} />
      )}
      {publication.journal && <meta name="citation_journal_title" content={publication.journal} />}
      {publication.doi && <meta name="citation_doi" content={publication.doi} />}
      {publication.url?.toLowerCase().endsWith(".pdf") && (
        <meta name="citation_pdf_url" content={publication.url} />
      )}

      {/* Social */}
      <meta property="og:type" content="article" />
      <meta property="og:title" content={publication.title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={SITE_NAME} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={publication.title} />
      <meta name="twitter:description" content={description} />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
};

/**
 * Solid surface, real border, dark text. It now sits on the page background
 * below the hero rather than dissolving into the coloured band.
 */
const BackToPublications: React.FC = () => (
  <Link
    to="/publications"
    className={`group inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:text-slate-900 hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)] print:hidden ${FOCUS}`}
  >
    <span
      aria-hidden="true"
      className="text-base leading-none transition-transform motion-safe:group-hover:-translate-x-0.5"
    >
      ←
    </span>
    Back to publications
  </Link>
);

const Bar: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`rounded-full bg-current opacity-10 ${className}`} />
);

/** Mirrors the real layout so nothing shifts when data lands. */
const PublicationSkeleton: React.FC = () => (
  <main
    className="min-h-screen motion-safe:animate-pulse"
    style={{ background: "var(--color-bg)" }}
    aria-busy="true"
    aria-live="polite"
  >
    <span className="sr-only">Loading publication</span>

    <header
      className="border-b border-white/10 px-4 py-16 text-white"
      style={{ background: "var(--color-primary)" }}
    >
      <div className="mx-auto max-w-5xl">
        <Bar className="h-3 w-40" />
        <Bar className="mt-6 h-9 w-full max-w-3xl" />
        <Bar className="mt-3 h-9 w-2/3 max-w-xl" />
        <Bar className="mt-7 h-4 w-1/2 max-w-md" />
        <Bar className="mt-3 h-4 w-1/3 max-w-xs" />
      </div>
    </header>

    <div className="mx-auto max-w-5xl px-4 pt-8 text-slate-900">
      <Bar className="h-11 w-52 !rounded-xl" />
    </div>

    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-slate-900 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className={`${PANEL} p-6 md:p-9`}>
        <Bar className="h-3 w-24" />
        <div className="mt-6 grid gap-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Bar key={index} className={`h-4 ${index === 6 ? "w-2/5" : "w-full"}`} />
          ))}
        </div>
      </div>

      <div className={`${PANEL} h-fit p-6`}>
        <Bar className="h-3 w-36" />
        <div className="mt-6 grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid gap-2">
              <Bar className="h-3 w-20" />
              <Bar className="h-4 w-32" />
            </div>
          ))}
        </div>
        <Bar className="mt-7 h-11 w-full !rounded-xl" />
      </div>
    </div>
  </main>
);

const Notice: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <main
    className="grid min-h-[70vh] place-items-center px-4 py-24"
    style={{ background: "var(--color-bg)" }}
  >
    <div className="max-w-md text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-3 text-[15px] leading-7 text-slate-600">{body}</p>
      <div className="mt-7 flex justify-center">
        <BackToPublications />
      </div>
    </div>
  </main>
);

/** Inline for the hero, stacked for a sidebar. */
const AuthorList: React.FC<{
  authors: PublicationAuthorEntry[];
  variant?: "inline" | "stacked";
}> = ({ authors, variant = "stacked" }) => {
  if (authors.length === 0) {
    return <p className="text-sm font-medium text-slate-500">Not recorded</p>;
  }

  const inline = variant === "inline";
  const linkClass = inline
    ? "rounded-sm text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-primary)]"
    : `rounded-sm underline decoration-slate-300 underline-offset-4 transition hover:decoration-current ${FOCUS}`;

  return (
    <ul
      className={
        inline
          ? "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] font-medium leading-7 text-white/90"
          : "grid gap-2 text-sm font-medium text-slate-700"
      }
    >
      {authors.map((author, index) => {
        const profileId = authorProfileId(author);
        const isLast = index === authors.length - 1;

        return (
          <li key={`${author.name}-${index}`}>
            {profileId ? (
              <Link
                to={profilePath(profileId)}
                className={linkClass}
                style={inline ? undefined : { color: "var(--color-secondary)" }}
              >
                {author.name}
              </Link>
            ) : (
              <span>{author.name}</span>
            )}
            {inline && !isLast && (
              <span aria-hidden="true" className="text-white/50">
                ,
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const CitationExport: React.FC<{ publication: Publication }> = ({ publication }) => {
  const [format, setFormat] = useState<CitationFormat>("apa");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<number | null>(null);

  const citation = useMemo(() => buildCitation(publication, format), [publication, format]);

  useEffect(
    () => () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const handleCopy = async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(citation);
        copied = true;
      }
    } catch {
      copied = false;
    }

    setStatus(copied ? "copied" : "failed");
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 2600);
  };

  return (
    <section aria-labelledby="cite-heading" className={`${PANEL} mt-6 p-6 md:p-8 print:hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="cite-heading" className={EYEBROW}>
          Cite this work
        </h2>

        <div
          role="tablist"
          aria-label="Citation format"
          className="flex gap-1 rounded-lg bg-slate-100 p-1"
        >
          {CITATION_FORMATS.map((entry) => {
            const active = entry.id === format;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`cite-tab-${entry.id}`}
                aria-selected={active}
                aria-controls="cite-panel"
                onClick={() => {
                  setFormat(entry.id);
                  setStatus("idle");
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${FOCUS} ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      <pre
        id="cite-panel"
        role="tabpanel"
        aria-labelledby={`cite-tab-${format}`}
        tabIndex={0}
        className={`mt-5 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-5 font-mono text-[12.5px] leading-6 text-slate-700 ${FOCUS}`}
      >
        {citation}
      </pre>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleCopy}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 ${FOCUS}`}
          style={{ background: "var(--color-secondary)" }}
        >
          Copy citation
        </button>
        <p aria-live="polite" className="text-sm font-medium text-slate-600">
          {status === "copied" && "Copied to clipboard"}
          {status === "failed" && "Copy blocked by your browser — select the text above instead"}
        </p>
      </div>
    </section>
  );
};

const RelatedPublications: React.FC<{ publications: Publication[] }> = ({ publications }) => {
  if (publications.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="mt-10 print:hidden">
      <h2 id="related-heading" className={EYEBROW}>
        Related work
      </h2>

      <ul className="mt-4 grid gap-3">
        {publications.map((entry) => (
          <li key={entry.id}>
            <Link
              to={`/publications/${entry.id}`}
              className={`group flex items-start gap-4 rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(15,23,42,0.07)] ${FOCUS}`}
            >
              <span className="hidden shrink-0 self-stretch border-r border-slate-200 pr-4 text-[15px] font-bold leading-6 text-slate-900 [font-variant-numeric:tabular-nums] sm:block">
                {entry.year}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-snug text-slate-900 decoration-slate-300 underline-offset-2 group-hover:underline">
                  {entry.title}
                </span>
                {entry.journal && (
                  <span className="mt-1 block truncate text-[12.5px] italic text-slate-500">
                    {entry.journal}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
    <dt className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">{label}</dt>
    {children}
  </div>
);

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const PublicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const state = usePublication(id);
  const publication = state.status === "ready" ? state.publication : null;
  const related = useRelatedPublications(publication);

  if (state.status === "loading") return <PublicationSkeleton />;

  if (state.status === "error") {
    return (
      <Notice
        title="This publication didn't load"
        body="The connection to our records failed. Reload the page, or head back to the full list."
      />
    );
  }

  if (!publication) {
    return (
      <Notice
        title="Publication not found"
        body="This record may have been moved or removed. The full list is the best place to pick up the trail."
      />
    );
  }

  const authors = resolveAuthors(publication);
  const doiUrl = publication.doi ? `https://doi.org/${publication.doi}` : "";
  const paperUrl = publication.url || doiUrl;
  const hasTags = (publication.tags?.length ?? 0) > 0;
  const isOngoing = publication.type === "ongoing";
  const statusColor = isOngoing ? "#fbbf24" : "#6ee7b7";

  return (
    <main className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <PublicationSeo publication={publication} />

      {/* Hero: status → title → authors → venue, the order a reader expects. */}
      <header
        className="border-b border-white/10 px-4 py-16 text-white print:border-slate-200 print:bg-white print:py-6 print:text-slate-900"
        style={{ background: "var(--color-primary)" }}
      >
        <div className="mx-auto max-w-5xl">
          <p
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold uppercase tracking-[.16em]"
            style={{ color: statusColor }}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {isOngoing ? "Ongoing research" : "Published"}
            <span aria-hidden="true" className="text-white/40">
              /
            </span>
            <span className="text-white/70 [font-variant-numeric:tabular-nums]">
              {publication.year}
            </span>
          </p>

          <h1 className="mt-5 max-w-4xl text-[28px] font-bold leading-[1.2] tracking-[-0.02em] md:text-[42px] print:text-2xl">
            {publication.title}
          </h1>

          {authors.length > 0 && (
            <div className="mt-6 max-w-3xl">
              <h2 className="sr-only">Authors</h2>
              <AuthorList authors={authors} variant="inline" />
            </div>
          )}

          {publication.journal && (
            <p className="mt-3 max-w-3xl text-[15px] italic leading-7 text-white/70 print:text-slate-600">
              {publication.journal}
            </p>
          )}
        </div>
      </header>

      {/* Back control lives here, on the page surface, where it reads clearly. */}
      <nav aria-label="Breadcrumb" className="mx-auto max-w-5xl px-4 pt-8">
        <BackToPublications />
      </nav>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_300px] print:block">
        <div className="min-w-0">
          <article
            aria-labelledby="abstract-heading"
            className={`${PANEL} p-6 md:p-9 print:border-0 print:p-0 print:shadow-none`}
          >
            <h2 id="abstract-heading" className={EYEBROW}>
              Abstract
            </h2>

            <p className="mt-5 max-w-[68ch] whitespace-pre-line text-[15.5px] leading-[1.75] text-slate-700">
              {publication.abstract || "No abstract has been provided for this publication."}
            </p>

            {hasTags && (
              <>
                <h2 className="sr-only">Topics</h2>
                <ul className="mt-8 flex flex-wrap gap-2 border-t border-slate-100 pt-6">
                  {publication.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>

          <CitationExport publication={publication} />
          <RelatedPublications publications={related} />
        </div>

        <aside
          aria-labelledby="record-heading"
          className={`${PANEL} h-fit p-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto print:hidden`}
        >
          <h2 id="record-heading" className={EYEBROW}>
            Publication record
          </h2>

          <dl className="mt-5 grid gap-4">
            {publication.journal && (
              <Field label="Published in">
                <dd className="mt-1.5 text-sm font-medium leading-6 text-slate-700">
                  {publication.journal}
                </dd>
              </Field>
            )}

            <Field label="Year">
              <dd className="mt-1.5 text-sm font-medium text-slate-700 [font-variant-numeric:tabular-nums]">
                {publication.year}
              </dd>
            </Field>

            <Field label="Status">
              <dd className="mt-1.5 text-sm font-medium text-slate-700">
                {isOngoing ? "In progress" : "Published"}
              </dd>
            </Field>

            {publication.doi && (
              <Field label="DOI">
                <dd className="mt-1.5 break-all text-sm font-medium">
                  <a
                    href={doiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-sm underline decoration-slate-300 underline-offset-4 transition hover:decoration-current ${FOCUS}`}
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {publication.doi}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </dd>
              </Field>
            )}
          </dl>

          {paperUrl && (
            <a
              href={paperUrl}
              target="_blank"
              rel="noreferrer"
              className={`mt-6 block rounded-xl px-4 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90 ${FOCUS}`}
              style={{ background: "var(--color-secondary)" }}
            >
              Read the full paper <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </aside>
      </div>
    </main>
  );
};

export default PublicationDetail;
