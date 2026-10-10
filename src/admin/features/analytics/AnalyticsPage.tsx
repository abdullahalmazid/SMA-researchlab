import { collection, getCountFromServer, getDocs, orderBy, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { dayKey } from "../../../analytics/tracker";
import { db } from "../../../firebase/config";

/**
 * Visitor and collaborator analytics — primary administrator only.
 * Reads the counters written by src/analytics/tracker.ts.
 */

interface DayDoc {
  day: string;
  views: number;
  sessions: number;
  paths: Record<string, number>;
  devices: Record<string, number>;
  referrers: Record<string, number>;
  uniques: number;
}

interface Member {
  uid: string;
  name: string;
  role: string;
  lastSeenAt: string;
  lastPath: string;
  pageViews: number;
  sessions: number;
  days: Record<string, number>;
}

/* Validated with the dataviz palette checker against the console surface
   (#0a0f16): passes lightness band, chroma and 3:1 contrast in dark mode. */
const BAR = "#0ea5c6";

const PATH_LABELS: Record<string, string> = {
  home: "Home",
  about: "About",
  "lab-head": "Lab head",
  collaborators: "Collaborators",
  collaborators_detail: "Collaborator profiles",
  publications: "Publications",
  publications_detail: "Publication pages",
  "research-ideas": "Research ideas",
  "research-ideas_detail": "Idea pages",
  announcements: "News",
  gallery: "Gallery",
  contact: "Contact",
  chat: "Messenger",
  login: "Login",
  "collaborator-portal": "Collaborator portal",
};

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const numMap = (value: unknown): Record<string, number> =>
  value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, num(v)]))
    : {};

const daysBack = (count: number) => {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(dayKey(new Date(Date.now() - i * 86_400_000)));
  return out;
};

const relative = (iso: string) => {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};

const RankedList: React.FC<{ title: string; rows: [string, number][]; label?: (key: string) => string }> = ({ title, rows, label }) => {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <h3 className="m-0 border-b border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="m-0 px-4 py-6 text-center text-[13px] text-slate-500">No data yet.</p>
      ) : (
        <ol className="m-0 list-none space-y-2 p-4">
          {rows.slice(0, 8).map(([key, value]) => (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="truncate text-slate-700">{label ? label(key) : key}</span>
                <span className="font-mono tabular-nums text-slate-500">{value.toLocaleString()}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: BAR }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

const AnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<7 | 30>(30);
  const [docs, setDocs] = useState<DayDoc[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hover, setHover] = useState<number | null>(null);

  const days = useMemo(() => daysBack(range), [range]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const [snap, memberSnap] = await Promise.all([
          getDocs(query(collection(db, "analyticsDaily"), where("day", ">=", days[0]), orderBy("day"))),
          getDocs(collection(db, "memberActivity")),
        ]);
        const rows = await Promise.all(
          snap.docs.map(async (item) => {
            const data = item.data();
            const uniques = await getCountFromServer(collection(db, "analyticsDaily", item.id, "visitors"))
              .then((count) => count.data().count)
              .catch(() => 0);
            return {
              day: item.id,
              views: num(data.views),
              sessions: num(data.sessions),
              paths: numMap(data.paths),
              devices: numMap(data.devices),
              referrers: numMap(data.referrers),
              uniques,
            } satisfies DayDoc;
          }),
        );
        if (cancelled) return;
        setDocs(rows);
        setMembers(
          memberSnap.docs
            .map((item) => {
              const data = item.data();
              return {
                uid: item.id,
                name: String(data.name ?? "Member"),
                role: String(data.role ?? "collaborator"),
                lastSeenAt: String(data.lastSeenAt ?? ""),
                lastPath: String(data.lastPath ?? ""),
                pageViews: num(data.pageViews),
                sessions: num(data.sessions),
                days: numMap(data.days),
              };
            })
            .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)),
        );
      } catch (failure) {
        if (!cancelled) setError(String((failure as Error).message || failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  /* Every day in range, zero-filled, so gaps read as zero rather than vanishing. */
  const series = useMemo(() => {
    const byDay = new Map(docs.map((d) => [d.day, d]));
    return days.map((day) => byDay.get(day) ?? { day, views: 0, sessions: 0, paths: {}, devices: {}, referrers: {}, uniques: 0 });
  }, [days, docs]);

  const sum = (pick: (d: DayDoc) => number) => series.reduce((total, d) => total + pick(d), 0);
  const merge = (pick: (d: DayDoc) => Record<string, number>) => {
    const out: Record<string, number> = {};
    series.forEach((d) => Object.entries(pick(d)).forEach(([k, v]) => (out[k] = (out[k] ?? 0) + v)));
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  };

  const totals = {
    views: sum((d) => d.views),
    sessions: sum((d) => d.sessions),
    uniques: sum((d) => d.uniques),
    activeMembers: members.filter((m) => days.some((day) => (m.days[day] ?? 0) > 0)).length,
  };
  const today = series[series.length - 1];
  const maxViews = Math.max(1, ...series.map((d) => d.views));

  const tiles = [
    { label: "Page views", value: totals.views, note: `${today?.views ?? 0} today` },
    { label: "Sessions", value: totals.sessions, note: `${today?.sessions ?? 0} today` },
    { label: "Unique visitors / day", value: totals.uniques, note: `${today?.uniques ?? 0} today · summed by day` },
    { label: "Active collaborators", value: totals.activeMembers, note: `of ${members.length} tracked` },
  ];

  const shortDate = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Date range" className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {([7, 30] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
              className={`h-8 rounded-md px-3 text-[12.5px] font-semibold ${range === value ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Last {value} days
            </button>
          ))}
        </div>
        <p className="m-0 text-[12px] text-slate-500">
          Anonymous, cookie-free counts. Admin visits are excluded. Days are in UTC.
        </p>
      </div>

      {error && <p className="m-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-slate-200 bg-white p-3.5">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tile.label}</p>
            <p className="m-0 mt-1.5 font-mono text-[26px] font-bold leading-none tabular-nums text-slate-900">
              {loading ? "—" : tile.value.toLocaleString()}
            </p>
            <p className="m-0 mt-1.5 text-[11.5px] text-slate-500">{tile.note}</p>
          </div>
        ))}
      </div>

      {/* Daily page views — one series, so no legend; the title names it. */}
      <section className="rounded-lg border border-slate-200 bg-white" aria-labelledby="views-chart-title">
        <header className="flex items-baseline justify-between border-b border-slate-200 px-4 py-2.5">
          <h3 id="views-chart-title" className="m-0 text-[13px] font-semibold text-slate-800">
            Page views per day
          </h3>
          <span className="font-mono text-[11.5px] text-slate-500">peak {maxViews.toLocaleString()}</span>
        </header>
        <div className="relative px-4 pb-3 pt-6">
          <div className="flex h-40 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {series.map((d, index) => (
              <div
                key={d.day}
                className="flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(index)}
                onFocus={() => setHover(index)}
                tabIndex={0}
                aria-label={`${shortDate(d.day)}: ${d.views} views`}
              >
                <div
                  className="w-full rounded-t-[4px]"
                  style={{
                    height: `${d.views === 0 ? 0 : Math.max(2, (d.views / maxViews) * 100)}%`,
                    background: BAR,
                    opacity: hover === null || hover === index ? 1 : 0.45,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-slate-400" aria-hidden="true">
            <span>{shortDate(series[0]?.day ?? days[0])}</span>
            <span>{shortDate(series[series.length - 1]?.day ?? days[days.length - 1])}</span>
          </div>
          {hover !== null && series[hover] && (
            <div
              className="pointer-events-none absolute top-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] shadow-lg"
              style={{ left: `clamp(8px, calc(${((hover + 0.5) / series.length) * 100}% - 70px), calc(100% - 150px))` }}
            >
              <p className="m-0 font-semibold text-slate-800">{shortDate(series[hover].day)}</p>
              <p className="m-0 text-slate-600">
                {series[hover].views} views · {series[hover].sessions} sessions · {series[hover].uniques} unique
              </p>
            </div>
          )}
          <table className="sr-only">
            <caption>Page views per day</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Views</th>
                <th>Sessions</th>
                <th>Unique visitors</th>
              </tr>
            </thead>
            <tbody>
              {series.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{d.views}</td>
                  <td>{d.sessions}</td>
                  <td>{d.uniques}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <RankedList title="Top pages" rows={merge((d) => d.paths)} label={(key) => PATH_LABELS[key] ?? key.replace(/_/g, "/")} />
        <RankedList
          title="Where visitors came from"
          rows={merge((d) => d.referrers).filter(([key]) => key !== "internal")}
          label={(key) => (key === "direct" ? "Direct / bookmark" : key.replace(/_/g, "."))}
        />
        <RankedList title="Devices (sessions)" rows={merge((d) => d.devices)} label={(key) => key[0].toUpperCase() + key.slice(1)} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h3 className="m-0 border-b border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-800">Collaborator activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">Member</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Last seen</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Last page</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Sessions</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Page views</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Active days ({range}d)</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {loading ? "Loading…" : "No collaborator activity recorded yet."}
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.uid} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-slate-800">{member.name}</span>
                      <span className="block text-[11.5px] capitalize text-slate-500">{member.role.replace("_", " ")}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600" title={member.lastSeenAt}>
                      {member.lastSeenAt ? relative(member.lastSeenAt) : "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 font-mono text-[12px] text-slate-500">{member.lastPath || "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">{member.sessions}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">{member.pageViews}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {days.filter((day) => (member.days[day] ?? 0) > 0).length}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AnalyticsPage;
