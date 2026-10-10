import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Download } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../../firebase/config";

/**
 * The admin change log — primary administrator only (enforced by the rules).
 * Shows who changed what, from the entries written by core/audit.ts.
 */

interface AuditRow {
  id: string;
  actorUid: string;
  actorName: string;
  actorLevel: string;
  action: string;
  targetPath: string;
  targetLabel: string;
  details: Record<string, string>;
  createdAt: string;
}

const COLLECTION_LABELS: Record<string, string> = {
  siteContent: "Content",
  theme: "Theme",
  publications: "Publication",
  researchIdeas: "Research idea",
  comments: "Comment",
  announcements: "Announcement",
  gallery: "Gallery",
  collaborators: "Collaborator",
  pendingRequests: "Collab request",
  contactMessages: "Message",
  users: "Account access",
  permissionRequests: "Access request",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  set: "Replaced",
  update: "Updated",
  delete: "Deleted",
  moderator_access_updated: "Access granted",
  moderator_access_revoked: "Access withdrawn",
};

const RANGES = [
  { id: "1", label: "24 hours", ms: 86_400_000 },
  { id: "7", label: "7 days", ms: 7 * 86_400_000 },
  { id: "30", label: "30 days", ms: 30 * 86_400_000 },
  { id: "all", label: "All time", ms: Infinity },
] as const;

const str = (value: unknown) => (typeof value === "string" ? value : "");

const describeTarget = (row: AuditRow) => {
  const [root, ...rest] = row.targetPath.split("/");
  const kind = COLLECTION_LABELS[root] ?? root ?? "Record";
  return { kind, id: rest.join("/") || row.targetLabel };
};

const AuditLogPage: React.FC = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("7");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "adminAuditLog"), orderBy("createdAt", "desc"), limit(500)),
        (snapshot) => {
          setRows(
            snapshot.docs.map((item) => {
              const data = item.data();
              // Older permission entries used targetUid/targetName/permissions.
              const legacyDetails: Record<string, string> = Array.isArray(data.permissions)
                ? { permissions: data.permissions.join(", ") || "(none)" }
                : {};
              return {
                id: item.id,
                actorUid: str(data.actorUid),
                actorName: str(data.actorName) || "Unknown",
                actorLevel: str(data.actorLevel) || "primary",
                action: str(data.action) || "update",
                targetPath: str(data.targetPath) || (data.targetUid ? `users/${data.targetUid}` : ""),
                // Early entries stored the path itself as the label; treat that as no label.
                targetLabel: (str(data.targetLabel) !== str(data.targetPath) && str(data.targetLabel)) || str(data.targetName),
                details: { ...legacyDetails, ...((data.details as Record<string, string>) ?? {}) },
                createdAt: str(data.createdAt),
              };
            }),
          );
          setLoading(false);
        },
        (failure) => {
          setError(failure.message);
          setLoading(false);
        },
      ),
    [],
  );

  const actors = useMemo(() => Array.from(new Set(rows.map((r) => r.actorName))).sort(), [rows]);
  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - (RANGES.find((r) => r.id === range)?.ms ?? Infinity);
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (actor && row.actorName !== actor) return false;
      if (action && row.action !== action) return false;
      if (Number.isFinite(cutoff) && Date.parse(row.createdAt) < cutoff) return false;
      if (!term) return true;
      return `${row.actorName} ${row.targetPath} ${row.targetLabel} ${Object.entries(row.details).join(" ")}`
        .toLowerCase()
        .includes(term);
    });
  }, [action, actor, range, rows, search]);

  const exportCsv = () => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      ["time", "actor", "level", "action", "target", "details"].join(","),
      ...filtered.map((row) =>
        [
          row.createdAt,
          row.actorName,
          row.actorLevel,
          row.action,
          row.targetPath,
          Object.entries(row.details)
            .map(([k, v]) => `${k}=${v}`)
            .join("; "),
        ]
          .map(escape)
          .join(","),
      ),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectClass = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search target, field or value…"
          aria-label="Search the audit log"
          className="h-9 min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
        />
        <select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Filter by person" className={selectClass}>
          <option value="">Everyone</option>
          {actors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action" className={selectClass}>
          <option value="">All actions</option>
          {actions.map((value) => (
            <option key={value} value={value}>
              {ACTION_LABELS[value] ?? value}
            </option>
          ))}
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} aria-label="Time range" className={selectClass}>
          {RANGES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 disabled:opacity-40"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <p className="m-0 text-[12px] text-slate-500">
        {loading ? "Loading…" : `${filtered.length} of ${rows.length} recorded changes`} · Visible only to the primary administrator.
      </p>

      {error && <p className="m-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <th scope="col" className="w-[150px] px-4 py-2.5 font-semibold">Time</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Person</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Action</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Target</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Changed fields</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No changes recorded for this filter.
                </td>
              </tr>
            )}
            {filtered.map((row) => {
              const target = describeTarget(row);
              const fields = Object.keys(row.details);
              const open = expanded === row.id;
              return (
                <React.Fragment key={row.id}>
                  <tr className="border-b border-slate-200 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-slate-500" title={row.createdAt}>
                      {row.createdAt ? (
                        <>
                          {new Date(row.createdAt).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}
                          <span className="block text-[11px] text-slate-400">
                            {new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-slate-800">{row.actorName}</span>
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
                          row.actorLevel === "moderator" ? "bg-indigo-50 text-indigo-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {row.actorLevel === "moderator" ? "Moderator" : "Primary"}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 font-semibold ${row.action === "delete" || row.action.endsWith("revoked") ? "text-rose-700" : "text-slate-700"}`}>
                      {ACTION_LABELS[row.action] ?? row.action}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block max-w-[280px] truncate text-slate-700" title={row.targetLabel || undefined}>
                        {row.targetLabel && row.targetLabel !== target.id ? row.targetLabel : target.kind}
                      </span>
                      <span className="block max-w-[280px] truncate font-mono text-[11.5px] text-slate-400" title={row.targetPath}>
                        {row.targetLabel && row.targetLabel !== target.id ? `${target.kind} · ${target.id}` : target.id}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {fields.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : row.id)}
                          aria-expanded={open}
                          className="text-left text-[12.5px] text-slate-600 hover:text-slate-900"
                        >
                          {fields.slice(0, 3).join(", ")}
                          {fields.length > 3 && ` +${fields.length - 3}`} <span className="text-slate-400">{open ? "▴" : "▾"}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td colSpan={5} className="px-4 py-3">
                        <dl className="m-0 grid gap-x-4 gap-y-1 font-mono text-[12px] sm:grid-cols-[180px_minmax(0,1fr)]">
                          {Object.entries(row.details).map(([key, value]) => (
                            <React.Fragment key={key}>
                              <dt className="text-slate-500">{key}</dt>
                              <dd className="m-0 break-words text-slate-700">{value}</dd>
                            </React.Fragment>
                          ))}
                        </dl>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogPage;
