import { Search, X } from "lucide-react";
import React from "react";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  ariaLabel = "Search",
  className = "",
  autoFocus,
  inputRef,
  onKeyDown,
}) => (
  <div className={`relative min-w-0 ${className}`}>
    <Search
      aria-hidden="true"
      size={17}
      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
    />
    <input
      ref={inputRef}
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-slate-200/60"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange("")}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-slate-100 text-slate-500 hover:bg-slate-200"
      >
        <X size={14} />
      </button>
    )}
  </div>
);

export default SearchField;
