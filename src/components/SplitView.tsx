import React, { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { genieOpen, takeOrigin } from "../lib/genie";

/**
 * Browse-and-read layout shared by every section (People, Publications,
 * Research ideas, News). On desktop an open item shows beside a list of all
 * items; on phones the page keeps its list and the item opens in a bottom
 * sheet (the section renders that with SideDrawer).
 */

export interface SplitItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Avatar, icon or status dot shown before the title. */
  leading?: React.ReactNode;
}

interface SplitViewProps {
  /** Section name, e.g. "Publications" — used in the breadcrumb and labels. */
  section: string;
  items: SplitItem[];
  total: number;
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  /** The open item's name, for the breadcrumb. */
  current: React.ReactNode;
  loading?: boolean;
  /** Optional bar under the detail (e.g. newer/older). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const SplitView: React.FC<SplitViewProps> = ({
  section,
  items,
  total,
  activeId,
  onSelect,
  onClose,
  search,
  onSearch,
  searchPlaceholder,
  current,
  loading,
  footer,
  children,
}) => {
  const listRef = useRef<HTMLUListElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  /* Each newly opened item pours out of whatever was clicked (genie), and the
     list keeps the open item in view. */
  useLayoutEffect(() => {
    genieOpen(detailRef.current, takeOrigin());
  }, [activeId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    listRef.current?.querySelector<HTMLElement>("[aria-current]")?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[300px_minmax(0,1fr)] items-start gap-4 px-4 py-4">
      <aside
        aria-label={`All ${section.toLowerCase()}`}
        className="sticky top-[calc(var(--nav-offset)+16px)] flex max-h-[calc(100dvh-var(--nav-offset)-32px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)]"
            >
              <span aria-hidden="true">←</span> All {section.toLowerCase()}
            </button>
            <span className="text-[11.5px] tabular-nums text-slate-500">
              {items.length === total ? total : `${items.length} of ${total}`}
            </span>
          </div>
          <label className="sr-only" htmlFor="split-search">
            {searchPlaceholder}
          </label>
          <input
            id="split-search"
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-800 outline-none transition focus:border-[color:var(--color-secondary)]"
          />
        </div>
        <ul ref={listRef} role="list" className="min-h-0 flex-1 list-none overflow-y-auto p-1.5">
          {loading ? (
            <li className="px-3 py-6 text-center text-[12.5px] text-slate-500">Loading…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-6 text-center text-[12.5px] text-slate-500">Nothing matches that search.</li>
          ) : (
            items.map((item) => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-current={active ? "true" : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] ${
                      active ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    {active && (
                      <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full" style={{ background: "var(--color-secondary)" }} />
                    )}
                    {item.leading}
                    <span className="min-w-0 flex-1">
                      <span className={`line-clamp-2 text-[13px] leading-snug ${active ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}>
                        {item.title}
                      </span>
                      {item.subtitle && <span className="mt-0.5 block truncate text-[11.5px] text-slate-500">{item.subtitle}</span>}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      <section
        key={activeId}
        ref={detailRef}
        aria-label={`${section} detail`}
        className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
          <p className="min-w-0 flex-1 truncate text-[12.5px] text-slate-500">
            <button type="button" onClick={onClose} className="font-semibold text-slate-600 hover:text-slate-900">
              {section}
            </button>
            <span aria-hidden="true"> / </span>
            <span className="font-semibold text-slate-800">{current}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
        {footer}
      </section>
    </div>
  );
};

export default SplitView;

/**
 * Route state for a section whose items live at <base>/<id>:
 * opening from the list pushes a history entry (so Back returns to the list
 * with its filters and scroll), switching between items replaces it.
 */
export const useSplitRoute = (base: string) => {
  const { id: openId = "" } = useParams<{ id?: string }>();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const location = useLocation();

  const open = (id: string) =>
    navigate(
      { pathname: `${base}/${encodeURIComponent(id)}`, search: location.search },
      { replace: Boolean(openId), state: { fromList: true } },
    );

  const close = () => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) navigate(-1);
    else navigate({ pathname: base, search: location.search }, { replace: true });
  };

  return { openId, isDesktop, open, close };
};
