import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import CollaboratorCard from "../components/CollaboratorCard";
import CollaboratorRequestForm from "../components/CollaboratorRequestForm";
import EditableText from "../components/EditableText";
import PageHero from "../components/PageHero";
import PageSearchBar, { SearchBarSelect } from "../components/PageSearchBar";
import SideDrawer from "../components/SideDrawer";
import { useAuth } from "../context/AuthContext";
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

/** Deep-link fragment that opens the request form drawer. */
const REQUEST_HASH = "collaborator-request";

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
  /* Chat is for collaborators and the lab head; everyone else sees no button. */
  const { appUser } = useAuth();
  const canMessage = appUser?.role === "collaborator" || appUser?.role === "lab_head";

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

  const location = useLocation();
  // Other pages link to /collaborators#collaborator-request; that still opens the form.
  const [requestOpen, setRequestOpen] = useState(location.hash === `#${REQUEST_HASH}`);

  useEffect(() => {
    if (location.hash === `#${REQUEST_HASH}`) setRequestOpen(true);
  }, [location.hash]);

  const closeRequestForm = useCallback(() => {
    setRequestOpen(false);
    if (window.location.hash === `#${REQUEST_HASH}`) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }
  }, [navigate, location.pathname, location.search]);

  const goToRequestForm = useCallback(() => setRequestOpen(true), []);

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
      <PageHero
        bannerUrl={bannerUrl}
        eyebrow={
          <EditableText
            id="collaborators.eyebrow"
            defaultValue={content["collaborators.eyebrow"] ?? "The network"}
            className="inline"
          />
        }
        title={
          <EditableText
            id="collaborators.pageTitle"
            defaultValue={content["collaborators.pageTitle"] ?? "Our Collaborators"}
            className="inline"
          />
        }
        subtitle={
          <EditableText
            id="collaborators.pageSubtitle"
            defaultValue={content["collaborators.pageSubtitle"] ?? ""}
            className="inline"
          />
        }
      >
            <button
              type="button"
              onClick={goToRequestForm}
              className="rounded-xl px-8 py-3 text-sm font-bold shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-safe:hover:-translate-y-0.5"
              style={{ background: "var(--color-accent)", color: "var(--site-heading)" }}
            >
              <EditableText
                id="collaborators.requestCta"
                defaultValue={content["collaborators.requestCta"] ?? "Become a Collaborator"}
                className="text-sm font-bold"
              />
            </button>
      </PageHero>

      {/* ------------------------------------------------------------ Toolbar */}
      {!loading && collaborators.length > 0 && (
        <PageSearchBar
          maxWidth="max-w-7xl"
          value={search}
          onChange={(value) => setParam(PARAM.search, value)}
          placeholder="Search collaborators by name, university or research interest"
          filters={
            <>
              <SearchBarSelect
                value={designationFilter}
                onChange={(value) => setParam(PARAM.designation, value)}
                ariaLabel="Filter by designation"
                options={[
                  { value: "", label: "All designations" },
                  ...designationOptions.map((value) => ({ value, label: value })),
                ]}
              />
              <SearchBarSelect
                value={affiliationFilter}
                onChange={(value) => setParam(PARAM.affiliation, value)}
                ariaLabel="Filter by university"
                options={[
                  { value: "", label: "All universities" },
                  ...affiliationOptions.map((value) => ({ value, label: value })),
                ]}
              />
              {/* Not red. Clearing a filter isn't destructive. */}
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-10 rounded-lg px-3 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)]"
                >
                  Clear all
                </button>
              )}
            </>
          }
          status={
            <span className={isStale ? "opacity-50" : undefined}>
              {filtered.length === collaborators.length
                ? `${collaborators.length} collaborators`
                : `${filtered.length} of ${collaborators.length}`}
            </span>
          }
          below={
            (designationFilter || affiliationFilter) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
            )
          }
        />
      )}

      {/* ------------------------------------------------------------- Results */}
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8">
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
              className="mt-6 rounded-xl px-5 py-2.5 text-sm font-bold text-[color:var(--hero-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
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
              className="mt-6 rounded-xl px-5 py-2.5 text-sm font-bold text-[color:var(--hero-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
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
                  onMessage={
                    canMessage && c.uid && c.uid !== appUser?.uid
                      ? () => navigate(`/chat?to=${encodeURIComponent(c.uid)}`)
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------------- Request */}
      <SideDrawer
        open={requestOpen}
        onClose={closeRequestForm}
        eyebrow={
          <EditableText
            id="collaborators.joinNetwork"
            defaultValue="Join the Network"
            className="inline"
          />
        }
        title={
          <EditableText
            id="collaborators.requestTitle"
            defaultValue={content["collaborators.requestTitle"] ?? "Become a Collaborator"}
            className="inline"
          />
        }
      >
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
          <p className="mb-6 text-sm leading-relaxed text-slate-600">
            <EditableText
              id="collaborators.requestSubtitle"
              defaultValue={
                content["collaborators.requestSubtitle"] ??
                "Interested in joining our research community? Submit your request below and our admin will review your profile."
              }
              className="text-sm leading-relaxed"
            />
          </p>
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
            <CollaboratorRequestForm />
          </div>
        </div>
      </SideDrawer>
    </div>
  );
};

export default Collaborators;
