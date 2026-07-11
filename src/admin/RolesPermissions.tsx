import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
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

const RolesPermissions: React.FC = () => {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<CollaboratorProfile[]>([]);
  const [search, setSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState<"all" | "moderator" | "normal">("all");
  const [editing, setEditing] = useState<User | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const primaryUid = String(import.meta.env.VITE_ADMIN_UID || "");
  const isPrimarySession = appUser?.uid === primaryUid || appUser?.adminLevel === "primary" || appUser?.role === "admin";

  useEffect(() => onSnapshot(collection(db, "users"), (snapshot) => {
    // Firestore document ID is canonical. A stale uid field must never
    // redirect permission writes or create a duplicate merged account.
    setUsers(snapshot.docs.map((item) => ({ ...item.data(), uid: item.id }) as User).sort((a, b) => a.name.localeCompare(b.name)));
  }, (error) => setNotice({ type: "error", text: error.message })), []);

  useEffect(() => onSnapshot(collection(db, "collaborators"), (snapshot) => {
    setProfiles(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CollaboratorProfile));
  }, (error) => setNotice({ type: "error", text: error.message })), []);

  const directory = useMemo(() => {
    const byUid = new Map<string, User>();
    users.forEach((user) => user.uid && byUid.set(user.uid, user));
    profiles.forEach((profile) => {
      const uid = String(profile.uid || "").trim();
      if (!uid) return;
      const existing = byUid.get(uid);
      const legacyProfile = profile as CollaboratorProfile & { isModerator?: boolean; moderator?: boolean; isAdmin?: boolean; adminLevel?: string; adminPermissions?: string[]; permissions?: string[]; adminRole?: string };
      const legacy = existing as (User & { isModerator?: boolean; moderator?: boolean; isAdmin?: boolean; permissions?: string[]; adminRole?: string }) | undefined;
      const effectivePermissions = Array.isArray(existing?.adminPermissions) && existing.adminPermissions.length
        ? existing.adminPermissions
        : Array.isArray(legacy?.permissions) && legacy.permissions.length ? legacy.permissions
        : Array.isArray(legacyProfile.adminPermissions) && legacyProfile.adminPermissions.length ? legacyProfile.adminPermissions
        : Array.isArray(legacyProfile.permissions) ? legacyProfile.permissions : [];
      const hasLegacyModerator = legacy?.isModerator === true || legacy?.moderator === true || legacy?.isAdmin === true || legacyProfile.isModerator === true || legacyProfile.moderator === true || legacyProfile.isAdmin === true || legacyProfile.adminLevel === "moderator" || ["moderator", "moderator_admin"].includes(String(legacy?.adminRole || legacyProfile.adminRole || "").toLowerCase());
      byUid.set(uid, {
        uid,
        email: existing?.email || profile.email || "",
        name: profile.name || existing?.name || "Research team member",
        role: existing?.role || (uid === String(import.meta.env.VITE_LAB_HEAD_UID || "") ? "lab_head" : "collaborator"),
        createdAt: existing?.createdAt || profile.createdAt || new Date().toISOString(),
        adminLevel: uid === primaryUid
          ? "primary"
          : existing?.adminLevel === "moderator" || effectivePermissions.length > 0 || hasLegacyModerator
            ? "moderator"
            : "none",
        adminPermissions: effectivePermissions.length ? effectivePermissions : hasLegacyModerator ? [...ALL] : [],
        accountStatus: existing?.accountStatus || "active",
        collaboratorProfileId: existing?.collaboratorProfileId || profile.id || uid,
        updatedAt: existing?.updatedAt,
        adminUpdatedByUid: existing?.adminUpdatedByUid,
        adminUpdatedByName: existing?.adminUpdatedByName,
      });
    });
    return Array.from(byUid.values()).map((user) => ({
      ...user,
      adminLevel: user.uid === primaryUid || user.adminLevel === "primary" || user.role === "admin"
        ? "primary"
        : user.adminLevel === "moderator" || (user.adminPermissions?.length || 0) > 0
          ? "moderator"
          : "none",
    } as User)).sort((a, b) => a.name.localeCompare(b.name));
  }, [primaryUid, profiles, users]);

  const filtered = useMemo(() => directory.filter((user) => {
    const statusMatch = accessFilter === "all" || (accessFilter === "moderator" ? user.adminLevel === "moderator" : user.adminLevel === "none");
    return statusMatch && `${user.name} ${user.email} ${user.role} ${user.adminLevel}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [accessFilter, directory, search]);
  const moderators = directory.filter((user) => user.adminLevel === "moderator").length;
  const openEditor = (user: User) => { setEditing(user); setDraft(user.adminPermissions ?? []); setNotice(null); };
  const saveDirect = async (user: User) => {
    if (!isPrimarySession || user.uid === primaryUid || user.uid === appUser?.uid) return;
    setBusy(true);
    const updatedAt = new Date().toISOString();
    try {
      await setDoc(doc(db, "users", user.uid), { adminLevel: "none", adminPermissions: [], updatedAt, adminUpdatedByUid: appUser?.uid || "", adminUpdatedByName: appUser?.name || "Primary administrator" }, { merge: true });
      setUsers((current) => current.map((item) => item.uid === user.uid ? { ...item, adminLevel: "none", adminPermissions: [], updatedAt, adminUpdatedByUid: appUser?.uid, adminUpdatedByName: appUser?.name } : item));
      try { await setDoc(doc(collection(db, "adminAuditLog")), { actorUid: appUser?.uid, actorName: appUser?.name, targetUid: user.uid, targetName: user.name, action: "moderator_access_revoked", permissions: [], createdAt: updatedAt }); } catch (auditError) { console.warn("Access withdrawn; audit logging failed:", auditError); }
      setNotice({ type: "success", text: `${user.name}'s administrative power was withdrawn.` });
      setEditing(null);
    } catch (error) { setNotice({ type: "error", text: String((error as Error).message || error) }); }
    finally { setBusy(false); }
  };
  const save = async (level: "moderator" | "none") => {
    if (!editing || !isPrimarySession || editing.uid === primaryUid || editing.uid === appUser?.uid) return;
    setBusy(true);
    try {
      const permissions = level === "moderator" ? draft : [];
      await setDoc(doc(db, "users", editing.uid), {
        uid: editing.uid,
        name: editing.name,
        email: editing.email,
        role: editing.role,
        createdAt: editing.createdAt || new Date().toISOString(),
        accountStatus: editing.accountStatus || "active",
        collaboratorProfileId: editing.collaboratorProfileId || editing.uid,
        adminLevel: level,
        adminPermissions: permissions,
        updatedAt: new Date().toISOString(),
        adminUpdatedByUid: appUser?.uid || "",
        adminUpdatedByName: appUser?.name || "Primary administrator",
      }, { merge: true });
      const updatedAt = new Date().toISOString();
      setUsers((current) => {
        const next: User = { ...editing, adminLevel: level, adminPermissions: permissions, updatedAt, adminUpdatedByUid: appUser?.uid, adminUpdatedByName: appUser?.name };
        return current.some((user) => user.uid === editing.uid) ? current.map((user) => user.uid === editing.uid ? next : user) : [...current, next];
      });
      let auditWarning = "";
      try {
        await setDoc(doc(collection(db, "adminAuditLog")), { actorUid: appUser?.uid, actorName: appUser?.name, targetUid: editing.uid, targetName: editing.name, action: level === "moderator" ? "moderator_access_updated" : "moderator_access_revoked", permissions, createdAt: updatedAt });
      } catch (auditError) {
        console.warn("Permission saved, but audit logging failed:", auditError);
        auditWarning = " Permission was saved, but the audit entry could not be written.";
      }
      setNotice({ type: "success", text: (level === "moderator" ? `${editing.name}'s moderator access is active.` : `${editing.name}'s administrative power was withdrawn.`) + auditWarning });
      setEditing(null);
    } catch (error) { setNotice({ type: "error", text: String((error as Error).message || error) }); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-6 text-white shadow-xl md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em]">Access governance</span><h2 className="mt-4 text-3xl font-black tracking-tight">Roles & Permissions</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100/75">Grant only the tools each moderator needs. Base Lab Head and collaborator roles remain unchanged.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3"><p className="text-2xl font-black">{directory.length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-white/55">Team accounts</p></div><div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3"><p className="text-2xl font-black">{moderators}</p><p className="text-[10px] font-bold uppercase tracking-wider text-white/55">Moderators</p></div></div></div>
    </section>
    {notice && <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{notice.text}</div>}
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><span className="mr-2 text-xs font-black uppercase tracking-wider text-slate-400">Access view</span>{([['all','All accounts'],['moderator',`Moderators (${moderators})`],['normal','Normal mode']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setAccessFilter(value)} className={`rounded-xl px-4 py-2 text-xs font-black ${accessFilter === value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>)}</div>
    <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between"><div><h3 className="font-black text-slate-900">Team access directory</h3><p className="text-xs text-slate-500">The primary administrator is permanently protected.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or role…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 md:w-72" /></div>
      <div className="divide-y divide-slate-100">{filtered.map((user) => { const protectedUser = user.uid === primaryUid || user.adminLevel === "primary" || user.role === "admin"; const moderator = user.adminLevel === "moderator"; return <div key={user.uid} className={`flex flex-col gap-4 p-5 transition md:flex-row md:items-center ${moderator ? "bg-indigo-50/40" : "hover:bg-slate-50/70"}`}><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-sky-100 font-black text-indigo-800">{user.name?.slice(0, 1).toUpperCase() || "U"}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-slate-900">{user.name}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${protectedUser ? "bg-amber-100 text-amber-800" : moderator ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>{protectedUser ? "Primary admin" : moderator ? "Moderator administrator" : "Normal mode"}</span><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-400">{user.role.replace("_", " ")}</span></div><p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>{moderator && <div className="mt-2"><p className="text-[11px] font-black text-indigo-700">{user.adminPermissions?.length || 0} of {PERMISSIONS.length} permissions active</p>{user.adminUpdatedByName && <p className="mt-1 text-[10px] text-slate-400">Last changed by {user.adminUpdatedByName}</p>}</div>}</div><div className="flex flex-wrap gap-2"><button disabled={!isPrimarySession || protectedUser} onClick={() => openEditor(user)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">{protectedUser ? "Protected" : moderator ? "Manage access" : "Grant access"}</button>{moderator && !protectedUser && <button disabled={!isPrimarySession || busy} onClick={() => { if (window.confirm(`Withdraw all administrative power from ${user.name}?`)) { setEditing(user); setDraft(user.adminPermissions || []); window.setTimeout(() => void saveDirect(user), 0); } }} className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-100">Withdraw admin power</button>}</div></div>; })}</div>
    </section>
    {editing && <div className="fixed inset-0 z-[2147482000] flex justify-end bg-slate-950/55 backdrop-blur-sm" onClick={() => !busy && setEditing(null)}><aside className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-6 backdrop-blur"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Moderator configuration</p><h3 className="mt-1 text-2xl font-black text-slate-900">{editing.name}</h3><p className="mt-1 text-sm text-slate-500">{editing.email}</p></div><button disabled={busy} onClick={() => setEditing(null)} className="h-10 w-10 rounded-full border border-slate-200 bg-white text-lg">×</button></div></div><div className="space-y-6 p-6"><div><p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Permission presets</p><div className="flex flex-wrap gap-2">{PRESETS.map((preset) => <button key={preset.label} onClick={() => setDraft([...preset.values])} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">{preset.label}</button>)}<button onClick={() => setDraft([])} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">Clear all</button></div></div><div className="grid gap-3">{PERMISSIONS.map((permission) => { const checked = draft.includes(permission.id); return <button key={permission.id} onClick={() => setDraft((current) => checked ? current.filter((item) => item !== permission.id) : [...current, permission.id])} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${checked ? "border-indigo-300 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white"}`}><span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md text-xs font-black ${checked ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{checked ? "✓" : ""}</span><span><span className="block text-sm font-black text-slate-900">{permission.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{permission.note}</span></span></button>; })}</div></div><div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white p-5"><button disabled={busy || editing.adminLevel !== "moderator"} onClick={() => void save("none")} className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-black text-rose-700 disabled:opacity-40">Revoke access</button><button disabled={busy || draft.length === 0} onClick={() => void save("moderator")} className="rounded-xl bg-indigo-600 px-6 py-3 text-xs font-black text-white shadow-lg shadow-indigo-200 disabled:opacity-40">{busy ? "Saving…" : "Save moderator access"}</button></div></aside></div>}
  </div>;
};

export default RolesPermissions;
