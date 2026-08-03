import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import EditableText from "../components/EditableText";
import PublicationCard from "../components/PublicationCard";
import { usePublications, useSiteContent } from "../firebase/hooks";
import type { Publication, PublicationAuthorEntry } from "../types";

function groupByYear(list: Publication[]): Record<number, Publication[]> {
  return list.reduce(
    (acc, p) => {
      acc[p.year] = acc[p.year] ? [...acc[p.year], p] : [p];
      return acc;
    },
    {} as Record<number, Publication[]>,
  );
}

const Publications: React.FC = () => {
  const { ongoing, published, loading } = usePublications();
  const { content } = useSiteContent();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "ongoing" | "published">("all");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedPublication, setSelectedPublication] =
    useState<Publication | null>(null);

  const toAuthorEntries = (
    publication: Publication,
  ): PublicationAuthorEntry[] => {
    if (publication.authorEntries?.length) return publication.authorEntries;
    return (publication.authors || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ type: "external", name }));
  };

  const allYears = useMemo(() => {
    const set = new Set([...ongoing, ...published].map((p) => p.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [ongoing, published]);

  const allTags = useMemo(() => {
    const set = new Set(
      [...ongoing, ...published].flatMap((p) => p.tags ?? []),
    );
    return Array.from(set).sort();
  }, [ongoing, published]);

  const filter = (list: Publication[]) =>
    list.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.journal.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q));
      const matchYear = !selectedYear || String(p.year) === selectedYear;
      const matchTag = !selectedTag || p.tags?.includes(selectedTag);
      return matchSearch && matchYear && matchTag;
    });

  const filteredOngoing = filter(ongoing);
  const filteredPublished = filter(published);
  const groupedPublished = groupByYear(filteredPublished);
  const sortedYears = Object.keys(groupedPublished)
    .map(Number)
    .sort((a, b) => b - a);

  const hasFilters = !!(search || selectedYear || selectedTag);
  const clearFilters = () => {
    setSearch("");
    setSelectedYear("");
    setSelectedTag("");
  };

  const totalShown =
    (tab === "all" || tab === "ongoing" ? filteredOngoing.length : 0) +
    (tab === "all" || tab === "published" ? filteredPublished.length : 0);

  const stats = [
    {
      key: 'published',
      value: published.length,
      label: (
        <EditableText
          id="publications.stats.published"
          defaultValue={content["publications.stats.published"] ?? "Published"}
          aria-label="Edit published stat label"
          className="text-xs mt-1.5 font-medium"
        />
      ),
    },
    {
      key: 'ongoing',
      value: ongoing.length,
      label: (
        <EditableText
          id="publications.stats.ongoing"
          defaultValue={content["publications.stats.ongoing"] ?? "Ongoing"}
          aria-label="Edit ongoing stat label"
          className="text-xs mt-1.5 font-medium"
        />
      ),
    },
    {
      key: 'topics',
      value: [
        ...new Set([...ongoing, ...published].flatMap((p) => p.tags ?? [])),
      ].length,
      label: (
        <EditableText
          id="publications.stats.topics"
          defaultValue={content["publications.stats.topics"] ?? "Topics"}
          aria-label="Edit topics stat label"
          className="text-xs mt-1.5 font-medium"
        />
      ),
    },
  ];

  if (loading)
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

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px",
    border: "none",
    borderBottom: active
      ? "2px solid var(--color-primary)"
      : "2px solid transparent",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? "var(--color-primary)" : "#6b7280",
    background: "transparent",
    transition: "color 0.15s",
    whiteSpace: "nowrap",
  });

  const selectStyle: React.CSSProperties = {
    padding: "7px 28px 7px 10px",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    color: "#374151",
    background: "white",
    cursor: "pointer",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
  };

  return (
    <div>
      {/* Hero */}
      <section
        className="relative min-h-[320px] overflow-hidden py-20 text-center px-4 flex items-center justify-center"
        style={{ background: "var(--color-primary)" }}
      >
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Accent glow */}
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{
            background: "var(--color-accent)",
            transform: "translate(30%, 40%)",
          }}
        />

        {content["publications.bannerUrl"] && (
          <img
            src={content["publications.bannerUrl"]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.35)" }}
          />
        )}
        <div className="relative z-10">
          <div className="max-w-4xl mx-auto">
            <div
              className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border"
              style={{
                borderColor: "rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--color-secondary)" }}
              />
              <EditableText
                id="publications.hero.labLabel"
                defaultValue={content["publications.hero.labLabel"] ?? "DASS Research Lounge"}
                aria-label="Edit lab label"
                className="text-xs color-var(--font-heading) font-bold tracking-widest uppercase"
              />
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
                id="publications.pageTitle"
                defaultValue={content["publications.pageTitle"] ?? "Publications"}
                aria-label="Edit publications page title"
                className="font-black text-white"
              />
            </h1>
            <div
              className="mx-auto mb-5 h-1 w-16 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
            <p
              className="text-base max-w-2xl mx-auto leading-relaxed"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              <EditableText
                id="publications.pageSubtitle"
                defaultValue={content["publications.pageSubtitle"] ?? "Scroll down to see the publications"}
                aria-label="Edit publications page subtitle"
                className="text-base max-w-2xl mx-auto leading-relaxed"
              />
            </p>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section style={{ background: "var(--color-primary)" }}>
        <div
          className="max-w-3xl mx-auto px-4 grid grid-cols-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          {stats.map((s, i) => (
            <div
              key={s.key}
              className="text-center py-6 px-4"
              style={{
                borderRight:
                  i < stats.length - 1
                    ? "1px solid rgba(255,255,255,0.1)"
                    : "none",
              }}
            >
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
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Filter bar */}
        <div
          className="bg-white rounded-xl p-3 mb-6 flex flex-wrap items-center gap-3"
          style={{ border: "1px solid #e2e8f0" }}
        >
          <div className="relative flex-1" style={{ minWidth: 180 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, author, journal..."
              className="w-full text-sm outline-none rounded-lg"
              style={{
                padding: "7px 12px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                fontSize: 13,
              }}
            />
          </div>
          {allYears.length > 1 && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                ...selectStyle,
                borderColor: selectedYear ? "var(--color-primary)" : "#e2e8f0",
                color: selectedYear ? "var(--color-primary)" : "#374151",
              }}
            >
              <option value="">
                <EditableText
                  id="publications.filter.allYears"
                  defaultValue={content["publications.filter.allYears"] ?? "All Years"}
                  aria-label="Edit all years filter label"
                  className="text-xs"
                />
              </option>
              {allYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          )}
          {allTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              style={{
                ...selectStyle,
                borderColor: selectedTag ? "var(--color-primary)" : "#e2e8f0",
                color: selectedTag ? "var(--color-primary)" : "#374151",
              }}
            >
              <option value="">
                <EditableText
                  id="publications.filter.allTopics"
                  defaultValue={content["publications.filter.allTopics"] ?? "All Topics"}
                  aria-label="Edit all topics filter label"
                  className="text-xs"
                />
              </option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold px-3 py-1.5 rounded border-none cursor-pointer"
              style={{ background: "#fee2e2", color: "#991b1b" }}
            >
              <EditableText
                id="publications.filter.clear"
                defaultValue={content["publications.filter.clear"] ?? "Clear ×"}
                aria-label="Edit clear filter label"
                className="text-xs font-semibold"
              />
            </button>
          )}
          <span className="ml-auto text-xs" style={{ color: "#94a3b8" }}>
            {totalShown} <EditableText
              id="publications.filter.results"
              defaultValue={content["publications.filter.results"] ?? "result"}
              aria-label="Edit results label"
              className="text-xs"
            />{totalShown !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tabs */}
        <div
          className="flex border-b mb-8 overflow-x-auto"
          style={{ borderColor: "#e2e8f0" }}
        >
          <button style={tabStyle(tab === "all")} onClick={() => setTab("all")}> 
            <EditableText
              id="publications.tabs.all"
              defaultValue={content["publications.tabs.all"] ?? "All"}
              aria-label="Edit all tab label"
              className="text-sm font-semibold"
            /> ({filteredOngoing.length + filteredPublished.length})
          </button>
          <button
            style={tabStyle(tab === "ongoing")}
            onClick={() => setTab("ongoing")}
          >
            <EditableText
              id="publications.tabs.ongoing"
              defaultValue={content["publications.tabs.ongoing"] ?? "Ongoing"}
              aria-label="Edit ongoing tab label"
              className="text-sm font-semibold"
            /> ({filteredOngoing.length})
          </button>
          <button
            style={tabStyle(tab === "published")}
            onClick={() => setTab("published")}
          >
            <EditableText
              id="publications.tabs.published"
              defaultValue={content["publications.tabs.published"] ?? "Published"}
              aria-label="Edit published tab label"
              className="text-sm font-semibold"
            /> ({filteredPublished.length})
          </button>
        </div>

        {/* Ongoing */}
        {(tab === "all" || tab === "ongoing") && filteredOngoing.length > 0 && (
          <div className="mb-12">
            <SectionHeader
              title={
                <EditableText
                  id="publications.ongoingTitle"
                  defaultValue={content["publications.ongoingTitle"] ?? "Ongoing Research"}
                  aria-label="Edit ongoing section title"
                  className="font-black text-lg"
                />
              }
              subtitle={
                <EditableText
                  id="publications.ongoingSubtitle"
                  defaultValue={content["publications.ongoingSubtitle"] ?? ""}
                  aria-label="Edit ongoing section subtitle"
                  className="text-sm text-gray-500 ml-3"
                />
              }
              count={filteredOngoing.length}
              accentColor="#d97706"
            />
            <div className="flex flex-col gap-3">
              {filteredOngoing.map((p) => (
                <PublicationCard
                  key={p.id}
                  publication={p}
                  onOpenDetails={() => navigate(`/publications/${p.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Published — grouped by year */}
        {(tab === "all" || tab === "published") &&
          filteredPublished.length > 0 && (
            <div>
              <SectionHeader
                title={
                  <EditableText
                    id="publications.publishedTitle"
                    defaultValue={content["publications.publishedTitle"] ?? "Published Research"}
                    aria-label="Edit published section title"
                    className="font-black text-lg"
                  />
                }
                subtitle={
                  <EditableText
                    id="publications.publishedSubtitle"
                    defaultValue={content["publications.publishedSubtitle"] ?? ""}
                    aria-label="Edit published section subtitle"
                    className="text-sm text-gray-500 ml-3"
                  />
                }
                count={filteredPublished.length}
                accentColor="var(--color-primary)"
              />
              {sortedYears.map((year) => (
                <YearGroup
                  key={year}
                  year={year}
                  publications={groupedPublished[year]}
                    onOpenDetails={(publication) => navigate(`/publications/${publication.id}`)}
                  content={Object.fromEntries(Object.entries(content).map(([k, v]) => [k, v ?? ""]))}
                />
              ))}
            </div>
          )}

        {/* Empty */}
        {totalShown === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-base">
              <EditableText
                id="publications.empty.noResults"
                defaultValue={content["publications.empty.noResults"] ?? "No publications found."}
                aria-label="Edit no publications found label"
                className="text-gray-400 text-base"
              />
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 text-sm font-semibold px-5 py-2 rounded-lg text-white border-none cursor-pointer"
                style={{ background: "var(--color-primary)" }}
              >
                <EditableText
                  id="publications.empty.clearFilters"
                  defaultValue={content["publications.empty.clearFilters"] ?? "Clear Filters"}
                  aria-label="Edit clear filters label"
                  className="text-sm font-semibold"
                />
              </button>
            )}
          </div>
        )}
      </div>

      {selectedPublication && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4"
          onClick={() => setSelectedPublication(null)}
        >
          <div
            className="mt-8 w-full max-w-2xl rounded-3xl border bg-white p-6 shadow-2xl"
            style={{ borderColor: "#dbe5dd" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 font-semibold">
                  <EditableText
                    id="publications.modal.detailsLabel"
                    defaultValue={content["publications.modal.detailsLabel"] ?? "Publication details"}
                    aria-label="Edit publication details label"
                    className="text-[11px] uppercase tracking-[0.18em] text-gray-400 font-semibold"
                  />
                </p>
                <h3 className="mt-1 text-2xl font-black text-gray-900 leading-snug">
                  {selectedPublication.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedPublication.journal} · {selectedPublication.year}
                </p>
              </div>
              <button
                className="h-10 w-10 rounded-full border border-slate-200 text-xl font-black text-slate-500"
                onClick={() => setSelectedPublication(null)}
              >
                ×
              </button>
            </div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold mb-2">
                <EditableText
                  id="publications.modal.authorsLabel"
                  defaultValue={content["publications.modal.authorsLabel"] ?? "Authors"}
                  aria-label="Edit authors label"
                  className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold mb-2"
                />
              </p>
              <div className="flex flex-wrap gap-2">
                {toAuthorEntries(selectedPublication).map((author, idx) => (
                  <div key={`${author.name}-${idx}`}>
                    {author.type === "linked" && author.uid ? (
                      <Link
                        to={`/collaborators/${author.uid}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 no-underline text-sm text-slate-700 hover:border-[var(--color-primary)]"
                      >
                        {author.photo ? (
                          <img
                            src={author.photo}
                            alt={author.name}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                            {author.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        {author.name}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-slate-600">
                          {author.name.charAt(0).toUpperCase()}
                        </span>
                        {author.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold mb-2">
                <EditableText
                  id="publications.modal.abstractLabel"
                  defaultValue={content["publications.modal.abstractLabel"] ?? "Abstract"}
                  aria-label="Edit abstract label"
                  className="text-xs uppercase tracking-[0.16em] text-gray-400 font-semibold mb-2"
                />
              </p>
              <p
                className="text-sm leading-relaxed text-slate-700"
                style={{ whiteSpace: "pre-line" }}
              >
                {selectedPublication.abstract || (
                  <EditableText
                    id="publications.modal.noAbstract"
                    defaultValue={content["publications.modal.noAbstract"] ?? "No abstract available."}
                    aria-label="Edit no abstract label"
                    className="text-sm leading-relaxed text-slate-700"
                  />
                )}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <a
                href={
                  selectedPublication.url ||
                  (selectedPublication.doi
                    ? `https://doi.org/${selectedPublication.doi}`
                    : "#")
                }
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white no-underline"
              >
                <EditableText
                  id="publications.modal.viewFullPaper"
                  defaultValue={content["publications.modal.viewFullPaper"] ?? "View Full Paper"}
                  aria-label="Edit view full paper label"
                  className="text-sm font-bold text-white"
                />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Section heading ────────────────────────────────────────────
const SectionHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  count: number;
  accentColor: string;
}> = ({ title, subtitle, count, accentColor }) => (
  <div className="mb-5">
    <div className="flex items-center gap-2 mb-1">
      <div
        className="w-0.5 h-5 rounded-full flex-shrink-0"
        style={{ background: accentColor }}
      />
      <h2
        className="font-black text-lg"
        style={{
          color: "var(--color-primary)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {title}
      </h2>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded"
        style={{ background: "#f1f5f9", color: "#475569" }}
      >
        {count}
      </span>
    </div>
    {subtitle && <p className="text-sm text-gray-500 ml-3">{subtitle}</p>}
  </div>
);

// ── Year group ─────────────────────────────────────────────────
interface YearGroupProps {
  year: number;
  publications: Publication[];
  onOpenDetails: (publication: Publication) => void;
  content: Record<string, string>;
}
const YearGroup: React.FC<YearGroupProps> = ({ year, publications, onOpenDetails, content }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-8">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-3 w-full text-left mb-3 bg-transparent border-none cursor-pointer"
      >
        <span
          className="text-sm font-black px-3 py-1 rounded"
          style={{ background: "var(--color-primary)", color: "white" }}
        >
          {year}
        </span>
        <span className="text-xs text-gray-400">
          {publications.length} <EditableText
            id="publications.yearGroup.paperLabel"
            defaultValue={content["publications.yearGroup.paperLabel"] ?? "paper"}
            aria-label="Edit paper label"
            className="text-xs text-gray-400"
          />{publications.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1 h-px" style={{ background: "#e2e8f0" }} />
        <span className="text-xs text-gray-400">
          {collapsed ? (
            <EditableText
              id="publications.yearGroup.show"
              defaultValue={content["publications.yearGroup.show"] ?? "▼ show"}
              aria-label="Edit show label"
              className="text-xs text-gray-400"
            />
          ) : (
            <EditableText
              id="publications.yearGroup.hide"
              defaultValue={content["publications.yearGroup.hide"] ?? "▲ hide"}
              aria-label="Edit hide label"
              className="text-xs text-gray-400"
            />
          )}
        </span>
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-3">
          {publications.map((p) => (
            <PublicationCard
              key={p.id}
              publication={p}
              onOpenDetails={() => onOpenDetails(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Publications;
