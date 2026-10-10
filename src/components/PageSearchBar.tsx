import { Search, X } from "lucide-react";
import React, { useEffect, useRef } from "react";

/**
 * The one search bar every listing page uses. Same look, same place (pinned
 * just under the navbar), same keys — "/" focuses it from anywhere on the
 * page, Escape clears it. What it searches is up to the page: each passes its
 * own placeholder and filters, and does its own matching on `value`.
 */
interface PageSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /** e.g. "Search publications by title, author or journal". */
  placeholder: string;
  ariaLabel?: string;
  /** Page-specific controls: tabs, selects, chips. Rendered after the input. */
  filters?: React.ReactNode;
  /** Result summary, announced to screen readers as it changes. */
  status?: React.ReactNode;
  /** Primary page action, e.g. "Post idea". Pinned to the right. */
  action?: React.ReactNode;
  /** A second row under the bar, e.g. active-filter chips. */
  below?: React.ReactNode;
  /** Match the page's content width. */
  maxWidth?: string;
}

const PageSearchBar: React.FC<PageSearchBarProps> = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  filters,
  status,
  action,
  below,
  maxWidth = "max-w-6xl",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className="sticky z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md"
      style={{ top: "var(--nav-offset, 0px)" }}
    >
      <div className={`mx-auto ${maxWidth} px-4 py-3`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              type="search"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && value) {
                  event.preventDefault();
                  onChange("");
                }
              }}
              placeholder={placeholder}
              aria-label={ariaLabel ?? placeholder}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 text-[13.5px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200 [&::-webkit-search-cancel-button]:hidden"
            />
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 font-sans text-[11px] font-semibold leading-5 text-slate-400 sm:block"
              >
                /
              </kbd>
            )}
          </div>

          {filters}

          {status != null && (
            <p
              role="status"
              aria-live="polite"
              className="ml-auto whitespace-nowrap text-[12px] font-semibold tabular-nums text-slate-400"
            >
              {status}
            </p>
          )}

          {action}
        </div>

        {below}
      </div>
    </div>
  );
};

/** Segmented tabs that sit inside the bar's `filters` slot. */
export const SearchBarTabs = <T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: { id: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) => (
  <div role="tablist" aria-label={ariaLabel} className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
    {tabs.map((tab) => {
      const active = tab.id === value;
      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(tab.id)}
          className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] ${
            active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {tab.label}
          {tab.count != null && (
            <span className={`text-[11px] tabular-nums ${active ? "text-slate-500" : "text-slate-400"}`}>
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/** A compact select for the bar's `filters` slot. */
export const SearchBarSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}> = ({ value, onChange, options, ariaLabel }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    aria-label={ariaLabel}
    className={`h-10 max-w-[220px] cursor-pointer appearance-none truncate rounded-lg border bg-white bg-[length:10px] bg-[right_10px_center] bg-no-repeat pl-3 pr-8 text-[13px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] ${
      value ? "border-[var(--primary-ink)] text-[var(--primary-ink)]" : "border-slate-200 text-slate-600"
    }`}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    }}
  >
    {options.map((option) => (
      <option key={option.value || "all"} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default PageSearchBar;
