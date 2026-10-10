import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "./core/auditedFirestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import type { CollaboratorProfile, User } from "../types";
import AdminModal from "./components/AdminModal";
import ConfirmDialog from "./components/ConfirmDialog";
import RowMenu, { type RowMenuItem } from "./components/RowMenu";

/* `short` heads the matrix columns, so every row has the same shape. */
const PERMISSIONS = [
  { id: "content.manage", short: "Content", label: "Website content", note: "Pages, theme, branding and announcements" },
  { id: "requests.manage", short: "Requests", label: "Collaboration requests", note: "Review and approve new team members" },
  { id: "collaborators.manage", short: "People", label: "People directory", note: "Manage active collaborator profiles" },
  { id: "publications.manage", short: "Papers", label: "Publications", note: "Maintain research output" },
  { id: "ideas.manage", short: "Ideas", label: "Research ideas", note: "Moderate ideas and discussions" },
  { id: "gallery.manage", short: "Gallery", label: "Media gallery", note: "Review and organize uploaded media" },
  { id: "messages.manage", short: "Inbox", label: "Communications", note: "Contact inbox and delivery status" },
] as const;

const ALL = PERMISSIONS.map((item) => item.id);

const PRESETS = [
  { label: "Content editor", values: ["content.manage", "publications.manage", "gallery.manage"] },
  { label: "People manager", values: ["requests.manage", "collaborators.manage"] },
  { label: "Full moderator", values: ALL },
] as const;

const labelFor = (id: string) => PERMISSIONS.find((item) => item.id === id)?.label ?? id;

/** One fixed-width cell per permission: a tick or a quiet dot. */
const PermissionCell: React.FC<{ on: boolean; label: string; tone?: "primary" }> = ({ on, label, tone }) => (
  <td className="px-1 py-3 text-center">
    {on ? (
      <span
        className={`inline-grid h-5 w-5 place-items-center rounded text-[12px] font-bold ${
          tone === "primary" ? "bg-amber-100 text-amber-800" : "bg-indigo-50 text-indigo-700"
        }`}
        title={`${label}: allowed`}
        aria-hidden="true"
      >
        ✓
      </span>
    ) : (
      <span className="text-slate-300" title={`${label}: not allowed`} aria-hidden="true">
        ·
      </span>
    )}
    <span className="sr-only">{on ? `${label}: allowed` : `${label}: not allowed`}</span>
  </td>
);

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
  targetUid?: string;
  targetName?: string;
  action?: string;
  permissions?: string[];
  createdAt?: string;
}

/** A moderator's proposed change, waiting for the primary admin. */
interface PermissionRequest {
  id: string;
  targetUid: string;
  targetName: string;
  targetEmail?: string;
  requestedByUid: string;
  requestedByName: string;
  currentPermissions: string[];
  requestedPermissions: string[];
  note?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const RolesPermissions: React.FC = () => {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<CollaboratorProfile[]>([]);
  const [usersReady, setUsersReady] = useState(false);
  const [profilesReady, setProfilesReady] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [requestNote, setRequestNote] = useState("");

  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
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

  /* The log now records every admin write; access changes are the entries
     that name a target account. */
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "adminAuditLog"), orderBy("createdAt", "desc"), limit(60)),
        (snapshot) => {
          setAudit(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }) as AuditEntry)
              .filter((entry) => Boolean(entry.targetUid))
              .slice(0, 8),
          );
        },
        () => {
          /* The log is supporting information; a failure here isn't worth a banner. */
        },
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "permissionRequests"), orderBy("createdAt", "desc"), limit(100)),
        (snapshot) => {
          setRequests(
            snapshot.docs.map((item) => {
              const data = item.data();
              return {
                id: item.id,
                targetUid: text(data.targetUid),
                targetName: text(data.targetName) || "Unknown account",
                targetEmail: text(data.targetEmail),
                requestedByUid: text(data.requestedByUid),
                requestedByName: text(data.requestedByName) || "A moderator",
                currentPermissions: Array.isArray(data.currentPermissions) ? data.currentPermissions.map(String) : [],
                requestedPermissions: Array.isArray(data.requestedPermissions) ? data.requestedPermissions.map(String) : [],
                note: text(data.note),
                status: data.status === "approved" || data.status === "rejected" ? data.status : "pending",
                createdAt: text(data.createdAt),
              } satisfies PermissionRequest;
            }),
          );
        },
        () => setRequests([]),
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

  const isProtected = (user: User) => user.uid === primaryUid || user.adminLevel === "primary" || user.role === "admin";
  const matches = (user: User, term: string) =>
    `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(term.trim().toLowerCase());

  const primaryAdmins = directory.filter(isProtected);
  const allModerators = directory.filter((user) => !isProtected(user) && user.adminLevel === "moderator");
  const moderators = allModerators.filter((user) => matches(user, search));
  /* Everyone who could be made a moderator. */
  const candidates = directory.filter(
    (user) => !isProtected(user) && user.adminLevel !== "moderator" && matches(user, pickerQuery),
  );

  const openPicker = () => {
    setPickerQuery("");
    setPickerOpen(true);
  };

  /* ---------------------------------------------------------- drawer */

  const openEditor = (user: User) => {
    returnFocusRef.current = document.activeElement as HTMLButtonElement | null;
    setEditing(user);
    setDraft(user.adminPermissions ?? []);
    setRequestNote("");
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

  /* ------------------------------------------------- approval workflow */

  const pendingFor = (uid: string) => requests.find((r) => r.status === "pending" && r.targetUid === uid);
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const visibleRequests = isPrimarySession
    ? pendingRequests
    : pendingRequests.filter((r) => r.requestedByUid === appUser?.uid);

  /** Moderators propose; the primary admin decides. */
  const submitRequest = async () => {
    if (!editing || !appUser || isPrimarySession) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "permissionRequests"), {
        targetUid: editing.uid,
        targetName: editing.name,
        targetEmail: editing.email || "",
        requestedByUid: appUser.uid,
        requestedByName: appUser.name || appUser.email || "Moderator",
        currentPermissions: editing.adminPermissions ?? [],
        requestedPermissions: draft,
        note: requestNote.trim().slice(0, 500),
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setNotice({ type: "success", text: `Request sent. The primary administrator will review access for ${editing.name}.` });
      closeEditor();
    } catch (error) {
      setNotice({ type: "error", text: String((error as Error).message || error) });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (request: PermissionRequest, approve: boolean) => {
    if (!isPrimarySession || !appUser) return;
    setBusy(true);
    try {
      if (approve) {
        const target =
          directory.find((user) => user.uid === request.targetUid) ??
          ({ uid: request.targetUid, name: request.targetName, email: request.targetEmail, role: "collaborator", createdAt: "" } as User);
        await writeAccess(target, request.requestedPermissions.length ? "moderator" : "none", request.requestedPermissions);
      }
      await updateDoc(doc(db, "permissionRequests", request.id), {
        status: approve ? "approved" : "rejected",
        decidedByUid: appUser.uid,
        decidedByName: appUser.name || "Primary administrator",
        decidedAt: new Date().toISOString(),
      });
      setNotice({
        type: "success",
        text: approve ? `Approved — ${request.targetName}'s access was updated.` : `Request for ${request.targetName} rejected.`,
      });
    } catch (error) {
      setNotice({ type: "error", text: String((error as Error).message || error) });
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async (request: PermissionRequest) => {
    setBusy(true);
    try {
      await deleteDoc(doc(db, "permissionRequests", request.id));
      setNotice({ type: "success", text: "Request withdrawn." });
    } catch (error) {
      setNotice({ type: "error", text: String((error as Error).message || error) });
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  /* ------------------------------------------------------------ view */

  return (
    <div className="space-y-4">
      {notice && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-[13px] font-semibold ${
            notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* ── Approval queue ── */}
      {visibleRequests.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50" aria-labelledby="pending-access-title">
          <header className="flex items-center gap-2 border-b border-amber-200 px-4 py-2.5">
            <h3 id="pending-access-title" className="m-0 text-[13.5px] font-semibold text-amber-900">
              {isPrimarySession ? "Awaiting your approval" : "Your pending requests"}
            </h3>
            <span className="rounded bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800">{visibleRequests.length}</span>
          </header>
          <ul className="m-0 list-none divide-y divide-amber-200 p-0">
            {visibleRequests.map((request) => {
              const grant = request.requestedPermissions.filter((id) => !request.currentPermissions.includes(id));
              const revoke = request.currentPermissions.filter((id) => !request.requestedPermissions.includes(id));
              return (
                <li key={request.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 text-[13px]">
                    <p className="m-0 font-semibold text-slate-800">
                      {request.targetName}
                      <span className="font-normal text-slate-500"> · requested by {request.requestedByName} · {formatDate(request.createdAt)}</span>
                    </p>
                    {grant.length > 0 && <p className="m-0 mt-1 text-emerald-700">+ Grant: {grant.map(labelFor).join(", ")}</p>}
                    {revoke.length > 0 && <p className="m-0 mt-0.5 text-rose-700">− Remove: {revoke.map(labelFor).join(", ")}</p>}
                    {request.requestedPermissions.length === 0 && <p className="m-0 mt-1 text-rose-700">Withdraw all administrative access</p>}
                    {request.note && <p className="m-0 mt-1 italic text-slate-500">“{request.note}”</p>}
                  </div>
                  <div className="flex gap-2">
                    {isPrimarySession ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void decide(request, false)}
                          className="h-8 rounded-md border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-700 disabled:opacity-40"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void decide(request, true)}
                          className="h-8 rounded-md bg-emerald-600 px-3 text-[12.5px] font-semibold text-white disabled:opacity-40"
                        >
                          Approve
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cancelRequest(request)}
                        className="h-8 rounded-md border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-700 disabled:opacity-40"
                      >
                        Withdraw request
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Moderators ── */}
      <section className="rounded-lg border border-slate-200 bg-white" aria-labelledby="moderators-title">
        <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5">
          <h3 id="moderators-title" className="m-0 text-[13.5px] font-semibold text-slate-800">
            Moderators <span className="ml-1 font-mono text-[12px] font-normal text-slate-500">{allModerators.length}</span>
          </h3>
          <label htmlFor="moderator-search" className="sr-only">
            Search moderators
          </label>
          <input
            id="moderator-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search moderators…"
            className="ml-auto h-8 w-full min-w-[160px] max-w-[260px] flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] outline-none"
          />
          <button type="button" onClick={openPicker} className="h-8 shrink-0 rounded-md bg-indigo-600 px-3 text-[12.5px] font-semibold text-white">
            + Add moderator
          </button>
        </header>

        {!isPrimarySession && !loading && (
          <p className="m-0 border-b border-slate-200 px-4 py-2 text-[12px] text-slate-500">
            Changes you make here are sent to the primary administrator for approval before they take effect.
          </p>
        )}

        <p role="status" aria-live="polite" className="sr-only">
          {loading ? "Loading moderators" : `${moderators.length} moderators shown`}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed border-collapse text-left text-[13px]">
            <colgroup>
              <col className="w-[250px]" />
              {PERMISSIONS.map((permission) => (
                <col key={permission.id} className="w-[74px]" />
              ))}
              <col className="w-[140px]" />
              <col className="w-[52px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">Account</th>
                {PERMISSIONS.map((permission) => (
                  <th key={permission.id} scope="col" title={permission.label} className="px-1 py-2.5 text-center font-semibold">
                    {permission.short}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2.5 font-semibold">Last change</th>
                <th scope="col" className="px-2 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }, (_, index) => (
                  <tr key={index} className="border-b border-slate-200 last:border-0">
                    <td colSpan={PERMISSIONS.length + 3} className="px-4 py-3.5">
                      <div className="h-3.5 w-1/3 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : (
                <>
                  {!search &&
                    primaryAdmins.map((user) => (
                      <tr key={user.uid} className="border-b border-slate-200">
                        <td className="px-4 py-3">
                          <p className="m-0 truncate font-semibold text-slate-800">
                            {user.name}
                            {user.uid === appUser?.uid && <span className="font-normal text-slate-400"> (you)</span>}
                          </p>
                          <p className="m-0 mt-0.5 flex items-center gap-2 text-[12px] text-slate-500">
                            <span className="rounded bg-amber-100 px-1.5 text-[10.5px] font-semibold text-amber-800">Primary admin</span>
                            <span className="truncate">{user.email}</span>
                          </p>
                        </td>
                        {PERMISSIONS.map((permission) => (
                          <PermissionCell key={permission.id} on label={permission.label} tone="primary" />
                        ))}
                        <td className="px-3 py-3 text-[12px] text-slate-400">Full access</td>
                        <td />
                      </tr>
                    ))}
                  {moderators.length === 0 ? (
                    <tr>
                      <td colSpan={PERMISSIONS.length + 3} className="px-4 py-10 text-center text-slate-500">
                        {search ? "No moderator matches your search." : "No moderators yet — use Add moderator to give a collaborator admin access."}
                      </td>
                    </tr>
                  ) : (
                    moderators.map((user) => {
                      const permissions = user.adminPermissions ?? [];
                      const isSelf = user.uid === appUser?.uid;
                      const pending = pendingFor(user.uid);
                      const menu: RowMenuItem[] = isPrimarySession
                        ? [
                            { label: "Edit permissions", onClick: () => openEditor(user) },
                            { label: "Remove moderator…", danger: true, separated: true, onClick: () => setConfirmWithdraw(user.uid) },
                          ]
                        : [{ label: pending ? "Change already pending" : "Request permission change", disabled: Boolean(pending), onClick: () => openEditor(user) }];
                      return (
                        <tr key={user.uid} className="border-b border-slate-200 last:border-0">
                          <td className="px-4 py-3">
                            <p className="m-0 truncate font-semibold text-slate-800">
                              {user.name}
                              {isSelf && <span className="font-normal text-slate-400"> (you)</span>}
                            </p>
                            <p className="m-0 mt-0.5 truncate text-[12px] text-slate-500">
                              {pending ? <span className="font-semibold text-amber-700">Change pending · </span> : null}
                              {user.email || "No email on record"}
                            </p>
                          </td>
                          {PERMISSIONS.map((permission) => (
                            <PermissionCell key={permission.id} on={permissions.includes(permission.id)} label={permission.label} />
                          ))}
                          <td className="px-3 py-3 text-[12px] text-slate-500">
                            {user.adminUpdatedByName ? (
                              <>
                                {formatDate(user.updatedAt)}
                                <span className="block truncate text-slate-400">by {user.adminUpdatedByName}</span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2 py-3 text-right">{isSelf ? null : <RowMenu label={`Access actions for ${user.name}`} items={menu} />}</td>
                        </tr>
                      );
                    })
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Add moderator: pick a collaborator who has no admin access yet ── */}
      <AdminModal
        open={pickerOpen}
        title="Add moderator"
        description={
          isPrimarySession
            ? "Choose a collaborator, then pick what they can manage."
            : "Choose a collaborator. Your proposal goes to the primary administrator for approval."
        }
        onClose={() => setPickerOpen(false)}
        width="520px"
      >
        <label htmlFor="moderator-picker-search" className="sr-only">
          Search collaborators
        </label>
        <input
          id="moderator-picker-search"
          type="search"
          autoFocus
          value={pickerQuery}
          onChange={(event) => setPickerQuery(event.target.value)}
          placeholder="Search collaborators by name or email…"
          className="mb-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none"
        />
        {candidates.length === 0 ? (
          <p className="m-0 py-8 text-center text-[13px] text-slate-500">
            {pickerQuery ? "No collaborator matches your search." : "Every collaborator already has admin access."}
          </p>
        ) : (
          <>
            <ul className="m-0 list-none divide-y divide-slate-200 rounded-lg border border-slate-200 p-0">
              {candidates.slice(0, pickerQuery ? 40 : 8).map((user) => {
                const pending = pendingFor(user.uid);
                return (
                  <li key={user.uid}>
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => {
                        setPickerOpen(false);
                        openEditor(user);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-[12px] font-bold text-slate-600" aria-hidden="true">
                        {text(user.name).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-800">{user.name}</span>
                        <span className="block truncate text-[12px] text-slate-500">
                          {user.email || "No email"} · <span className="capitalize">{text(user.role).replace("_", " ")}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold text-indigo-700">{pending ? "Pending" : "Select →"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!pickerQuery && candidates.length > 8 && (
              <p className="m-0 mt-2 text-center text-[12px] text-slate-500">
                Showing 8 of {candidates.length} — search to find others.
              </p>
            )}
          </>
        )}
      </AdminModal>

      {/* ── Recent access changes (primary admin only — the log is private) ── */}
      {isPrimarySession && audit.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <h3 className="m-0 border-b border-slate-200 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800">Recent access changes</h3>
          <ul className="m-0 list-none divide-y divide-slate-200 p-0">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2 text-[13px]">
                <span className="font-semibold text-slate-800">{entry.targetName || "An account"}</span>
                <span className="text-slate-600">
                  {entry.action === "moderator_access_revoked"
                    ? "had access withdrawn"
                    : `set to ${entry.permissions?.length ?? 0} permission${(entry.permissions?.length ?? 0) === 1 ? "" : "s"}`}
                </span>
                {entry.actorName && <span className="text-slate-500">by {entry.actorName}</span>}
                <span className="ml-auto text-[12px] tabular-nums text-slate-400">{formatDate(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(confirmWithdraw)}
        title="Remove moderator?"
        message={`${directory.find((u) => u.uid === confirmWithdraw)?.name ?? "This account"} will lose every admin permission immediately.`}
        confirmLabel="Remove moderator"
        danger
        busy={busy}
        onCancel={() => setConfirmWithdraw(null)}
        onConfirm={() => {
          const user = directory.find((u) => u.uid === confirmWithdraw);
          if (user) void withdraw(user);
        }}
      />

      {/* ── Editor drawer ── */}
      {editing && (
        <div className="fixed inset-0 z-[2147482000] flex justify-end bg-slate-950/60" onClick={() => !busy && closeEditor()}>
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-drawer-title"
            className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {editing.adminLevel !== "moderator"
                    ? isPrimarySession
                      ? "Add moderator"
                      : "Propose new moderator"
                    : isPrimarySession
                      ? "Edit permissions"
                      : "Request permission change"}
                </p>
                <h3 id="access-drawer-title" ref={headingRef} tabIndex={-1} className="m-0 mt-1 text-[17px] font-semibold text-slate-900 focus:outline-none">
                  {editing.name}
                </h3>
                <p className="m-0 mt-0.5 text-[12.5px] text-slate-500">{editing.email}</p>
              </div>
              <button type="button" disabled={busy} onClick={closeEditor} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-lg text-slate-500">
                ×
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-slate-500">Presets:</span>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDraft([...preset.values])}
                    className="h-7 rounded-md border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-700"
                  >
                    {preset.label}
                  </button>
                ))}
                <button type="button" onClick={() => setDraft([])} className="h-7 rounded-md px-2 text-[12px] font-semibold text-slate-500">
                  Clear
                </button>
              </div>

              <ul className="m-0 list-none divide-y divide-slate-200 rounded-lg border border-slate-200 p-0">
                {PERMISSIONS.map((permission) => {
                  const checked = draft.includes(permission.id);
                  return (
                    <li key={permission.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setDraft((prev) => (checked ? prev.filter((item) => item !== permission.id) : [...prev, permission.id]))
                          }
                          className="mt-0.5 h-4 w-4 shrink-0"
                        />
                        <span>
                          <span className="block text-[13.5px] font-semibold text-slate-800">{permission.label}</span>
                          <span className="block text-[12px] text-slate-500">{permission.note}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {!isPrimarySession && (
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-600">Reason for the primary administrator (optional)</span>
                  <textarea
                    rows={3}
                    value={requestNote}
                    onChange={(event) => setRequestNote(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                </label>
              )}
            </div>

            <footer className="border-t border-slate-200 px-5 py-3">
              <div className="mb-3 min-h-[20px] text-[12.5px]">
                {hasChanges ? (
                  <>
                    {added.length > 0 && <p className="m-0 text-emerald-700">+ {added.map(labelFor).join(", ")}</p>}
                    {removed.length > 0 && <p className="m-0 text-rose-700">− {removed.map(labelFor).join(", ")}</p>}
                  </>
                ) : (
                  <p className="m-0 text-slate-400">No changes yet.</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={closeEditor} className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-700">
                  Cancel
                </button>
                {isPrimarySession ? (
                  <button
                    type="button"
                    disabled={busy || !hasChanges}
                    onClick={() => void save(draft.length ? "moderator" : "none")}
                    className="h-9 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? "Saving…" : "Save access"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !hasChanges}
                    onClick={() => void submitRequest()}
                    className="h-9 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? "Sending…" : "Submit for approval"}
                  </button>
                )}
              </div>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
};

export default RolesPermissions;
