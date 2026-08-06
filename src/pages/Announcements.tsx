import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppIcon from "../components/AppIcon";
import EditableText from "../components/EditableText";
import { useThemeContext } from "../context/ThemeContext";
import { useAnnouncements, useSiteContent } from "../firebase/hooks";
import type { Announcement } from "../types";

/**
 * Four optional fields the admin panel can start writing. Declared here rather
 * than in types.ts so this page compiles against the existing Announcement
 * shape — move them onto the shared type once ManageAnnouncements writes them.
 *
 * Everything degrades: no title and one is derived from the first sentence of
 * `content`; no body and the detail drawer shows `content`.
 */
type Post = Announcement & {
  title?: string;
  body?: string;
  category?: string;
  link?: string;
  linkLabel?: string;
};

const PARAM = { open: "a", search: "q", category: "topic" } as const;

/** Anything newer than this gets a "New" badge. */
const NEW_DAYS = 21;

/* ------------------------------------------------------------------ dates */

const fmtDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

const monthOf = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Undated"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
};

function relativeTo(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

const isRecent = (value: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && (Date.now() - date.getTime()) / 86_400_000 < NEW_DAYS;
};

/* ------------------------------------------------------------------ text */

/** First sentence, trimmed to a headline length. */
function titleOf(post: Post): string {
  if (post.title?.trim()) return post.title.trim();
  const first = (post.content || "").split(/(?<=[.!?])\s/)[0]?.trim() ?? "";
  return first.length > 90 ? `${first.slice(0, 88).trimEnd()}…` : first || "Untitled";
}

const bodyOf = (post: Post) => post.body?.trim() || post.content || "";
const norm = (value?: string) => (value ?? "").toLowerCase();

/* ----------------------------------------------------------------- theme */

/** Proper WCAG relative luminance — the raw-channel version misjudges mid greens and blues. */
function isDarkBackground(hex: string): boolean {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return false;
  const channel = (offset: number) => {
    const v = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4) < 0.22;
}

const buildTokens = (dark: boolean) => ({
  surface: dark ? "#111827" : "#ffffff",
  surfaceAlt: dark ? "rgba(148,163,184,0.10)" : "#f6f8fb",
  border: dark ? "rgba(148,163,184,0.22)" : "#e6ecf3",
  borderStrong: dark ? "rgba(148,163,184,0.42)" : "#cbd5e1",
  title: dark ? "#f8fafc" : "#0f172a",
  body: dark ? "#cbd5e1" : "#475569",
  muted: dark ? "#94a3b8" : "#64748b",
  faint: dark ? "#64748b" : "#94a3b8",
  shadow: dark ? "0 1px 2px rgba(0,0,0,0.4)" : "0 1px 2px rgba(15,23,42,0.04)",
  shadowHi: dark ? "0 12px 28px rgba(0,0,0,0.45)" : "0 12px 28px rgba(15,23,42,0.09)",
  pin: dark ? "#fbbf24" : "#b45309",
  pinBg: dark ? "rgba(251,191,36,0.12)" : "#fffbeb",
  pinBorder: dark ? "rgba(251,191,36,0.30)" : "#fde68a",
});

type Tokens = ReturnType<typeof buildTokens>;

/* ------------------------------------------------------------------ bits */

const Badges: React.FC<{ post: Post; t: Tokens }> = ({ post, t }) => (
  <>
    {post.isPinned && (
      <span
        className="inline-flex items-center rounded-[5px] border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
        style={{ background: t.pinBg, borderColor: t.pinBorder, color: t.pin }}
      >
        Pinned
      </span>
    )}
    {isRecent(post.createdAt) && (
      <span
        className="inline-flex items-center rounded-[5px] border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
        style={{
          background: "color-mix(in srgb, var(--color-secondary) 14%, transparent)",
          borderColor: "color-mix(in srgb, var(--color-secondary) 30%, transparent)",
          color: "var(--color-secondary)",
        }}
      >
        New
      </span>
    )}
    {post.category && (
      <span
        className="inline-flex items-center rounded-[5px] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
        style={{ background: t.surfaceAlt, color: t.muted }}
      >
        {post.category}
      </span>
    )}
  </>
);

const CardSkeleton: React.FC<{ t: Tokens }> = ({ t }) => (
  <div
    className="mb-3 rounded-2xl border border-l-4 px-5 py-[18px]"
    style={{ borderColor: t.border, borderLeftColor: t.borderStrong, background: t.surface }}
  >
    <div className="h-3 w-28 animate-pulse rounded" style={{ background: t.surfaceAlt }} />
    <div className="mt-3 h-4 w-3/4 animate-pulse rounded" style={{ background: t.surfaceAlt }} />
    <div className="mt-3 h-3 w-11/12 animate-pulse rounded" style={{ background: t.surfaceAlt }} />
    <div className="mt-2 h-3 w-3/5 animate-pulse rounded" style={{ background: t.surfaceAlt }} />
  </div>
);

/* ================================================================== page */

const Announcements: React.FC = () => {
  const announcements = useAnnouncements() as Post[];
  const { content } = useSiteContent();
  const { theme } = useThemeContext();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const dark = useMemo(() => isDarkBackground(theme.backgroundColor ?? ""), [theme.backgroundColor]);
  const t = useMemo(() => buildTokens(dark), [dark]);

  const search = params.get(PARAM.search) ?? "";
  const category = params.get(PARAM.category) ?? "";
  const openId = params.get(PARAM.open) ?? "";

  /* useAnnouncements() has no loading flag, so an empty array means either
     "still fetching" or "genuinely empty" — and showing "Nothing announced
     yet" for half a second on every visit is worse than a skeleton. Adding a
     `loading` field to that hook would let this go. */
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 600);
    return () => window.clearTimeout(timer);
  }, []);
  const loading = !settled && announcements.length === 0;

  const setParam = useCallback(
    (key: string, value: string, replace = true) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      setParams(next, { replace });
    },
    [params, setParams],
  );

  /* Hidden items are admin-only. The homepage currently doesn't filter these. */
  const published = useMemo(
    () =>
      [...announcements]
        .filter((post) => !post.isHidden)
        .sort(
          (a, b) =>
            Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) ||
            String(b.createdAt).localeCompare(String(a.createdAt)),
        ),
    [announcements],
  );

  const categories = useMemo(
    () =>
      Array.from(new Set(published.map((p) => p.category).filter((c): c is string => !!c))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [published],
  );

  const visible = useMemo(() => {
    const term = norm(search).trim();
    return published.filter((post) => {
      if (category && post.category !== category) return false;
      if (!term) return true;
      return (
        norm(titleOf(post)).includes(term) ||
        norm(post.content).includes(term) ||
        norm(post.body).includes(term) ||
        norm(post.category).includes(term)
      );
    });
  }, [published, search, category]);

  /* ------------------------------------------------------------- drawer */

  const openIndex = visible.findIndex((post) => post.id === openId);
  const openPost = openIndex >= 0 ? visible[openIndex] : null;
  const isOpen = Boolean(openPost);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pushedRef = useRef(false);
  const scrollRef = useRef(0);

  const openPostById = (id: string, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    scrollRef.current = window.scrollY;
    pushedRef.current = true;
    /* Pushed, not replaced: Back closes the drawer instead of leaving the page. */
    setParam(PARAM.open, id, false);
  };

  const close = useCallback(() => {
    if (!pushedRef.current) {
      /* Arrived by deep link — there's nothing of ours to go back to. */
      setParam(PARAM.open, "");
      return;
    }
    pushedRef.current = false;
    navigate(-1);
  }, [navigate, setParam]);

  const step = (delta: number) => {
    const next = visible[openIndex + delta];
    if (next) setParam(PARAM.open, next.id);
  };

  /* Lock the page behind the drawer, and restore the reader's place on close —
     the whole point of a drawer over a detail page is not losing it. */
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      /* The heading, not the close button: a screen reader then reads the
         announcement's title as the dialog opens. */
      window.requestAnimationFrame(() => headingRef.current?.focus());
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
      window.scrollTo(0, scrollRef.current);
    }
  }, [isOpen, openId]);

  /* Escape closes; Tab is trapped. Without the trap, Tab walks out into the
     list behind — visible, but not meant to be reachable. */
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)"),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === headingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  /* --------------------------------------------------------------- view */

  const grouped = useMemo(() => {
    const pinned = visible.filter((post) => post.isPinned);
    const rest = visible.filter((post) => !post.isPinned);
    const months: { label: string; posts: Post[] }[] = [];
    rest.forEach((post) => {
      const label = monthOf(post.createdAt);
      const last = months[months.length - 1];
      if (last?.label === label) last.posts.push(post);
      else months.push({ label, posts: [post] });
    });
    return { pinned, months };
  }, [visible]);

  const groupLabel = (label: string) => (
    <h2
      className="mb-3.5 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.14em] after:h-px after:flex-1 after:content-['']"
      style={{ color: t.faint }}
    >
      {label}
      <span className="h-px flex-1" style={{ background: t.border }} />
    </h2>
  );

  const card = (post: Post) => (
    <button
      key={post.id}
      type="button"
      /* A button, not a link: it opens a panel on this page rather than
         navigating. Announcing "link" and then not going anywhere is what makes
         dialogs confusing on a screen reader. */
      aria-haspopup="dialog"
      onClick={(event) => openPostById(post.id, event.currentTarget)}
      className="mb-3 block w-full rounded-2xl border border-l-4 px-5 py-[18px] text-left transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)] motion-safe:hover:-translate-y-0.5"
      style={{
        background: t.surface,
        borderColor: openId === post.id ? "var(--color-secondary)" : t.border,
        borderLeftColor: post.isPinned ? "var(--color-accent)" : t.borderStrong,
        boxShadow: t.shadow,
      }}
    >
      <span className="mb-[7px] flex flex-wrap items-center gap-2">
        <Badges post={post} t={t} />
        <span className="text-[12px] tabular-nums" style={{ color: t.faint }}>
          {fmtDate(post.createdAt)}
        </span>
      </span>
      <span
        className="block text-[17px] font-bold leading-snug"
        style={{ fontFamily: "var(--font-heading)", color: t.title }}
      >
        {titleOf(post)}
      </span>
      <span className="mt-1.5 line-clamp-2 block text-[13.5px] leading-relaxed" style={{ color: t.body }}>
        {post.content}
      </span>
      <span
        className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-bold"
        style={{ color: "var(--color-secondary)" }}
      >
        Read more <span aria-hidden="true">→</span>
      </span>
    </button>
  );

  return (
    <div>
      {/* ---------------------------------------------------------- hero */}
      <section className="px-4 pt-14" style={{ background: "var(--color-primary)" }}>
        <div className="mx-auto max-w-3xl">
          <p
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--color-accent)" }}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            <EditableText
              id="announcements.eyebrow"
              defaultValue={content["branding.labName"] ?? "DASS Research Lab"}
              className="inline"
            />
          </p>

          <h1
            className="mt-3.5 font-black tracking-tight text-white"
            style={{ fontSize: "clamp(2rem,4.5vw,2.8rem)", fontFamily: "var(--font-heading)" }}
          >
            <EditableText
              id="announcements.pageTitle"
              defaultValue={content["announcements.pageTitle"] ?? "Announcements"}
              className="font-black text-white"
            />
          </h1>

          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/70">
            <EditableText
              id="announcements.pageSubtitle"
              defaultValue={
                content["announcements.pageSubtitle"] ??
                "Papers, awards, openings and everything else worth telling people about — newest first."
              }
              className="text-[15px] leading-relaxed"
            />
          </p>

          <div className="mt-7 flex flex-wrap gap-x-9 border-t border-white/15 py-5">
            {[
              { value: published.length, label: "announcements" },
              { value: published.filter((p) => p.isPinned).length, label: "pinned" },
              { value: categories.length, label: "categories" },
            ].map((fact) => (
              <div key={fact.label} className="flex items-baseline gap-2.5">
                <b
                  className="text-2xl font-black leading-none tabular-nums"
                  style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
                >
                  {fact.value}
                </b>
                <span className="text-[12.5px] text-white/60">{fact.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- toolbar */}
      {!loading && published.length > 0 && (
        <div
          className="sticky top-0 z-30 border-b backdrop-blur-md"
          style={{
            borderColor: t.border,
            background: `color-mix(in srgb, ${t.surface} 88%, transparent)`,
          }}
        >
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2.5 px-4 py-2.5">
            <div className="relative min-w-[190px] flex-1">
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: t.faint }}
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={search}
                aria-label="Search announcements"
                placeholder="Search announcements…"
                onChange={(e) => setParam(PARAM.search, e.target.value)}
                className="w-full rounded-lg border py-2 pl-9 pr-3 text-[13px] outline-none"
                style={{ background: t.surfaceAlt, borderColor: t.border, color: t.title }}
              />
            </div>

            {categories.map((name) => {
              const on = category === name;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setParam(PARAM.category, on ? "" : name)}
                  className="rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition"
                  style={{
                    background: on ? "var(--color-primary)" : t.surface,
                    borderColor: on ? "var(--color-primary)" : t.border,
                    color: on ? "#fff" : t.muted,
                  }}
                >
                  {name}
                </button>
              );
            })}

            <p
              role="status"
              aria-live="polite"
              className="ml-auto text-[12px] font-semibold tabular-nums"
              style={{ color: t.muted }}
            >
              {visible.length === published.length
                ? `${published.length} total`
                : `${visible.length} of ${published.length}`}
            </p>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- listing */}
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        {loading ? (
          <div aria-busy="true" aria-label="Loading announcements">
            {Array.from({ length: 4 }, (_, i) => (
              <CardSkeleton key={i} t={t} />
            ))}
          </div>
        ) : published.length === 0 ? (
          <div
            className="mx-auto max-w-md rounded-2xl border border-dashed px-6 py-14 text-center"
            style={{ borderColor: t.borderStrong }}
          >
            <p className="text-[17px] font-semibold" style={{ color: t.title }}>
              Nothing announced yet
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: t.muted }}>
              News from the lab will appear here as it&apos;s posted.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div
            className="mx-auto max-w-md rounded-2xl border border-dashed px-6 py-14 text-center"
            style={{ borderColor: t.borderStrong }}
          >
            <p className="text-[17px] font-semibold" style={{ color: t.title }}>
              Nothing matches
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: t.muted }}>
              {search ? (
                <>
                  No announcement mentions{" "}
                  <span className="font-semibold" style={{ color: t.title }}>
                    “{search}”
                  </span>
                  .
                </>
              ) : (
                <>Try another category.</>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete(PARAM.search);
                next.delete(PARAM.category);
                setParams(next, { replace: true });
              }}
              className="mt-5 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white"
              style={{ background: "var(--color-primary)" }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {grouped.pinned.length > 0 && (
              <section className="mb-8">
                {groupLabel("Pinned")}
                {grouped.pinned.map(card)}
              </section>
            )}
            {grouped.months.map((group) => (
              <section key={group.label} className="mb-8">
                {groupLabel(group.label)}
                {group.posts.map(card)}
              </section>
            ))}
          </>
        )}
      </div>

      {/* --------------------------------------------------------- drawer */}
      {/* Kept mounted so it can transition. `invisible` takes it out of the tab
          order and the accessibility tree while closed. */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-[100] bg-slate-900/55 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-drawer-title"
        className={`fixed bottom-0 right-0 top-0 z-[101] flex w-[min(540px,100vw)] flex-col border-l shadow-[-24px_0_60px_rgba(15,23,42,0.22)] transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none max-sm:inset-x-0 max-sm:top-auto max-sm:max-h-[88vh] max-sm:w-full max-sm:rounded-t-[20px] max-sm:border-l-0 ${
          isOpen
            ? "translate-x-0 max-sm:translate-y-0"
            : "invisible translate-x-full max-sm:translate-x-0 max-sm:translate-y-full"
        }`}
        style={{ background: t.surface, borderColor: t.border }}
      >
        <div
          className="flex flex-none items-start gap-3 border-b px-5 pb-3.5 pt-[18px]"
          style={{ borderColor: t.border }}
        >
          <p
            className="text-[10.5px] font-extrabold uppercase tracking-[0.14em]"
            style={{ color: t.faint }}
          >
            Announcement
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="Close announcement"
            className="ml-auto grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border transition"
            style={{ borderColor: t.border, color: t.muted, background: t.surface }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-[22px]">
          {openPost && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badges post={openPost} t={t} />
              </div>
              <h2
                id="announcement-drawer-title"
                ref={headingRef}
                tabIndex={-1}
                className="text-[22px] font-black leading-tight focus:outline-none"
                style={{ fontFamily: "var(--font-heading)", color: t.title }}
              >
                {titleOf(openPost)}
              </h2>
              <p className="mt-2.5 text-[12.5px]" style={{ color: t.faint }}>
                {fmtDate(openPost.createdAt)} · {relativeTo(openPost.createdAt)}
              </p>
              <div
                className="mt-5 whitespace-pre-line text-[14.5px] leading-[1.85]"
                style={{ color: t.body }}
              >
                {bodyOf(openPost)}
              </div>
              {openPost.link && (
                <a
                  href={openPost.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-bold text-white no-underline"
                  style={{ background: "var(--color-primary)" }}
                >
                  {/* The admin panel writes linkLabel precisely so this doesn't
                      say "Open link" on every announcement. */}
                  {openPost.linkLabel?.trim() || "Open link"} <span aria-hidden="true">↗</span>
                </a>
              )}
            </>
          )}
        </div>

        <div
          className="flex flex-none items-center gap-2 border-t px-5 py-3"
          style={{ borderColor: t.border, background: t.surface }}
        >
          {/* Steps through the *filtered* list, so a search for "award" pages
              through matches rather than everything. */}
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={openIndex <= 0}
            className="inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: t.border, color: t.body, background: t.surface }}
          >
            <span aria-hidden="true">←</span> Newer
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={openIndex < 0 || openIndex >= visible.length - 1}
            className="inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: t.border, color: t.body, background: t.surface }}
          >
            Older <span aria-hidden="true">→</span>
          </button>
          <span className="text-[11.5px] tabular-nums" style={{ color: t.faint }}>
            {openIndex >= 0 ? `${openIndex + 1} of ${visible.length}` : ""}
          </span>
          <span className="ml-auto">
            <AppIcon name="about" size={14} />
          </span>
        </div>
      </aside>
    </div>
  );
};

export default Announcements;
