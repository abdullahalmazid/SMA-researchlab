import { collection, onSnapshot, query, where } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { ChevronsLeft, ChevronsRight, CornerDownLeft, Lock, LogOut, Menu, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ContactMessages, ManageAnnouncements } from "../admin/AdminSections";
import "../admin/adminConsole.css";
import {
  ADMIN_DESCRIPTIONS,
  ADMIN_ROUTE_TO_SECTION,
  ADMIN_SECTION_PERMISSION,
  ADMIN_SECTION_TO_ROUTE,
  buildAdminNavigation,
  PRIMARY_ONLY_SECTIONS,
  type AdminNavItem as NavItem,
  type AdminSection as Section,
} from "../admin/app/adminNavigation";
import ThemeControl from "../admin/features/appearance/AppearancePage";
import BrandingControl from "../admin/features/branding/BrandingPage";
import ManageCollaborators from "../admin/features/collaborators/CollaboratorsPage";
import ContentEditor from "../admin/features/content/ContentPage";
import DeliveryStatusDashboard from "../admin/features/delivery/DeliveryPage";
import ManageGallery from "../admin/features/gallery/GalleryPage";
import RolesPermissions from "../admin/features/permissions/PermissionsPage";
import ManagePublications from "../admin/features/publications/PublicationsPage";
import CollaboratorRequests from "../admin/features/requests/RequestsPage";
import ManageResearchIdeas from "../admin/features/research-ideas/ResearchIdeasPage";
import AnalyticsPage from "../admin/features/analytics/AnalyticsPage";
import AuditLogPage from "../admin/features/audit/AuditLogPage";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import { auth, db } from "../firebase/config";
import { useAnnouncements, useCollaborators, usePublications, useResearchIdeas, useSiteContent } from "../firebase/hooks";
import type { ContactMessage } from "../types";

const SIDEBAR_KEY = "rl_admin_sidebar_collapsed";
const LOCK_KEY = "rl_admin_locked";
/** Idle time before the console locks and asks for the password again. */
const IDLE_LOCK_MS = 15 * 60_000;

/** Core copy the site needs; the overview flags any that are still empty. */
const CORE_CONTENT_KEYS: { key: string; label: string }[] = [
  { key: "home.heroTitle", label: "Home hero title" },
  { key: "home.heroSubtitle", label: "Home hero subtitle" },
  { key: "home.introTitle", label: "Home intro title" },
  { key: "home.introText", label: "Home intro text" },
  { key: "home.bannerUrl", label: "Home banner image" },
  { key: "contact.email", label: "Contact email" },
  { key: "contact.phone", label: "Contact phone" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { appUser, logout } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [pendingNames, setPendingNames] = useState<string[]>([]);
  const [pendingAccess, setPendingAccess] = useState<{ target: string; by: string }[]>([]);
  const [locked, setLocked] = useState(() => {
    try {
      return sessionStorage.getItem(LOCK_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const commandInputRef = useRef<HTMLInputElement>(null);
  const contentScrollRef = useRef<HTMLElement>(null);

  const { content } = useSiteContent();
  const { collaborators } = useCollaborators();
  const { ongoing, published } = usePublications();
  const { ideas } = useResearchIdeas();
  const announcements = useAnnouncements();

  /* The console skin is scoped to <body> so portalled modals get it too. */
  useEffect(() => {
    document.body.classList.add("admin-console-active");
    return () => document.body.classList.remove("admin-console-active");
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [collapsed]);

  useEffect(() => {
    const slug = location.pathname.replace(/^\/admin\/?/, "");
    if (ADMIN_ROUTE_TO_SECTION[slug]) setSection(ADMIN_ROUTE_TO_SECTION[slug]);
  }, [location.pathname]);

  useEffect(() => {
    const unsubMessages = onSnapshot(
      collection(db, "contactMessages"),
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContactMessage)),
      (error) => console.error("Admin messages error:", error),
    );
    const unsubPending = onSnapshot(
      query(collection(db, "pendingRequests"), where("status", "==", "pending")),
      (snap) => setPendingNames(snap.docs.map((d) => String(d.data().name ?? "Unnamed applicant"))),
      (error) => console.error("Admin requests error:", error),
    );
    const unsubAccess = onSnapshot(
      query(collection(db, "permissionRequests"), where("status", "==", "pending")),
      (snap) => setPendingAccess(snap.docs.map((d) => ({ target: String(d.data().targetName ?? "an account"), by: String(d.data().requestedByName ?? "a moderator") }))),
      () => setPendingAccess([]),
    );
    return () => {
      unsubMessages();
      unsubPending();
      unsubAccess();
    };
  }, []);

  /* ── Auto-lock after inactivity ───────────────────────────────────── */
  useEffect(() => {
    try {
      sessionStorage.setItem(LOCK_KEY, locked ? "1" : "0");
    } catch {
      /* private mode */
    }
    if (locked) return;
    let timer = window.setTimeout(() => setLocked(true), IDLE_LOCK_MS);
    let last = Date.now();
    const activity = () => {
      if (Date.now() - last < 2000) return;
      last = Date.now();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), IDLE_LOCK_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, activity));
    };
  }, [locked]);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user?.email) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, unlockPassword));
      setLocked(false);
      setUnlockPassword("");
    } catch {
      setUnlockError("That password didn't work.");
    } finally {
      setUnlocking(false);
    }
  };

  const unread = useMemo(
    () => messages.filter((m) => !m.isRead).sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt))),
    [messages],
  );

  /* ── Navigation & permissions ─────────────────────────────────────── */
  const allNavItems: NavItem[] = buildAdminNavigation(pendingNames.length, unread.length, pendingAccess.length);
  const primaryAdmin = appUser?.adminLevel === "primary" || appUser?.role === "admin";
  const granted = new Set(appUser?.adminPermissions ?? []);
  const navItems = allNavItems.filter((item) => {
    if (primaryAdmin || item.id === "overview") return true;
    if (PRIMARY_ONLY_SECTIONS.includes(item.id)) return false;
    // Moderators can open Roles to *request* changes; the primary admin approves.
    if (item.id === "roles") return appUser?.adminLevel === "moderator";
    const permission = ADMIN_SECTION_PERMISSION[item.id];
    return permission ? granted.has(permission) : false;
  });
  const groups = Array.from(new Set(navItems.map((i) => i.group)));
  const codeOf = (id: Section) => pad2(navItems.findIndex((i) => i.id === id) + 1);

  useEffect(() => {
    if (!navItems.some((item) => item.id === section)) setSection("overview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.adminLevel, appUser?.adminPermissions, section]);

  const activateSection = (id: Section) => {
    setSection(id);
    navigate(`/admin/${ADMIN_SECTION_TO_ROUTE[id]}`.replace(/\/$/, ""));
    setMobileOpen(false);
    setCommandOpen(false);
    setCommandQuery("");
    requestAnimationFrame(() => contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  };

  /* ── Command palette (Ctrl/⌘+K) ───────────────────────────────────── */
  const commandItems = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    return q
      ? navItems.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.group.toLowerCase().includes(q) ||
            ADMIN_DESCRIPTIONS[item.id].toLowerCase().includes(q),
        )
      : navItems;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandQuery, navItems.length, pendingNames.length, unread.length]);

  useEffect(() => setCommandIndex(0), [commandQuery, commandOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    const id = window.setTimeout(() => commandInputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [commandOpen]);

  const renderSection = () => {
    switch (section) {
      case "content":
        return <ContentEditor />;
      case "theme":
        return <ThemeControl />;
      case "branding":
        return <BrandingControl />;
      case "announcements":
        return <ManageAnnouncements />;
      case "requests":
        return <CollaboratorRequests />;
      case "collaborators":
        return <ManageCollaborators />;
      case "roles":
        return <RolesPermissions />;
      case "publications":
        return <ManagePublications />;
      case "ideas":
        return <ManageResearchIdeas />;
      case "messages":
        return <ContactMessages />;
      case "delivery":
        return <DeliveryStatusDashboard />;
      case "gallery":
        return <ManageGallery />;
      case "analytics":
        return <AnalyticsPage />;
      case "audit":
        return <AuditLogPage />;
      default:
        return null;
    }
  };

  const currentItem = navItems.find((i) => i.id === section);
  const route = ADMIN_SECTION_TO_ROUTE[section] || "overview";
  const operator = appUser?.name || appUser?.email || "operator";
  const clearance = primaryAdmin ? "ROOT" : appUser?.adminLevel === "moderator" ? "MOD" : "LIMITED";

  const exitConsole = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  /* ── Sidebar ──────────────────────────────────────────────────────── */
  const sidebar = (compact: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b px-3.5" style={{ borderColor: "var(--ac-line)" }}>
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
          style={{ background: "var(--ac-accent-dim)", color: "var(--ac-accent)", boxShadow: "inset 0 0 0 1px rgba(34,211,238,.4)" }}
          aria-hidden="true"
        >
          <AppIcon name="lab" size={15} />
        </span>
        {!compact && (
          <div className="min-w-0 leading-tight">
            <p className="ac-mono m-0 truncate text-[12.5px] font-bold tracking-[0.14em]" style={{ color: "var(--ac-text)" }}>
              LAB//CONTROL
            </p>
            <p className="ac-mono m-0 flex items-center gap-1.5 text-[10px] tracking-[0.12em]" style={{ color: "var(--ac-ok)" }}>
              <span className="ac-dot ac-dot-ok" style={{ width: 5, height: 5 }} /> SECURE LINK
            </p>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto py-2" aria-label="Admin sections">
        {groups.map((group) => (
          <div key={group} className="mb-2">
            {!compact && <p className="ac-label m-0 px-4 pb-1 pt-2">// {group}</p>}
            {navItems
              .filter((i) => i.group === group)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => activateSection(item.id)}
                  aria-current={section === item.id ? "page" : undefined}
                  title={compact ? item.label : undefined}
                  aria-label={item.label}
                  className="ac-nav-item"
                  style={compact ? { justifyContent: "center", padding: "9px 0" } : undefined}
                >
                  {!compact && (
                    <span className="ac-mono w-5 shrink-0 text-[10.5px]" style={{ color: "var(--ac-faint)" }}>
                      {codeOf(item.id)}
                    </span>
                  )}
                  <span className="relative shrink-0 opacity-90">
                    <AppIcon name={item.icon} size={15} />
                    {compact && item.badge ? (
                      <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full" style={{ background: "var(--ac-warn)" }} />
                    ) : null}
                  </span>
                  {!compact && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                  {!compact && item.badge ? (
                    <span
                      className="ac-mono rounded px-1.5 text-[10.5px] font-bold"
                      style={{ background: "rgba(251,191,36,.14)", color: "var(--ac-warn)" }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t p-2.5" style={{ borderColor: "var(--ac-line)" }}>
        {!compact && (
          <div className="mb-2 flex items-center gap-2.5 px-1">
            <span
              className="ac-mono grid h-8 w-8 shrink-0 place-items-center rounded-md text-[11px] font-bold"
              style={{ background: "var(--ac-panel-3)", color: "var(--ac-accent)" }}
            >
              {operator.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--ac-text)" }}>
                {operator}
              </span>
              <span className="ac-mono block text-[10px] tracking-[0.12em]" style={{ color: "var(--ac-muted)" }}>
                CLEARANCE: {clearance}
              </span>
            </span>
          </div>
        )}
        <div className={`flex gap-1.5 ${compact ? "flex-col items-center" : ""}`}>
          <a href="/" className={`ac-btn ${compact ? "ac-btn-icon" : "flex-1 justify-center"}`} title="Back to website">
            <AppIcon name="back" size={13} />
            {!compact && "SITE"}
          </a>
          <button type="button" onClick={() => void exitConsole()} className={`ac-btn ${compact ? "ac-btn-icon" : "flex-1 justify-center"}`} title="Sign out">
            <LogOut size={13} />
            {!compact && "EXIT"}
          </button>
        </div>
      </div>
    </div>
  );

  /* ── Overview ─────────────────────────────────────────────────────── */
  const missingContent = CORE_CONTENT_KEYS.filter(({ key }) => !String(content[key] ?? "").trim());
  const stats = [
    { id: "collaborators" as Section, label: "Collaborators", value: collaborators.length },
    { id: "publications" as Section, label: "Publications", value: published.length, note: `${ongoing.length} ongoing` },
    { id: "ideas" as Section, label: "Research ideas", value: ideas.length },
    { id: "announcements" as Section, label: "Announcements", value: announcements.filter((a) => !a.isHidden).length },
    { id: "requests" as Section, label: "Pending requests", value: pendingNames.length, alert: pendingNames.length > 0 },
    { id: "messages" as Section, label: "Unread messages", value: unread.length, alert: unread.length > 0 },
  ].filter((stat) => navItems.some((item) => item.id === stat.id));

  type QueueItem = { tone: "warn" | "info"; text: string; target: Section };
  const queue: QueueItem[] = [
    ...(primaryAdmin
      ? pendingAccess.map((r) => ({ tone: "warn" as const, text: `Access change for ${r.target} requested by ${r.by}`, target: "roles" as Section }))
      : []),
    ...pendingNames.slice(0, 4).map((name) => ({ tone: "warn" as const, text: `Collaborator request from ${name} awaiting review`, target: "requests" as Section })),
    ...(pendingNames.length > 4 ? [{ tone: "warn" as const, text: `+${pendingNames.length - 4} more requests`, target: "requests" as Section }] : []),
    ...unread.slice(0, 4).map((m) => ({
      tone: "info" as const,
      text: `Message from ${m.name || m.email}: ${m.subject || "(no subject)"}`,
      target: "messages" as Section,
    })),
    ...(unread.length > 4 ? [{ tone: "info" as const, text: `+${unread.length - 4} more unread messages`, target: "messages" as Section }] : []),
    ...missingContent.map((item) => ({ tone: "info" as const, text: `Content field empty: ${item.label}`, target: "content" as Section })),
  ].filter((item) => navItems.some((nav) => nav.id === item.target));

  const overview = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ac-label m-0">// system overview</p>
          <h1 className="m-0 mt-1 text-[20px] font-semibold" style={{ color: "var(--ac-text)" }}>
            Welcome back, {operator.split(" ")[0]}
          </h1>
        </div>
        <p className="ac-mono m-0 text-[11.5px]" style={{ color: "var(--ac-muted)" }}>
          {queue.length === 0 ? "ALL SYSTEMS NOMINAL" : `${queue.length} ITEM${queue.length === 1 ? "" : "S"} NEED ATTENTION`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <button
            key={stat.id}
            type="button"
            onClick={() => activateSection(stat.id)}
            className="ac-panel ac-corners group cursor-pointer p-3.5 text-left transition hover:border-[rgba(34,211,238,.45)]"
          >
            <p className="ac-label m-0">{stat.label}</p>
            <p
              className="ac-mono m-0 mt-2 text-[26px] font-bold leading-none tabular-nums"
              style={{ color: stat.alert ? "var(--ac-warn)" : "var(--ac-text)" }}
            >
              {pad2(stat.value)}
            </p>
            <p className="ac-mono m-0 mt-1.5 text-[10.5px]" style={{ color: "var(--ac-faint)" }}>
              {stat.note ?? (stat.alert ? "action required" : "nominal")}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="ac-panel overflow-hidden" aria-label="Action queue">
          <header className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--ac-line)" }}>
            <p className="ac-label m-0" style={{ color: "var(--ac-muted)" }}>
              action_queue
            </p>
            <span className="ac-mono text-[10.5px]" style={{ color: "var(--ac-faint)" }}>
              {queue.length} open
            </span>
          </header>
          {queue.length === 0 ? (
            <p className="ac-mono m-0 px-4 py-8 text-center text-[12px]" style={{ color: "var(--ac-muted)" }}>
              <span style={{ color: "var(--ac-ok)" }}>✓</span> queue empty — nothing needs you right now
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {queue.map((item, index) => (
                <li key={`${item.target}-${index}`}>
                  <button
                    type="button"
                    onClick={() => activateSection(item.target)}
                    className="flex w-full items-center gap-3 border-0 border-b bg-transparent px-4 py-2.5 text-left transition hover:bg-[rgba(34,211,238,.04)]"
                    style={{ borderColor: "var(--ac-line)" }}
                  >
                    <span
                      className="ac-mono shrink-0 text-[11px] font-bold"
                      style={{ color: item.tone === "warn" ? "var(--ac-warn)" : "var(--ac-accent)" }}
                    >
                      {item.tone === "warn" ? "[!]" : "[i]"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--ac-text-2)" }}>
                      {item.text}
                    </span>
                    <span className="ac-mono shrink-0 text-[10.5px]" style={{ color: "var(--ac-faint)" }}>
                      /{ADMIN_SECTION_TO_ROUTE[item.target]} →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ac-panel p-4" aria-label="Session">
          <p className="ac-label m-0" style={{ color: "var(--ac-muted)" }}>
            session
          </p>
          <dl className="ac-mono m-0 mt-3 grid gap-2 text-[11.5px]">
            {[
              ["operator", operator],
              ["clearance", clearance],
              ["modules", `${navItems.length} available`],
              ["local time", now.toLocaleTimeString([], { hour12: false })],
              ["date", now.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" })],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: "var(--ac-line)" }}>
                <dt style={{ color: "var(--ac-faint)" }}>{k}</dt>
                <dd className="m-0 truncate text-right" style={{ color: "var(--ac-text-2)" }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={() => setCommandOpen(true)} className="ac-btn mt-4 w-full justify-center">
            <Search size={12} /> JUMP TO MODULE
            <kbd className="ml-1 rounded border px-1 text-[10px]" style={{ borderColor: "var(--ac-line-strong)" }}>
              Ctrl K
            </kbd>
          </button>
        </section>
      </div>
    </div>
  );

  /* ── Layout ───────────────────────────────────────────────────────── */
  return (
    <div className="admin-console fixed inset-0 z-[2147481000] flex overflow-hidden ac-grid-bg" style={{ color: "var(--ac-text)" }}>
      <aside
        className="hidden shrink-0 border-r lg:block"
        style={{
          width: collapsed ? 60 : 232,
          background: "rgba(7,10,15,.92)",
          borderColor: "var(--ac-line)",
          transition: "width .2s ease",
        }}
      >
        {sidebar(collapsed)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="h-full w-[260px] border-r"
            style={{ background: "var(--ac-panel)", borderColor: "var(--ac-line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-12 shrink-0 items-center gap-2 border-b px-3 lg:px-4"
          style={{ borderColor: "var(--ac-line)", background: "rgba(5,7,11,.85)", backdropFilter: "blur(8px)" }}
        >
          <button type="button" onClick={() => setMobileOpen(true)} className="ac-btn ac-btn-icon lg:hidden" aria-label="Open menu">
            <Menu size={15} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="ac-btn ac-btn-icon hidden lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>

          <p className="ac-mono ac-cursor m-0 min-w-0 truncate text-[12px]" style={{ color: "var(--ac-muted)" }}>
            <span style={{ color: "var(--ac-ok)" }}>root@lab</span>
            <span style={{ color: "var(--ac-faint)" }}>:</span>
            <span style={{ color: "var(--ac-accent)" }}>~/admin/{route}</span>
          </p>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setCommandOpen(true)} className="ac-btn hidden md:inline-flex" aria-label="Search modules">
              <Search size={12} />
              <span>search</span>
              <kbd className="rounded border px-1 text-[10px]" style={{ borderColor: "var(--ac-line-strong)", color: "var(--ac-faint)" }}>
                Ctrl K
              </kbd>
            </button>
            <span className="ac-mono hidden text-[11.5px] tabular-nums sm:inline" style={{ color: "var(--ac-muted)" }}>
              {now.toLocaleTimeString([], { hour12: false })}
            </span>
          </div>
        </header>

        <main ref={contentScrollRef} className="relative min-h-0 flex-1 overflow-y-auto" aria-label="Admin content">
          <div className="mx-auto w-full max-w-[1240px] px-3 py-4 lg:px-5 lg:py-5">
            {section === "overview" ? (
              overview
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="ac-mono text-[11px]" style={{ color: "var(--ac-accent)" }}>
                    [{codeOf(section)}]
                  </span>
                  <h1 className="m-0 text-[17px] font-semibold" style={{ color: "var(--ac-text)" }}>
                    {currentItem?.label}
                  </h1>
                  <p className="m-0 text-[12.5px]" style={{ color: "var(--ac-muted)" }}>
                    {ADMIN_DESCRIPTIONS[section]}
                  </p>
                </div>
                <div className="admin-section ac-panel p-3 sm:p-4 lg:p-5">{renderSection()}</div>
              </>
            )}
          </div>
        </main>

        <footer
          className="ac-mono flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t px-3 text-[10.5px] tracking-[0.06em] lg:px-4"
          style={{ borderColor: "var(--ac-line)", background: "rgba(5,7,11,.92)", color: "var(--ac-faint)" }}
        >
          <span className="flex items-center gap-1.5" style={{ color: "var(--ac-ok)" }}>
            <span className="ac-dot ac-dot-ok" style={{ width: 5, height: 5 }} /> ONLINE
          </span>
          <span className="hidden sm:inline">{collaborators.length} COLLABORATORS</span>
          <span style={{ color: pendingNames.length ? "var(--ac-warn)" : undefined }}>{pendingNames.length} PENDING</span>
          <span style={{ color: unread.length ? "var(--ac-warn)" : undefined }}>{unread.length} UNREAD</span>
          <span className="ml-auto hidden truncate md:inline">SESSION {operator.toUpperCase()}</span>
        </footer>
      </div>

      {locked && (
        <div className="fixed inset-0 z-[2147482900] grid place-items-center bg-black/90 p-4 ac-grid-bg" role="dialog" aria-modal="true" aria-labelledby="lock-title">
          <form onSubmit={unlock} className="ac-panel ac-corners w-full max-w-sm p-6">
            <span className="grid h-10 w-10 place-items-center rounded-md" style={{ background: "var(--ac-accent-dim)", color: "var(--ac-accent)" }}>
              <Lock size={18} />
            </span>
            <h2 id="lock-title" className="m-0 mt-4 text-[17px] font-semibold" style={{ color: "var(--ac-text)" }}>
              Console locked
            </h2>
            <p className="ac-mono m-0 mt-1 text-[11.5px]" style={{ color: "var(--ac-muted)" }}>
              idle for 15 minutes · re-enter the password for {auth.currentUser?.email ?? operator}
            </p>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              aria-label="Password"
              placeholder="Password"
              className="mt-4 h-10 w-full rounded-md border px-3 text-sm"
            />
            {unlockError && (
              <p role="alert" className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--ac-danger)" }}>
                {unlockError}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => void exitConsole()} className="ac-btn flex-1 justify-center">
                <LogOut size={13} /> SIGN OUT
              </button>
              <button type="submit" disabled={unlocking || !unlockPassword} className="ac-btn flex-1 justify-center" style={{ borderColor: "rgba(34,211,238,.6)", color: "#ecfeff" }}>
                {unlocking ? "CHECKING…" : "UNLOCK"}
              </button>
            </div>
          </form>
        </div>
      )}

      {commandOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 px-4 pt-[12vh]" onClick={() => setCommandOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Jump to module"
            className="ac-panel ac-corners w-full max-w-xl overflow-hidden"
            style={{ boxShadow: "0 0 0 1px rgba(34,211,238,.15), 0 30px 80px rgba(0,0,0,.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-3.5" style={{ borderColor: "var(--ac-line)" }}>
              <span className="ac-mono text-[13px]" style={{ color: "var(--ac-accent)" }}>
                &gt;
              </span>
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCommandIndex((i) => Math.min(i + 1, commandItems.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCommandIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && commandItems[commandIndex]) {
                    activateSection(commandItems[commandIndex].id);
                  }
                }}
                placeholder="goto module…"
                aria-label="Search modules"
                className="ac-mono h-12 flex-1 border-0 bg-transparent text-[13px] outline-none"
                style={{ background: "transparent", border: 0, boxShadow: "none", color: "var(--ac-text)" }}
              />
              <button type="button" onClick={() => setCommandOpen(false)} className="ac-btn ac-btn-icon" aria-label="Close">
                <X size={13} />
              </button>
            </div>
            <ul className="m-0 max-h-[50vh] list-none overflow-y-auto p-1.5">
              {commandItems.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => activateSection(item.id)}
                    onMouseEnter={() => setCommandIndex(index)}
                    className="flex w-full items-center gap-3 rounded-md border-0 px-3 py-2 text-left"
                    style={{
                      background: index === commandIndex ? "rgba(34,211,238,.08)" : "transparent",
                      color: "var(--ac-text-2)",
                    }}
                  >
                    <span className="ac-mono w-6 text-[10.5px]" style={{ color: "var(--ac-faint)" }}>
                      {codeOf(item.id)}
                    </span>
                    <AppIcon name={item.icon} size={14} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold" style={{ color: "var(--ac-text)" }}>
                        {item.label}
                      </span>
                      <span className="block truncate text-[11.5px]" style={{ color: "var(--ac-muted)" }}>
                        {ADMIN_DESCRIPTIONS[item.id]}
                      </span>
                    </span>
                    {index === commandIndex && <CornerDownLeft size={13} style={{ color: "var(--ac-accent)" }} />}
                  </button>
                </li>
              ))}
              {commandItems.length === 0 && (
                <li className="ac-mono px-3 py-6 text-center text-[12px]" style={{ color: "var(--ac-muted)" }}>
                  no module matches “{commandQuery}”
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
