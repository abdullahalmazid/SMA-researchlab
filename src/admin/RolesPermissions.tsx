import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import type { CollaboratorProfile, User } from "../types";

const PERMISSIONS = [
  { id: "content.manage", label: "Website content", note: "Pages, theme, branding and announcements" },
  { id: "requests.manage", label: "Collaboration requests", note: "Review and approve new team members" },
  { id: "collaborators.manage", label: "People directory", note: "Manage active collaborator profiles" },
  { id: "publications.manage", label: "Publications", note: "Maintain research output" },
  { id: "ideas.manage", label: "Research ideas", note: "Moderate ideas and discussions" },
  { id: "gallery.manage", label: "Media gallery", note: "Review and organize uploaded media" },
  { id: "messages.manage", label: "Communications", note: "Contact inbox and delivery status" },
] as const;

const ALL = PERMISSIONS.map((item) => item.id);

const PRESETS = [
  { label: "Content editor", values: ["content.manage", "publications.manage", "gallery.manage"] },
  { label: "People manager", values: ["requests.manage", "collaborators.manage"] },
  { label: "Full moderator", values: ALL },
] as const;

const labelFor = (id: string) => PERMISSIONS.find((item) => item.id === id)?.label ?? id;

/* ------------------------------------------------------------------ *
 * Defensive reads
 *
 * A single `users` document with no `name` made `.sort((a, b) =>
 * a.name.localeCompare(b.name))` throw inside the snapshot callback. That
 * exception isn't caught by onSnapshot's error argument — that one only sees
 * Firestore errors — so setUsers never ran, `users` stayed empty, and the whole
 * directory silently fell back to the collaborators collection, which carries
 * no permissions at all. Hence "8 team accounts, 0 moderators" after every
 * refresh, while in-session edits looked fine because they patched local state.
 * ------------------------------------------------------------------ */

const text = (value: unknown) => (typeof value === "string" ? value : "");
const byName = <T extends { name?: string }>(a: T, b: T) =>
  text(a.name).localeCompare(text(b.name));

interface AuditEntry {
  id: string;
  actorName?: string;
  targetName?: string;
  action?: string;
  permissions?: string[];
  createdAt?: string;
}

const RolesPermissions: React.FC = () => {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<CollaboratorProfile[]>([]);
  const [usersReady, setUsersReady] = useState(false);
  const [profilesReady, setProfilesReady] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState<"all" | "moderator" | "normal">("all");
  const [editing, setEditing] = useState<User | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const drawerRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  const primaryUid = String(import.meta.env.VITE_ADMIN_UID || "");
  const isPrimarySession =
    appUser?.uid === primaryUid || appUser?.adminLevel === "primary" || appUser?.role === "admin";

  const loading = !usersReady || !profilesReady;

  /* ------------------------------------------------------------ data */

  useEffect(
    () =>
      onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          try {
            // Firestore document ID is canonical. A stale uid field must never
            // redirect permission writes or create a duplicate merged account.
            setUsers(
              snapshot.docs
                .map((item) => ({ ...item.data(), uid: item.id }) as User)
                .sort(byName),
            );
          } catch (error) {
            /* One malformed document must not blank the entire screen. */
            setNotice({
              type: "error",
              text: `Some accounts couldn't be read: ${String((error as Error).message || error)}`,
            });
          } finally {
            setUsersReady(true);
          }
        },
        (error) => {
          setNotice({ type: "error", text: error.message });
          setUsersReady(true);
        },
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        collection(db, "collaborators"),
        (snapshot) => {
          try {
            setProfiles(
              snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CollaboratorProfile),
            );
          } catch (error) {
            setNotice({
              type: "error",
              text: `Some profiles couldn't be read: ${String((error as Error).message || error)}`,
            });
          } finally {
            setProfilesReady(true);
          }
        },
        (error) => {
          setNotice({ type: "error", text: error.message });
          setProfilesReady(true);
        },
      ),
    [],
  );

  /* Every change already writes here — it just had no reader. */
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "adminAuditLog"), orderBy("createdAt", "desc"), limit(8)),
        (snapshot) => {
          setAudit(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AuditEntry));
        },
        () => {
          /* The log is supporting information; a failure here isn't worth a banner. */
        },
      ),
    [],
  );

  const directory = useMemo(() => {
    const byUid = new Map<string, User>();
    users.forEach((user) => user.uid && byUid.set(user.uid, user));

    profiles.forEach((profile) => {
      const uid = text(profile.uid).trim();
      if (!uid) return;
      const existing = byUid.get(uid);
      const legacyProfile = profile as CollaboratorProfile & {
        isModerator?: boolean;
        moderator?: boolean;
        isAdmin?: boolean;
        adminLevel?: string;
        adminPermissions?: string[];
        permissions?: string[];
        adminRole?: string;
      };
      const legacy = existing as
        | (User & {
            isModerator?: boolean;
            moderator?: boolean;
            isAdmin?: boolean;
            permissions?: string[];
            adminRole?: string;
          })
        | undefined;

      const effectivePermissions =
        Array.isArray(existing?.adminPermissions) && existing.adminPermissions.length
          ? existing.adminPermissions
          : Array.isArray(legacy?.permissions) && legacy.permissions.length
            ? legacy.permissions
            : Array.isArray(legacyProfile.adminPermissions) && legacyProfile.adminPermissions.length
              ? legacyProfile.adminPermissions
              : Array.isArray(legacyProfile.permissions)
                ? legacyProfile.permissions
                : [];

      const hasLegacyModerator =
        legacy?.isModerator === true ||
        legacy?.moderator === true ||
        legacy?.isAdmin === true ||
        legacyProfile.isModerator === true ||
        legacyProfile.moderator === true ||
        legacyProfile.isAdmin === true ||
        legacyProfile.adminLevel === "moderator" ||
        ["moderator", "moderator_admin"].includes(
          text(legacy?.adminRole || legacyProfile.adminRole).toLowerCase(),
        );

      byUid.set(uid, {
        uid,
        email: existing?.email || profile.email || "",
        name: profile.name || existing?.name || "Research team member",
        role:
          existing?.role ||
          (uid === String(import.meta.env.VITE_LAB_HEAD_UID || "") ? "lab_head" : "collaborator"),
        createdAt: existing?.createdAt || profile.createdAt || new Date().toISOString(),
        adminLevel:
          uid === primaryUid
            ? "primary"
            : existing?.adminLevel === "moderator" ||
                effectivePermissions.length > 0 ||
                hasLegacyModerator
              ? "moderator"
              : "none",
        adminPermissions: effectivePermissions.length
          ? effectivePermissions
          : hasLegacyModerator
            ? [...ALL]
            : [],
        accountStatus: existing?.accountStatus || "active",
        collaboratorProfileId: existing?.collaboratorProfileId || profile.id || uid,
        updatedAt: existing?.updatedAt,
        adminUpdatedByUid: existing?.adminUpdatedByUid,
        adminUpdatedByName: existing?.adminUpdatedByName,
      });
    });

    return Array.from(byUid.values())
      .map(
        (user) =>
          ({
            ...user,
            name: user.name || "Unnamed account",
            role: user.role || "collaborator",
            adminLevel:
              user.uid === primaryUid || user.adminLevel === "primary" || user.role === "admin"
                ? "primary"
                : user.adminLevel === "moderator" || (user.adminPermissions?.length || 0) > 0
                  ? "moderator"
                  : "none",
          }) as User,
      )
      .sort(byName);
  }, [primaryUid, profiles, users]);

  const filtered = useMemo(
    () =>
      directory.filter((user) => {
        const statusMatch =
          accessFilter === "all" ||
          (accessFilter === "moderator"
            ? user.adminLevel === "moderator"
            : user.adminLevel === "none");
        return (
          statusMatch &&
          `${user.name} ${user.email} ${user.role} ${user.adminLevel}`
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        );
      }),
    [accessFilter, directory, search],
  );

  const moderators = directory.filter((user) => user.adminLevel === "moderator").length;

  /* ---------------------------------------------------------- drawer */

  const openEditor = (user: User, trigger: HTMLButtonElement) => {
    returnFocusRef.current = trigger;
    setEditing(user);
    setDraft(user.adminPermissions ?? []);
    setNotice(null);
  };

  const closeEditor = () => {
    setEditing(null);
    returnFocusRef.current?.focus();
    returnFocusRef.current = null;
  };

  useEffect(() => {
    if (!editing) return;
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }, [editing]);

  /* Escape closes and Tab is trapped — the drawer had neither, so a keyboard
     user could tab straight out into the list behind it. */
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        closeEditor();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled), input:not(:disabled)",
        ),
      ).filter((element) => element.offsetParent !== null);
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
  }, [editing, busy]);

  /* ---------------------------------------------------------- writes */

  const writeAccess = async (user: User, level: "moderator" | "none", permissions: string[]) => {
    const updatedAt = new Date().toISOString();
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt || updatedAt,
        accountStatus: user.accountStatus || "active",
        collaboratorProfileId: user.collaboratorProfileId || user.uid,
        adminLevel: level,
        adminPermissions: permissions,
        updatedAt,
        adminUpdatedByUid: appUser?.uid || "",
        adminUpdatedByName: appUser?.name || "Primary administrator",
      },
      { merge: true },
    );

    setUsers((current) => {
      const next: User = {
        ...user,
        adminLevel: level,
        adminPermissions: permissions,
        updatedAt,
        adminUpdatedByUid: appUser?.uid,
        adminUpdatedByName: appUser?.name,
      };
      return current.some((item) => item.uid === user.uid)
        ? current.map((item) => (item.uid === user.uid ? next : item))
        : [...current, next];
    });

    let auditWarning = "";
    try {
      await setDoc(doc(collection(db, "adminAuditLog")), {
        actorUid: appUser?.uid,
        actorName: appUser?.name,
        targetUid: user.uid,
        targetName: user.name,
        action: level === "moderator" ? "moderator_access_updated" : "moderator_access_revoked",
        permissions,
        createdAt: updatedAt,
      });
    } catch (auditError) {
      console.warn("Permission saved, but audit logging failed:", auditError);
      auditWarning = " The change was saved, but the audit entry could not be written.";
    }
    return auditWarning;
  };

  const withdraw = async (user: User) => {
    if (!isPrimarySession || user.uid === primaryUid || user.uid === appUser?.uid) return;
    setBusy(true);
    try {
      const warning = await writeAccess(user, "none", []);
      setNotice({
        type: "success",
        text: `${user.name}'s administrative access was withdrawn.${warning}`,
      });
      setConfirmWithdraw(null);
      if (editing?.uid === user.uid) closeEditor();
    } catch (error) {
      setNotice({ type: "error", text: String((error as Error).message || error) });
    } finally {
      setBusy(false);
    }
  };

  const save = async (level: "moderator" | "none") => {
    if (!editing || !isPrimarySession || editing.uid === primaryUid || editing.uid === appUser?.uid) {
      return;
    }
    setBusy(true);
    try {
      const permissions = level === "moderator" ? draft : [];
      const warning = await writeAccess(editing, level, permissions);
      setNotice({
        type: "success",
        text:
          (level === "moderator"
            ? `${editing.name} now has ${permissions.length} of ${PERMISSIONS.length} permissions.`
            : `${editing.name}'s administrative access was withdrawn.`) + warning,
      });
      closeEditor();
    } catch (error) {
      setNotice({ type: "error", text: String((error as Error).message || error) });
    } finally {
      setBusy(false);
    }
  };

  /* The diff, so nobody grants something by mis-click. */
  const current = editing?.adminPermissions ?? [];
  const added = draft.filter((id) => !current.includes(id));
  const removed = current.filter((id) => !draft.includes(id));
  const hasChanges = added.length > 0 || removed.length > 0;

  /* ------------------------------------------------------------ view */

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em]">
              Access governance
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight">Roles &amp; Permissions</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100/80">
              Grant only the tools each moderator needs. Base Lab Head and collaborator roles
              remain unchanged.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3">
              <p className="text-2xl font-black tabular-nums">
                {loading ? "—" : directory.length}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                Team accounts
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3">
              <p className="text-2xl font-black tabular-nums">{loading ? "—" : moderators}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                Moderators
              </p>
            </div>
          </div>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {!isPrimarySession && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          You can view access levels here, but only the primary administrator can change them.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="mr-2 text-xs font-black uppercase tracking-wider text-slate-500">
          Access view
        </span>
        {(
          [
            ["all", `All accounts (${directory.length})`],
            ["moderator", `Moderators (${moderators})`],
            ["normal", `Normal mode (${directory.length - moderators})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={accessFilter === value}
            onClick={() => setAccessFilter(value)}
            className={`rounded-xl px-4 py-2 text-xs font-black transition ${
              accessFilter === value
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-black text-slate-900">Team access directory</h3>
            <p className="text-xs text-slate-500">
              The primary administrator is permanently protected.
            </p>
          </div>
          <div className="w-full md:w-72">
            <label htmlFor="access-search" className="sr-only">
              Search the access directory
            </label>
            <input
              id="access-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or role…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {loading ? "Loading accounts" : `${filtered.length} accounts shown`}
        </p>

        {loading ? (
          /* Previously an empty directory rendered as "no accounts", which is
             what made the sort crash look like a styling problem. */
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 p-5">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
                <div className="flex-1">
                  <div className="h-3.5 w-40 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-56 animate-pulse rounded bg-slate-50" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-bold text-slate-700">No accounts match this view.</p>
            <p className="mt-1 text-xs text-slate-500">
              Try another access view, or clear the search.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((user) => {
              const protectedUser =
                user.uid === primaryUid || user.adminLevel === "primary" || user.role === "admin";
              const moderator = user.adminLevel === "moderator";
              const permissions = user.adminPermissions ?? [];
              const isSelf = user.uid === appUser?.uid;

              return (
                <li
                  key={user.uid}
                  className={`p-5 transition ${moderator ? "bg-indigo-50/40" : "hover:bg-slate-50/70"}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-sky-100 font-black text-indigo-800">
                      {text(user.name).slice(0, 1).toUpperCase() || "U"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-black text-slate-900">{user.name}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                            protectedUser
                              ? "bg-amber-100 text-amber-900"
                              : moderator
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {protectedUser
                            ? "Primary admin"
                            : moderator
                              ? "Moderator"
                              : "Normal mode"}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-500 ring-1 ring-slate-200">
                          {text(user.role).replace("_", " ") || "collaborator"}
                        </span>
                      </div>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {user.email || "No email on record"}
                      </p>

                      {/* The whole point of this screen: which permissions, not
                          how many. The count alone meant opening the drawer to
                          answer the question the list should already answer. */}
                      {moderator && (
                        <div className="mt-2.5">
                          {permissions.length === 0 ? (
                            <p className="text-[11px] font-bold text-amber-700">
                              Marked as moderator with no permissions granted
                            </p>
                          ) : (
                            <ul className="flex flex-wrap gap-1.5">
                              {permissions.map((id) => (
                                <li
                                  key={id}
                                  className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-indigo-800 ring-1 ring-indigo-200"
                                >
                                  {labelFor(id)}
                                </li>
                              ))}
                            </ul>
                          )}
                          {user.adminUpdatedByName && (
                            <p className="mt-1.5 text-[10.5px] text-slate-500">
                              Last changed by {user.adminUpdatedByName}
                            </p>
                          )}
                        </div>
                      )}

                      {protectedUser && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Full access, and it can&apos;t be changed from here.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!isPrimarySession || protectedUser || isSelf}
                        onClick={(event) => openEditor(user, event.currentTarget)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {protectedUser
                          ? "Protected"
                          : isSelf
                            ? "Your account"
                            : moderator
                              ? "Manage access"
                              : "Grant access"}
                      </button>

                      {moderator && !protectedUser && !isSelf && (
                        <button
                          type="button"
                          disabled={!isPrimarySession || busy}
                          onClick={() => setConfirmWithdraw(user.uid)}
                          className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-40"
                        >
                          Withdraw access
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline confirm. The old version fired window.confirm, then
                      setEditing, then a setTimeout(0) to call the save — a state
                      race pretending to be a callback. */}
                  {confirmWithdraw === user.uid && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                      <p className="text-[13px] font-bold text-rose-900">
                        Withdraw all administrative access from {user.name}?
                      </p>
                      <div className="ml-auto flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void withdraw(user)}
                          className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                        >
                          {busy ? "Withdrawing…" : "Withdraw"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmWithdraw(null)}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700"
                        >
                          Keep access
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* The audit log was written on every change and never read. */}
      {audit.length > 0 && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">Recent access changes</h3>
          <ul className="mt-4 divide-y divide-slate-100">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5">
                <span className="text-[13px] font-bold text-slate-800">
                  {entry.targetName || "An account"}
                </span>
                <span className="text-[13px] text-slate-600">
                  {entry.action === "moderator_access_revoked"
                    ? "had access withdrawn"
                    : `was granted ${entry.permissions?.length ?? 0} permission${
                        (entry.permissions?.length ?? 0) === 1 ? "" : "s"
                      }`}
                </span>
                {entry.actorName && (
                  <span className="text-[12px] text-slate-500">by {entry.actorName}</span>
                )}
                <span className="ml-auto text-[11.5px] tabular-nums text-slate-400">
                  {entry.createdAt
                    ? new Date(entry.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------------ drawer */}
      {editing && (
        <div
          className="fixed inset-0 z-[2147482000] flex justify-end bg-slate-950/55 backdrop-blur-sm"
          onClick={() => !busy && closeEditor()}
        >
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-drawer-title"
            className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-6 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-indigo-700">
                    Moderator configuration
                  </p>
                  <h3
                    id="access-drawer-title"
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-1 text-2xl font-black text-slate-900 focus:outline-none"
                  >
                    {editing.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">{editing.email}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeEditor}
                  aria-label="Close"
                  className="h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-white text-lg"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-600">
                  Permission presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDraft([...preset.values])}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-800"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDraft([])}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              {/* Real checkboxes. These were <button>s with a tick glyph, so a
                  screen reader announced "button" and nothing about state. */}
              <ul className="grid gap-3">
                {PERMISSIONS.map((permission) => {
                  const checked = draft.includes(permission.id);
                  return (
                    <li key={permission.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                          checked
                            ? "border-indigo-300 bg-indigo-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setDraft((prev) =>
                              checked
                                ? prev.filter((item) => item !== permission.id)
                                : [...prev, permission.id],
                            )
                          }
                          className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-600"
                        />
                        <span>
                          <span className="block text-sm font-black text-slate-900">
                            {permission.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-600">
                            {permission.note}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-5">
              {/* What is about to change, in words, above the button that does it. */}
              <div className="mb-4 text-[12.5px] leading-6">
                {hasChanges ? (
                  <>
                    {added.length > 0 && (
                      <p className="font-semibold text-emerald-800">
                        Adding: {added.map(labelFor).join(", ")}
                      </p>
                    )}
                    {removed.length > 0 && (
                      <p className="font-semibold text-rose-800">
                        Removing: {removed.map(labelFor).join(", ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500">No changes yet.</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={busy || editing.adminLevel !== "moderator"}
                  onClick={() => void save("none")}
                  className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-black text-rose-700 disabled:opacity-40"
                >
                  Revoke all access
                </button>
                <button
                  type="button"
                  disabled={busy || draft.length === 0 || !hasChanges}
                  onClick={() => void save("moderator")}
                  className="rounded-xl bg-indigo-600 px-6 py-3 text-xs font-black text-white shadow-lg shadow-indigo-200 disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Save moderator access"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default RolesPermissions;
