import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CollaboratorCard from "../components/CollaboratorCard";
import CollaboratorRequestForm from "../components/CollaboratorRequestForm";
import EditableText from "../components/EditableText";
import FilterSelect from "../components/FilterSelect";
import SearchField from "../components/SearchField";
import { useCollaborators, useSiteContent } from "../firebase/hooks";

/**
 * Read once here rather than once per card — the page already knows who runs
 * the lab, and passing it down keeps CollaboratorCard renderable in tests and
 * Storybook where import.meta.env doesn't exist.
 */
const LAB_HEAD_UID = String(import.meta.env?.VITE_LAB_HEAD_UID ?? "").trim();

/** Query-string keys. Short and readable — these end up in shared links. */
const PARAM = { search: "q", designation: "role", affiliation: "org" } as const;

const SKELETON_COUNT = 8;

const norm = (value?: string | null) => (value ?? "").trim().toLowerCase();

const Icon = {
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <path d="M16 5.5a3.2 3.2 0 010 6M17.5 20c0-2.4-.9-4.5-2.4-6" strokeLinecap="round" />
    </svg>
  ),
};

/**
 * Mirrors the card's real proportions — image block, two lines of caption, a
 * chip row, an icon row. A spinner tells you nothing and then dumps the whole
 * grid in at once; this holds the layout so nothing jumps when data lands.
 */
const CardSkeleton: React.FC = () => (
  <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="aspect-[4/3] animate-pulse bg-slate-200" />
    <div className="p-4">
      <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
      <div className="mt-4 flex gap-1.5">
        <div className="h-5 w-20 animate-pulse rounded-md bg-slate-100" />
        <div className="h-5 w-16 animate-pulse rounded-md bg-slate-100" />
      </div>
      <div className="mt-4 flex gap-1">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  </li>
);

const FilterChip: React.FC<{ label: string; value: string; onRemove: () => void }> = ({
  label,
  value,
  onRemove,
}) => (
  <button
    type="button"
    onClick={onRemove}
    className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-2 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2"
  >
    <span className="text-slate-400">{label}</span>
    <span className="truncate">{value}</span>
    <span
      aria-hidden="true"
      className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-slate-200 group-hover:text-slate-700"
    >
      {Icon.close}
    </span>
    <span className="sr-only">— remove this filter</span>
  </button>
);

const Collaborators: React.FC = () => {
  const { collaborators, loading } = useCollaborators();
  const { content } = useSiteContent();
  const navigate = useNavigate();

  /**
   * Filters live in the URL, not in useState. Three things that were broken
   * before now work: a filtered view can be shared or bookmarked, opening a
   * profile and pressing Back returns to the same filtered grid instead of a
   * reset page, and a reload keeps your place.
   *
   * replace: true on every write, so typing a name doesn't push twenty entries
   * onto the history stack and turn Back into a game of chance.
   */
  const [params, setParams] = useSearchParams();
  const search = params.get(PARAM.search) ?? "";
  const designationFilter = params.get(PARAM.designation) ?? "";
  const affiliationFilter = params.get(PARAM.affiliation) ?? "";

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(params);
    Object.values(PARAM).forEach((key) => next.delete(key));
    setParams(next, { replace: true });
  }, [params, setParams]);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<HTMLElement>(null);

  /** "/" jumps to search, the convention on every directory people already use. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      toolbarRef.current?.querySelector("input")?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /**
   * Scrolling without moving focus strands keyboard users: the page travels,
   * their next Tab doesn't. tabIndex={-1} on the target plus .focus() takes
   * them along. Honour reduced motion while we're here — a long smooth scroll
   * is exactly the pattern that triggers vestibular symptoms.
   */
  const goToRequestForm = useCallback(() => {
    const node = requestRef.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    node.focus({ preventScroll: true });
  }, []);

  /** Lab head first, then alphabetical. Firestore order is arbitrary otherwise. */
  const ordered = useMemo(() => {
    const rank = (uid?: string) => (LAB_HEAD_UID !== "" && uid === LAB_HEAD_UID ? 0 : 1);
    return [...collaborators].sort(
      (a, b) => rank(a.uid) - rank(b.uid) || a.name.localeCompare(b.name),
    );
  }, [collaborators]);

  const designationOptions = useMemo(
    () =>
      Array.from(
        new Set(ordered.map((c) => c.designation?.trim()).filter((v): v is string => !!v)),
      ).sort((a, b) => a.localeCompare(b)),
    [ordered],
  );

  const affiliationOptions = useMemo(
    () =>
      Array.from(
        new Set(ordered.map((c) => c.affiliation?.trim()).filter((v): v is string => !!v)),
      ).sort((a, b) => a.localeCompare(b)),
    [ordered],
  );

  /**
   * Deferred: keystrokes paint immediately and the grid catches up. With the
   * card memoised this keeps typing smooth on a large directory without the
   * lag a debounce timer introduces.
   */
  const deferredSearch = useDeferredValue(search);
  const isStale = deferredSearch !== search;

  const filtered = useMemo(() => {
    const term = norm(deferredSearch);
    return ordered.filter((c) => {
      if (designationFilter && c.designation?.trim() !== designationFilter) return false;
      if (affiliationFilter && c.affiliation?.trim() !== affiliationFilter) return false;
      if (!term) return true;
      return (
        norm(c.name).includes(term) ||
        norm(c.affiliation).includes(term) ||
        norm(c.designation).includes(term) ||
        (c.researchInterests ?? []).some((r) => norm(r).includes(term))
      );
    });
  }, [ordered, designationFilter, affiliationFilter, deferredSearch]);

  const hasActiveFilter = Boolean(designationFilter || affiliationFilter || search);
  const bannerUrl = content["collaborators.bannerUrl"];

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section
        className="relative flex min-h-[340px] items-center justify-center overflow-hidden px-4 py-20 text-center"
        style={{ background: "var(--color-primary)" }}
      >
        {bannerUrl && (
          <>
            <img
              src={bannerUrl}
              alt=""
              /* The LCP element on this page: never lazy, always early. */
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* A gradient scrim rather than brightness(0.45) on the image. The
                filter dims the whole photo evenly, which is both flatter and
                weakest exactly where the text sits. */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 55%, transparent) 0%, color-mix(in srgb, var(--color-primary) 88%, black) 100%)",
              }}
            />
          </>
        )}

        <div className="relative z-10 max-w-2xl">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--color-accent)" }}
          >
            <EditableText
              id="collaborators.eyebrow"
              defaultValue={content["collaborators.eyebrow"] ?? "The network"}
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
            />
          </p>

          <h1
            className="mt-3 font-black text-white"
            style={{ fontSize: "clamp(2rem,4vw,3rem)", fontFamily: "var(--font-heading)" }}
          >
            <EditableText
              id="collaborators.pageTitle"
              defaultValue={content["collaborators.pageTitle"] ?? "Our Collaborators"}
              className="font-black text-white"
            />
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/75">
            <EditableText
              id="collaborators.pageSubtitle"
              defaultValue={content["collaborators.pageSubtitle"] ?? ""}
              className="text-base leading-relaxed"
            />
          </p>

          <button
            type="button"
            onClick={goToRequestForm}
            className="mt-7 rounded-xl px-8 py-3 text-sm font-bold shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-safe:hover:-translate-y-0.5"
            style={{ background: "var(--color-accent)", color: "#1f2937" }}
          >
            <EditableText
              id="collaborators.requestCta"
              defaultValue={content["collaborators.requestCta"] ?? "Become a Collaborator"}
              className="text-sm font-bold"
            />
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------ Toolbar */}
      {/* Sticky: on a four-column grid you are several screens from the filters
          by the time you decide to change them. */}
      {!loading && collaborators.length > 0 && (
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 py-3" ref={toolbarRef}>
            <div className="flex flex-wrap items-center gap-3">
              <SearchField
                className="min-w-[240px] flex-1"
                value={search}
                onChange={(value: string) => setParam(PARAM.search, value)}
                placeholder="Search by name, university, or interest…"
                ariaLabel="Search collaborators"
              />
              <FilterSelect
                value={designationFilter}
                onChange={(value: string) => setParam(PARAM.designation, value)}
                ariaLabel="Filter by designation"
                className="min-w-[190px]"
                options={[
                  { value: "", label: "All Designations" },
                  ...designationOptions.map((value) => ({ value, label: value })),
                ]}
              />
              <FilterSelect
                value={affiliationFilter}
                onChange={(value: string) => setParam(PARAM.affiliation, value)}
                ariaLabel="Filter by university"
                className="min-w-[210px]"
                options={[
                  { value: "", label: "All Universities" },
                  ...affiliationOptions.map((value) => ({ value, label: value })),
                ]}
              />

              {/* Not red. Clearing a filter isn't destructive, and spending the
                  danger colour here leaves nothing to say it with later. */}
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2"
                >
                  Clear all
                </button>
              )}

              {/* role=status: the count changes as you type, and someone who
                  can't see the grid shrink needs to be told that it did. */}
              <p
                role="status"
                aria-live="polite"
                className={`ml-auto text-xs font-semibold tabular-nums transition-opacity ${
                  isStale ? "opacity-50" : "opacity-100"
                } text-slate-400`}
              >
                {filtered.length === collaborators.length
                  ? `${collaborators.length} collaborators`
                  : `${filtered.length} of ${collaborators.length} shown`}
              </p>
            </div>

            {/* Chips make it obvious *what* is filtered, and let you drop one
                without losing the rest — the old bar only offered all-or-nothing. */}
            {hasActiveFilter && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {search && (
                  <FilterChip
                    label="Search"
                    value={search}
                    onRemove={() => setParam(PARAM.search, "")}
                  />
                )}
                {designationFilter && (
                  <FilterChip
                    label="Role"
                    value={designationFilter}
                    onRemove={() => setParam(PARAM.designation, "")}
                  />
                )}
                {affiliationFilter && (
                  <FilterChip
                    label="University"
                    value={affiliationFilter}
                    onRemove={() => setParam(PARAM.affiliation, "")}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- Results */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="sr-only">Collaborators</h2>

        {loading ? (
          <ul
            aria-busy="true"
            aria-label="Loading collaborators"
            className="mb-20 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </ul>
        ) : collaborators.length === 0 ? (
          /* Nothing exists yet — a different situation from "nothing matched",
             and the old page showed the filter message for both. An empty
             screen is an invitation to act, so it points at the form. */
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              {Icon.users}
            </span>
            <p className="mt-5 text-lg font-semibold text-slate-700">
              <EditableText
                id="collaborators.emptyTitle"
                defaultValue="No collaborators listed yet"
                className="text-lg font-semibold"
              />
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              <EditableText
                id="collaborators.emptyBody"
                defaultValue="This is where the network will appear. Be the first to join it."
                className="text-sm leading-relaxed"
              />
            </p>
            <button
              type="button"
              onClick={goToRequestForm}
              className="mt-6 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
              style={{ background: "var(--color-primary)" }}
            >
              Become a collaborator
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              {Icon.search}
            </span>
            <p className="mt-5 text-lg font-semibold text-slate-700">No one matches those filters</p>
            {/* Name what was searched — vague empty states leave people
                re-reading their own query to work out what happened. */}
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {search ? (
                <>
                  Nothing found for <span className="font-medium text-slate-700">“{search}”</span>.
                  Try a broader term, or drop a filter.
                </>
              ) : (
                <>Try a different combination — or clear the filters to see everyone.</>
              )}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
              style={{ background: "var(--color-primary)" }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* A real list, so a screen reader announces how many people are here
             before reading them. role="list" because Safari drops list
             semantics the moment list-style is removed. */
          <ul
            role="list"
            className={`mb-20 grid list-none grid-cols-1 gap-6 p-0 transition-opacity duration-150 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
              isStale ? "opacity-60" : "opacity-100"
            }`}
          >
            {filtered.map((c) => (
              <li key={c.id}>
                <CollaboratorCard
                  collaborator={c}
                  isLabHead={LAB_HEAD_UID !== "" && c.uid === LAB_HEAD_UID}
                  /* Guard the uid: without it this navigated to
                     /collaborators/undefined and rendered a dead profile page. */
                  onClick={
                    c.uid
                      ? () => navigate(`/collaborators/${encodeURIComponent(c.uid)}`)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------------- Request */}
      <section
        id="collaborator-request"
        ref={requestRef}
        tabIndex={-1}
        aria-labelledby="collaborator-request-title"
        className="scroll-mt-20 border-t border-slate-200 bg-slate-50 px-4 py-14 focus:outline-none"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              <EditableText
                id="collaborators.joinNetwork"
                defaultValue="Join the Network"
                className="text-xs font-black uppercase tracking-[0.18em]"
              />
            </p>
            <div
              className="mx-auto mt-2 h-1 w-14 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
          </div>

          <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-md md:p-10">
            <div className="mb-6 text-center">
              <h2
                id="collaborator-request-title"
                className="mb-3 text-2xl font-black"
                style={{ color: "var(--color-primary)", fontFamily: "var(--font-heading)" }}
              >
                <EditableText
                  id="collaborators.requestTitle"
                  defaultValue={content["collaborators.requestTitle"] ?? "Become a Collaborator"}
                  className="text-2xl font-black"
                />
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                <EditableText
                  id="collaborators.requestSubtitle"
                  defaultValue={
                    content["collaborators.requestSubtitle"] ??
                    "Interested in joining our research community? Submit your request below and our admin will review your profile."
                  }
                  className="text-sm leading-relaxed"
                />
              </p>
            </div>
            <CollaboratorRequestForm />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Collaborators;
