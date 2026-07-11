import { ChevronDown } from "lucide-react";
import React from "react";

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  ariaLabel: string;
  className?: string;
}

const FilterSelect: React.FC<FilterSelectProps> = ({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}) => (
  <div className={`relative min-w-0 ${className}`}>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className={`h-11 w-full appearance-none rounded-xl border bg-white pl-3.5 pr-10 text-sm font-semibold outline-none transition focus:ring-4 focus:ring-slate-200/60 ${
        value
          ? "border-[var(--color-primary)] text-[var(--color-primary)]"
          : "border-slate-200 text-slate-700"
      }`}
    >
      {options.map((option) => (
        <option key={option.value || "all"} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown
      aria-hidden="true"
      size={16}
      className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
    />
  </div>
);

export default FilterSelect;

