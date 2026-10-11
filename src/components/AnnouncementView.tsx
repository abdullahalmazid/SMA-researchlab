import React from "react";
import type { Announcement } from "../types";

/* title, body, category, link and linkLabel are optional: announcements written
   before those fields existed degrade — no title and one is derived from the
   first sentence of `content`; no body and `content` is shown. */

export const titleOf = (post: Announcement): string => {
  if (post.title?.trim()) return post.title.trim();
  const first = (post.content || "").split(/(?<=[.!?])\s/)[0]?.trim() ?? "";
  return first.length > 90 ? `${first.slice(0, 88).trimEnd()}…` : first || "Untitled";
};

export const bodyOf = (post: Announcement) => post.body?.trim() || post.content || "";

export const fmtDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

export const relativeTo = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
};

const chip = "inline-flex items-center rounded-[5px] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]";

/** One announcement, for the News split view, sheets and the home-page drawer. */
const AnnouncementView: React.FC<{ post: Announcement }> = ({ post }) => (
  <article className="px-5 pb-8 pt-6 md:px-7">
    {(post.isPinned || post.category) && (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {post.isPinned && (
          <span className={chip} style={{ background: "color-mix(in srgb, var(--color-accent) 18%, transparent)", color: "var(--accent-ink)" }}>
            Pinned
          </span>
        )}
        {post.category && (
          <span className={chip} style={{ background: "var(--site-surface-alt)", color: "var(--site-muted)" }}>
            {post.category}
          </span>
        )}
      </div>
    )}
    <h2 className="text-[22px] font-black leading-tight text-[color:var(--site-heading)] md:text-[26px]" style={{ fontFamily: "var(--font-heading)" }}>
      {titleOf(post)}
    </h2>
    <p className="mt-2 text-[12.5px] text-[color:var(--site-muted)]">
      {fmtDate(post.createdAt)} · {relativeTo(post.createdAt)}
    </p>
    <div className="mt-5 whitespace-pre-line text-[15px] leading-[1.85] text-[color:var(--site-text)]">{bodyOf(post)}</div>
    {post.link && (
      <a
        href={post.link}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-[13px] font-bold no-underline"
        style={{ background: "var(--color-primary)", color: "var(--hero-text)" }}
      >
        {post.linkLabel?.trim() || "Open link"} <span aria-hidden="true">↗</span>
      </a>
    )}
  </article>
);

export default AnnouncementView;
