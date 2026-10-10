import React from "react";

/**
 * Small building blocks shared by the collaborator portal tabs. Every colour
 * comes from the Theme Control tokens, and controls stay compact: 32px buttons,
 * 36px fields, 13px text.
 */

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-1";

export const fieldClass =
  "h-9 w-full rounded-lg border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 text-[13px] text-[color:var(--site-heading)] outline-none transition placeholder:text-[color:var(--site-muted)] focus:border-[color:var(--color-secondary)]";

export const areaClass =
  "w-full rounded-lg border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 py-2 text-[13px] leading-relaxed text-[color:var(--site-heading)] outline-none transition placeholder:text-[color:var(--site-muted)] focus:border-[color:var(--color-secondary)]";

type ButtonTone = "primary" | "ghost" | "danger" | "quiet";

const TONES: Record<ButtonTone, string> = {
  primary: "bg-[color:var(--color-primary)] text-[color:var(--hero-text)] hover:opacity-90",
  ghost:
    "border border-[color:var(--site-border)] bg-[color:var(--site-surface)] text-[color:var(--site-heading)] hover:bg-[color:var(--site-surface-alt)]",
  danger: "border border-rose-200 bg-[color:var(--site-surface)] text-rose-600 hover:bg-rose-50",
  quiet: "text-[color:var(--site-muted)] hover:bg-[color:var(--site-surface-alt)] hover:text-[color:var(--site-heading)]",
};

export const buttonClass = (tone: ButtonTone = "ghost", extra = "") =>
  `inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone]} ${FOCUS} ${extra}`;

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }> = ({
  tone = "ghost",
  className = "",
  type = "button",
  ...rest
}) => <button type={type} className={buttonClass(tone, className)} {...rest} />;

export const Field: React.FC<{
  label: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, hint, htmlFor, className = "", children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="mb-1 flex items-baseline justify-between gap-2 text-[12px] font-semibold text-[color:var(--site-text)]">
      {label}
      {hint && <span className="text-[11px] font-normal text-[color:var(--site-muted)]">{hint}</span>}
    </label>
    {children}
  </div>
);

/** A titled section with an optional action on the right of its header. */
export const Panel: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, description, action, className = "", bodyClassName = "p-4", children }) => (
  <section className={`rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] ${className}`}>
    <header className="flex items-center gap-3 border-b border-[color:var(--site-border)] px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <h3 className="text-[13.5px] font-bold text-[color:var(--site-heading)]">{title}</h3>
        {description && <p className="mt-0.5 text-[11.5px] text-[color:var(--site-muted)]">{description}</p>}
      </div>
      {action}
    </header>
    <div className={bodyClassName}>{children}</div>
  </section>
);

/** Page-level heading for a tab: title, one line of context, primary action. */
export const TabHeader: React.FC<{ title: string; description: string; action?: React.ReactNode; children?: React.ReactNode }> = ({
  title,
  description,
  action,
  children,
}) => (
  <div className="mb-4 flex flex-wrap items-end gap-3">
    <div className="min-w-0 flex-1">
      <h2 className="text-[18px] font-bold leading-tight text-[color:var(--site-heading)]" style={{ fontFamily: "var(--font-heading)" }}>
        {title}
      </h2>
      <p className="mt-0.5 text-[12.5px] text-[color:var(--site-muted)]">{description}</p>
    </div>
    {children}
    {action}
  </div>
);

export const Notice: React.FC<{ tone: "error" | "success"; children: React.ReactNode; onDismiss?: () => void }> = ({
  tone,
  children,
  onDismiss,
}) => (
  <div
    role={tone === "error" ? "alert" : "status"}
    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-medium ${
      tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
    }`}
  >
    <span className="flex-1">{children}</span>
    {onDismiss && (
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        ×
      </button>
    )}
  </div>
);

export const Spinner: React.FC<{ label?: string }> = ({ label = "Loading" }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-[color:var(--site-muted)]" role="status">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--site-border)] border-t-[color:var(--color-secondary)]" />
    {label}…
  </div>
);

export const EmptyState: React.FC<{ title: string; text: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="rounded-xl border border-dashed border-[color:var(--site-border)] px-4 py-10 text-center">
    <p className="text-[13.5px] font-semibold text-[color:var(--site-heading)]">{title}</p>
    <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-[color:var(--site-muted)]">{text}</p>
    {action && <div className="mt-3 flex justify-center">{action}</div>}
  </div>
);

export const Avatar: React.FC<{ name: string; photo?: string; size?: number; className?: string }> = ({
  name,
  photo,
  size = 40,
  className = "",
}) => {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return photo ? (
    <img src={photo} alt="" className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-bold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36, background: "var(--color-primary)", color: "var(--hero-text)" }}
    >
      {initials}
    </span>
  );
};

export const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
