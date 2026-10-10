import React, { useMemo, useState } from "react";
import EditableText from "../components/EditableText";
import PageHero from "../components/PageHero";
import PageSearchBar, { SearchBarSelect, SearchBarTabs } from "../components/PageSearchBar";
import PublicationCard from "../components/PublicationCard";
import { PublicationPanel } from "../components/PublicationDrawer";
import SideDrawer from "../components/SideDrawer";
import SplitView, { useSplitRoute } from "../components/SplitView";
import { usePublications, useSiteContent } from "../firebase/hooks";
import type { Publication } from "../types";

function groupByYear(list: Publication[]): Record<number, Publication[]> {
  return list.reduce(
    (acc, p) => {
      acc[p.year] = acc[p.year] ? [...acc[p.year], p] : [p];
      return acc;
    },
    {} as Record<number, Publication[]>,
  );
}

type Tab = "all" | "ongoing" | "published";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2";

const Publications: React.FC = () => {
  const { ongoing, published, loading } = usePublications();
  const { content } = useSiteContent();
  /* An open paper is /publications/<id>: beside the list on desktop, in a
     bottom sheet on phones — the reader never leaves this page. */
  const { openId, isDesktop, open: openPaper, close: closePaper } = useSplitRoute("/publications");

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");

  const allYears = useMemo(() => {
    const set = new Set([...ongoing, ...published].map((p) => p.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [ongoing, published]);

  const allTags = useMemo(() => {
    const set = new Set([...ongoing, ...published].flatMap((p) => p.tags ?? []));
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

  const showOngoing = (tab === "all" || tab === "ongoing") && filteredOngoing.length > 0;
  const showPublished = (tab === "all" || tab === "published") && filteredPublished.length > 0;
  const totalShown =
    (tab === "all" || tab === "ongoing" ? filteredOngoing.length : 0) +
    (tab === "all" || tab === "published" ? filteredPublished.length : 0);

  const openDetails = (publication: Publication) => openPaper(publication.id);
  const openTitle = [...ongoing, ...published].find((p) => p.id === openId)?.title ?? "Publication";

  const stats = [
    {
      key: "published",
      value: published.length,
      label: (
        <EditableText
          id="publications.stats.published"
          defaultValue={content["publications.stats.published"] ?? "Published"}
          className="inline"
        />
      ),
    },
    {
      key: "ongoing",
      value: ongoing.length,
      label: (
        <EditableText
          id="publications.stats.ongoing"
          defaultValue={content["publications.stats.ongoing"] ?? "Ongoing"}
          className="inline"
        />
      ),
    },
    {
      key: "topics",
      value: allTags.length,
      label: (
        <EditableText
          id="publications.stats.topics"
          defaultValue={content["publications.stats.topics"] ?? "Topics"}
          className="inline"
        />
      ),
    },
  ];

  const tabs: { id: Tab; count: number; label: React.ReactNode }[] = [
    {
      id: "all",
      count: filteredOngoing.length + filteredPublished.length,
      label: (
        <EditableText id="publications.tabs.all" defaultValue={content["publications.tabs.all"] ?? "All"} className="inline" />
      ),
    },
    {
      id: "published",
      count: filteredPublished.length,
      label: (
        <EditableText
          id="publications.tabs.published"
          defaultValue={content["publications.tabs.published"] ?? "Published"}
          className="inline"
        />
      ),
    },
    {
      id: "ongoing",
      count: filteredOngoing.length,
      label: (
        <EditableText
          id="publications.tabs.ongoing"
          defaultValue={content["publications.tabs.ongoing"] ?? "Ongoing"}
          className="inline"
        />
      ),
    },
  ];

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );

  if (isDesktop && openId) {
    const railList = [
      ...(tab === "all" || tab === "ongoing" ? filteredOngoing : []),
      ...(tab === "all" || tab === "published" ? filteredPublished : []),
    ];
    return (
      <SplitView
        section="Publications"
        items={railList.map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: [p.year, p.journal].filter(Boolean).join(" · "),
          leading: (
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: p.type === "ongoing" ? "#d97706" : "#059669" }}
            />
          ),
        }))}
        total={ongoing.length + published.length}
        activeId={openId}
        onSelect={openPaper}
        onClose={closePaper}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Find a paper…"
        current={openTitle}
      >
        <PublicationPanel id={openId} />
      </SplitView>
    );
  }

  return (
    <div style={{ background: "var(--color-bg)" }}>
      <PageHero
        bannerUrl={content["publications.bannerUrl"]}
        eyebrow={
          <EditableText
            id="publications.hero.labLabel"
            defaultValue={content["publications.hero.labLabel"] ?? "DASS Research Lounge"}
            className="inline"
          />
        }
        title={
          <EditableText
            id="publications.pageTitle"
            defaultValue={content["publications.pageTitle"] ?? "Publications"}
            className="inline"
          />
        }
        subtitle={
          <EditableText
            id="publications.pageSubtitle"
            defaultValue={content["publications.pageSubtitle"] ?? "Scroll down to see the publications"}
            className="inline"
          />
        }
      >
        <div className="flex flex-wrap justify-center gap-x-9 gap-y-3">
          {stats.map((s) => (
            <div key={s.key} className="flex items-baseline gap-2.5">
              <b
                className="text-2xl font-black leading-none tabular-nums"
                style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
              >
                {s.value}
              </b>
              <span className="text-[12.5px] text-white/60">{s.label}</span>
            </div>
          ))}
        </div>
      </PageHero>

      <PageSearchBar
        maxWidth="max-w-4xl"
        value={search}
        onChange={setSearch}
        placeholder="Search publications by title, author, journal or topic"
        filters={
          <>
            <SearchBarTabs ariaLabel="Publication status" tabs={tabs} value={tab} onChange={setTab} />
            {allYears.length > 1 && (
              <SearchBarSelect
                value={selectedYear}
                onChange={setSelectedYear}
                ariaLabel="Filter by year"
                options={[
                  { value: "", label: content["publications.filter.allYears"] ?? "All years" },
                  ...allYears.map((y) => ({ value: String(y), label: String(y) })),
                ]}
              />
            )}
            {allTags.length > 0 && (
              <SearchBarSelect
                value={selectedTag}
                onChange={setSelectedTag}
                ariaLabel="Filter by topic"
                options={[
                  { value: "", label: content["publications.filter.allTopics"] ?? "All topics" },
                  ...allTags.map((t) => ({ value: t, label: t })),
                ]}
              />
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className={`h-10 rounded-lg px-3 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${FOCUS}`}
              >
                <EditableText
                  id="publications.filter.clear"
                  defaultValue={content["publications.filter.clear"] ?? "Clear ×"}
                  className="inline"
                />
              </button>
            )}
          </>
        }
        status={`${totalShown} ${totalShown === 1 ? "result" : "results"}`}
      />

      <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        {showOngoing && (
          <section className="mb-10">
            <SectionHeader
              title={
                <EditableText
                  id="publications.ongoingTitle"
                  defaultValue={content["publications.ongoingTitle"] ?? "Ongoing Research"}
                  className="inline"
                />
              }
              subtitle={
                content["publications.ongoingSubtitle"] ? (
                  <EditableText
                    id="publications.ongoingSubtitle"
                    defaultValue={content["publications.ongoingSubtitle"]}
                    className="inline"
                  />
                ) : null
              }
              count={filteredOngoing.length}
            />
            <div className="grid gap-3">
              {filteredOngoing.map((p) => (
                <PublicationCard key={p.id} publication={p} onOpenDetails={() => openDetails(p)} />
              ))}
            </div>
          </section>
        )}

        {showPublished && (
          <section>
            <SectionHeader
              title={
                <EditableText
                  id="publications.publishedTitle"
                  defaultValue={content["publications.publishedTitle"] ?? "Published Research"}
                  className="inline"
                />
              }
              subtitle={
                content["publications.publishedSubtitle"] ? (
                  <EditableText
                    id="publications.publishedSubtitle"
                    defaultValue={content["publications.publishedSubtitle"]}
                    className="inline"
                  />
                ) : null
              }
              count={filteredPublished.length}
            />
            {sortedYears.map((year) => (
              <YearGroup
                key={year}
                year={year}
                publications={groupedPublished[year]}
                onOpenDetails={openDetails}
              />
            ))}
          </section>
        )}

        {totalShown === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
            <p className="text-base text-slate-500">
              <EditableText
                id="publications.empty.noResults"
                defaultValue={content["publications.empty.noResults"] ?? "No publications found."}
                className="inline"
              />
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className={`mt-5 rounded-lg px-5 py-2 text-sm font-semibold text-[color:var(--hero-text)] ${FOCUS}`}
                style={{ background: "var(--color-primary)" }}
              >
                <EditableText
                  id="publications.empty.clearFilters"
                  defaultValue={content["publications.empty.clearFilters"] ?? "Clear Filters"}
                  className="inline"
                />
              </button>
            )}
          </div>
        )}
      </div>

      <SideDrawer open={!isDesktop && Boolean(openId)} onClose={closePaper} eyebrow="Publication" title={openTitle} mobileHeight={88}>
        {openId && <PublicationPanel id={openId} />}
      </SideDrawer>
    </div>
  );
};

// ── Section heading ────────────────────────────────────────────
const SectionHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  count: number;
}> = ({ title, subtitle, count }) => (
  <div className="mb-4">
    <div className="flex items-baseline gap-2">
      <h2
        className="text-[17px] font-bold tracking-[-0.01em] text-slate-900"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h2>
      <span className="text-[13px] font-semibold tabular-nums text-slate-400">{count}</span>
    </div>
    {subtitle && <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>}
  </div>
);

// ── Year group ─────────────────────────────────────────────────
const YearGroup: React.FC<{
  year: number;
  publications: Publication[];
  onOpenDetails: (publication: Publication) => void;
}> = ({ year, publications, onOpenDetails }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className={`group mb-2.5 flex w-full items-center gap-3 rounded-md text-left ${FOCUS}`}
      >
        <span className="text-[15px] font-black tabular-nums text-slate-800" style={{ fontFamily: "var(--font-heading)" }}>
          {year}
        </span>
        <span className="text-xs text-slate-400">
          {publications.length} {publications.length === 1 ? "paper" : "papers"}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
          className={`text-slate-400 transition-transform group-hover:text-slate-600 ${collapsed ? "-rotate-90" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span className="sr-only">{collapsed ? "Show" : "Hide"} {year}</span>
      </button>
      {!collapsed && (
        <div className="grid gap-3">
          {publications.map((p) => (
            <PublicationCard key={p.id} publication={p} hideYear onOpenDetails={() => onOpenDetails(p)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Publications;
