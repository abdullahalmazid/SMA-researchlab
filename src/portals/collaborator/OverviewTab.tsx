import React from "react";
import type { CollaboratorProfile, GalleryItem, Publication, ResearchIdea } from "../../types";
import { Panel, TabHeader, formatDate } from "./ui";
import type { PortalTab } from "./tabs";

interface Props {
  profile: CollaboratorProfile;
  papers: Publication[] | null;
  ideas: ResearchIdea[] | null;
  photos: GalleryItem[] | null;
  go: (tab: PortalTab) => void;
}

/** What a complete profile needs; each item links to where it's fixed. */
const checklist = (p: CollaboratorProfile, paperCount: number): { label: string; done: boolean; tab: PortalTab }[] => [
  { label: "Add a profile photo", done: Boolean(p.photo), tab: "profile" },
  { label: "Add your designation and affiliation", done: Boolean(p.designation && p.affiliation), tab: "profile" },
  { label: "Write a short bio (40+ characters)", done: (p.bio ?? "").trim().length >= 40, tab: "profile" },
  { label: "List your research interests", done: (p.researchInterests ?? []).length > 0, tab: "profile" },
  { label: "Link Google Scholar or ORCID", done: Boolean(p.scholar || p.orcid), tab: "profile" },
  { label: "Add at least one paper", done: paperCount > 0, tab: "publications" },
];

const OverviewTab: React.FC<Props> = ({ profile, papers, ideas, photos, go }) => {
  const items = checklist(profile, papers?.length ?? 0);
  const done = items.filter((item) => item.done).length;
  const percent = Math.round((done / items.length) * 100);
  const comments = (ideas ?? []).reduce((sum, idea) => sum + (idea.commentCount ?? 0), 0);
  const onLabPage = (papers ?? []).filter((paper) => paper.hasLabHeadAuthorship).length;

  const stats: { label: string; value: number | null; note: string; tab: PortalTab }[] = [
    { label: "Papers", value: papers?.length ?? null, note: papers ? `${onLabPage} on the lab page` : "", tab: "publications" },
    { label: "Research ideas", value: ideas?.length ?? null, note: ideas ? `${comments} comment${comments === 1 ? "" : "s"} received` : "", tab: "ideas" },
    { label: "Gallery photos", value: photos?.length ?? null, note: "in the lab gallery", tab: "gallery" },
  ];

  const recent = [
    ...(papers ?? []).map((p) => ({ kind: "Paper", title: p.title, at: p.updatedAt || p.createdAt || "", tab: "publications" as PortalTab })),
    ...(ideas ?? []).map((i) => ({ kind: "Idea", title: i.title, at: i.createdAt, tab: "ideas" as PortalTab })),
    ...(photos ?? []).map((g) => ({ kind: "Photo", title: g.title, at: g.createdAt, tab: "gallery" as PortalTab })),
  ]
    .filter((entry) => entry.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);

  const firstName = (profile.name || "").split(/\s+/).find((part) => !/^(dr|prof|mr|ms|mrs)\.?$/i.test(part)) ?? "";

  return (
    <div className="pb-10">
      <TabHeader title={firstName ? `Welcome back, ${firstName}` : "Welcome back"} description="Your contributions to the lab at a glance." />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => go(stat.tab)}
            className="min-w-0 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 py-2.5 text-left transition hover:border-[color:var(--color-secondary)] sm:px-4 sm:py-3"
          >
            <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--site-muted)] sm:text-[11px]">{stat.label}</p>
            <p className="mt-1 text-[24px] font-bold leading-none tabular-nums text-[color:var(--site-heading)]">{stat.value ?? "—"}</p>
            <p className="mt-1 hidden truncate text-[11.5px] text-[color:var(--site-muted)] sm:block">{stat.note}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="Profile strength"
          description={percent === 100 ? "Your profile is complete." : "A complete profile is easier for visitors to find and trust."}
          action={<span className="text-[13px] font-bold tabular-nums text-[color:var(--site-heading)]">{percent}%</span>}
        >
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--site-surface-alt)]" aria-hidden="true">
            <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: percent === 100 ? "#059669" : "var(--color-secondary)" }} />
          </div>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  disabled={item.done}
                  onClick={() => go(item.tab)}
                  className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-[12.5px] enabled:hover:bg-[color:var(--site-surface-alt)]"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                    style={
                      item.done
                        ? { background: "#059669", color: "#fff" }
                        : { border: "1.5px solid var(--site-border)", color: "transparent" }
                    }
                  >
                    ✓
                  </span>
                  <span className={item.done ? "text-[color:var(--site-muted)] line-through" : "text-[color:var(--site-heading)]"}>{item.label}</span>
                  <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
                  {!item.done && (
                    <span className="ml-auto text-[11.5px] font-semibold" style={{ color: "var(--secondary-ink)" }}>
                      Fix →
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent activity" bodyClassName="p-0">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] text-[color:var(--site-muted)]">Nothing yet — add a paper, an idea or a photo.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--site-border)]">
              {recent.map((entry, index) => (
                <li key={`${entry.kind}-${index}`}>
                  <button
                    type="button"
                    onClick={() => go(entry.tab)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[color:var(--site-surface-alt)]"
                  >
                    <span className="w-12 shrink-0 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--site-muted)]">{entry.kind}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[color:var(--site-heading)]">{entry.title}</span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-[color:var(--site-muted)]">{formatDate(entry.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default OverviewTab;
