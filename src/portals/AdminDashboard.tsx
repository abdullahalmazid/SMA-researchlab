import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ContactMessages, ManageAnnouncements } from "../admin/AdminSections";
import CollaboratorRequests from "../admin/features/requests/RequestsPage";
import ContentEditor from "../admin/features/content/ContentPage";
import DeliveryStatusDashboard from "../admin/features/delivery/DeliveryPage";
import ManageCollaborators from "../admin/features/collaborators/CollaboratorsPage";
import ManageGallery from "../admin/features/gallery/GalleryPage";
import ManagePublications from "../admin/features/publications/PublicationsPage";
import ManageResearchIdeas from "../admin/features/research-ideas/ResearchIdeasPage";
import ThemeControl from "../admin/features/appearance/AppearancePage";
import BrandingControl from "../admin/features/branding/BrandingPage";
import RolesPermissions from "../admin/features/permissions/PermissionsPage";
import AppIcon, { type AppIconName } from "../components/AppIcon";
import { useThemeContext } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import {
  useCollaborators,
  usePublications,
  useResearchIdeas,
  useSiteContent,
} from "../firebase/hooks";
import type { ContactMessage } from "../types";
import { ADMIN_DESCRIPTIONS, ADMIN_ROUTE_TO_SECTION, ADMIN_SECTION_PERMISSION, ADMIN_SECTION_TO_ROUTE, buildAdminNavigation, type AdminNavItem as NavItem, type AdminSection as Section } from "../admin/app/adminNavigation";

const SECTION_STORAGE_KEY = "rl_admin_section";

interface QuickAction {
  id: Section;
  title: string;
  note: string;
  icon: AppIconName;
  highlight?: string;
}

const CONTENT_TRACKED_KEYS = [
  "home.heroTitle",
  "home.heroSubtitle",
  "home.introTitle",
  "home.introText",
  "about.pageTitle",
  "about.pageSubtitle",
  "collaborators.pageTitle",
  "publications.pageTitle",
  "ideas.pageTitle",
  "ideas.pageSubtitle",
  "contact.pageTitle",
  "contact.pageSubtitle",
  "contact.email",
  "contact.phone",
  "home.bannerUrl",
  "about.bannerUrl",
  "ideas.bannerUrl",
  "contact.bannerUrl",
] as const;

const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const contentScrollRef = useRef<HTMLElement>(null);

  const { content } = useSiteContent();
  const { theme } = useThemeContext();
  const { collaborators } = useCollaborators();
  const { ongoing, published } = usePublications();
  const { ideas } = useResearchIdeas();

  const isDarkTheme = useMemo(() => {
    const clean = theme.backgroundColor.replace("#", "").trim();
    if (clean.length !== 6) return false;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance < 140;
  }, [theme.backgroundColor]);

  const pageBg = isDarkTheme ? "#0b1220" : "#f1f5f9";
  const surfaceBg = isDarkTheme ? "#111827" : "white";
  const surfaceAltBg = isDarkTheme ? "#0f172a" : "#fbfdff";
  const borderColor = isDarkTheme ? "rgba(255,255,255,0.12)" : "#e2e8f0";
  const panelBorderColor = isDarkTheme ? "rgba(255,255,255,0.12)" : "#f0f4f8";
  const titleColor = isDarkTheme ? "#e5e7eb" : "#1f2937";
  const mutedColor = isDarkTheme ? "#9ca3af" : "#6b7280";

  useEffect(() => {
    const slug = location.pathname.replace(/^\/admin\/?/, "");
    if (ADMIN_ROUTE_TO_SECTION[slug]) setSection(ADMIN_ROUTE_TO_SECTION[slug]);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(SECTION_STORAGE_KEY, section);
  }, [section]);

  useEffect(() => {
    const unsubMessages = onSnapshot(
      collection(db, "contactMessages"),
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContactMessage),
        );
      },
      (error) => console.error("Admin messages error:", error),
    );

    const unsubPending = onSnapshot(
      query(
        collection(db, "pendingRequests"),
        where("status", "==", "pending"),
      ),
      (snap) => {
        setPendingRequests(snap.size);
      },
      (error) => console.error("Admin requests error:", error),
    );

    return () => {
      unsubMessages();
      unsubPending();
    };
  }, []);

  const unreadMessages = messages.filter((m) => !m.isRead).length;

  const progress = useMemo(() => {
    const contentFilled = CONTENT_TRACKED_KEYS.filter((key) =>
      Boolean(content[key]?.toString().trim()),
    ).length;
    const contentPercent = Math.round(
      (contentFilled / CONTENT_TRACKED_KEYS.length) * 100,
    );

    const collaboratorsGoal = 8;
    const collaboratorsPercent = Math.min(
      100,
      Math.round((collaborators.length / collaboratorsGoal) * 100),
    );

    const publicationsTotal = ongoing.length + published.length;
    const publicationsGoal = 12;
    const publicationsPercent = Math.min(
      100,
      Math.round((publicationsTotal / publicationsGoal) * 100),
    );

    const ideasGoal = 10;
    const ideasPercent = Math.min(
      100,
      Math.round((ideas.length / ideasGoal) * 100),
    );

    const totalMessages = messages.length;
    const handledMessages = totalMessages - unreadMessages;
    const inboxPercent =
      totalMessages === 0
        ? 100
        : Math.round((handledMessages / totalMessages) * 100);

    const metrics = [
      {
        id: "content" as Section,
        label: "Content Completion",
        hint: `${contentFilled}/${CONTENT_TRACKED_KEYS.length} core fields set`,
        percent: contentPercent,
        stat: `${contentPercent}%`,
      },
      {
        id: "collaborators" as Section,
        label: "Collaborator Network",
        hint: `${collaborators.length} active collaborators`,
        percent: collaboratorsPercent,
        stat: `${collaborators.length}`,
      },
      {
        id: "publications" as Section,
        label: "Research Output",
        hint: `${publicationsTotal} publications uploaded`,
        percent: publicationsPercent,
        stat: `${publicationsTotal}`,
      },
      {
        id: "ideas" as Section,
        label: "Idea Pipeline",
        hint: `${ideas.length} ideas in repository`,
        percent: ideasPercent,
        stat: `${ideas.length}`,
      },
      {
        id: "messages" as Section,
        label: "Inbox Health",
        hint: `${handledMessages}/${totalMessages} handled`,
        percent: inboxPercent,
        stat: `${unreadMessages} unread`,
      },
    ];

    const overall = Math.round(
      metrics.reduce((acc, item) => acc + item.percent, 0) / metrics.length,
    );

    return { metrics, overall };
  }, [
    collaborators.length,
    content,
    ideas.length,
    messages.length,
    ongoing.length,
    published.length,
    unreadMessages,
  ]);

  const allNavItems: NavItem[] = buildAdminNavigation(pendingRequests, unreadMessages);

  const primaryAdmin = appUser?.adminLevel === "primary" || appUser?.role === "admin";
  const granted = new Set(appUser?.adminPermissions ?? []);
  const navItems = allNavItems.filter((item) => {
    if (primaryAdmin) return true;
    if (item.id === "overview") return true;
    if (item.id === "roles") return false;
    const permission = ADMIN_SECTION_PERMISSION[item.id];
    return permission ? granted.has(permission) : false;
  });

  const groups = Array.from(new Set(navItems.map((i) => i.group)));

  useEffect(() => {
    if (!navItems.some((item) => item.id === section)) setSection("overview");
  }, [appUser?.adminLevel, appUser?.adminPermissions, section]);

  const sectionDescriptions = ADMIN_DESCRIPTIONS;

  const activateSection = (id: Section) => {
    setSection(id);
    navigate(`/admin/${ADMIN_SECTION_TO_ROUTE[id]}`.replace(/\/$/, ""));
    setMobileOpen(false);
    setCommandOpen(false);
    setCommandQuery("");
    requestAnimationFrame(() => contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
  };

  const quickActions: QuickAction[] = [
    {
      id: "content",
      title: "Edit Core Content",
      note: "Home, about, contact and page sections",
      icon: "content",
    },
    {
      id: "requests",
      title: "Review Requests",
      note: `${pendingRequests} pending applications`,
      icon: "requests",
      highlight: pendingRequests > 0 ? "#ef4444" : undefined,
    },
    {
      id: "messages",
      title: "Check Inbox",
      note: `${unreadMessages} unread messages`,
      icon: "contact",
      highlight: unreadMessages > 0 ? "#ef4444" : undefined,
    },
    {
      id: "theme",
      title: "Theme Studio",
      note: "Apply premium color and typography presets",
      icon: "theme",
    },
  ];

  const filteredCommandItems = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        sectionDescriptions[item.id].toLowerCase().includes(q),
    );
  }, [commandQuery, navItems]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
      }
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
      case "overview":
        return null;
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
      default:
        return null;
    }
  };

  const currentItem = navItems.find((i) => i.id === section);

  const SidebarContent = () => (
    <>
      {/* Logo area */}
      <div
        className="px-5 py-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{
              background:
                "linear-gradient(135deg, var(--color-accent), #f97316)",
              boxShadow: "0 4px 12px rgba(245,158,11,0.4)",
            }}
          >
            <AppIcon name="lab" size={18} />
          </div>
          <div>
            <p
              className="text-white font-black text-sm leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Admin Panel
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Rahman Research Lab
            </p>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav
        className="flex-1 py-4 overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {groups.map((group) => (
          <div key={group} className="mb-1">
            <p
              className="px-5 py-1.5 text-xs font-black uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              {group}
            </p>
            {navItems
              .filter((i) => i.group === group)
              .map((item) => {
                const isActive = section === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => activateSection(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`Open ${item.label}`}
                    className="w-full flex items-center gap-3 px-4 mx-1 py-2.5 text-left border-none cursor-pointer transition-all rounded-xl"
                    style={{
                      width: "calc(100% - 8px)",
                      background: isActive
                        ? "rgba(255,255,255,0.12)"
                        : "transparent",
                      color: isActive ? "white" : "rgba(255,255,255,0.6)",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: 13.5,
                      marginBottom: 2,
                    }}
                  >
                    {/* Active indicator */}
                    <div
                      className="w-1 h-5 rounded-full flex-shrink-0 transition-all"
                      style={{
                        background: isActive
                          ? "var(--color-accent)"
                          : "transparent",
                        boxShadow: isActive
                          ? "0 0 8px var(--color-accent)"
                          : "none",
                      }}
                    />
                    <AppIcon name={item.icon} size={15} />
                    <span className="whitespace-nowrap flex-1">
                      {item.label}
                    </span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className="text-xs font-black px-1.5 py-0.5 rounded-full"
                        style={{
                          background: "#ef4444",
                          color: "white",
                          fontSize: 10,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <a
          href="/"
          className="flex items-center gap-2 text-xs font-semibold no-underline py-2 px-3 rounded-lg transition-all"
          style={{
            color: "rgba(255,255,255,0.45)",
            background: "rgba(255,255,255,0.05)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "white";
            (e.currentTarget as HTMLElement).style.background =
              "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "rgba(255,255,255,0.45)";
            (e.currentTarget as HTMLElement).style.background =
              "rgba(255,255,255,0.05)";
          }}
        >
          <AppIcon name="back" size={14} />
          <span>Back to Website</span>
        </a>
      </div>
    </>
  );

  return (
    <div
      className="admin-dashboard-theme fixed inset-0 z-[2147481000] flex overflow-hidden"
      data-admin-dark={isDarkTheme ? "true" : "false"}
      style={{ background: pageBg }}
    >
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 sticky top-0 h-screen"
        style={{
          width: sidebarOpen ? 240 : 64,
          background: "var(--color-primary)",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
          zIndex: 30,
          boxShadow: "4px 0 24px rgba(0,0,0,0.12)",
        }}
      >
        {sidebarOpen ? (
          <SidebarContent />
        ) : (
          /* Collapsed sidebar — icons only */
          <div className="flex flex-col items-center py-4 gap-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-4"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-accent), #f97316)",
                color: "#ffffff",
              }}
            >
              <AppIcon name="lab" size={18} />
            </div>
            {navItems.map((item) => {
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => activateSection(item.id)}
                  title={item.label}
                  aria-label={`Open ${item.label}`}
                  className="w-10 h-10 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all"
                  style={{
                    background: isActive
                      ? "rgba(255,255,255,0.18)"
                      : "rgba(255,255,255,0.04)",
                    color: isActive ? "#ffffff" : "rgba(255,255,255,0.72)",
                    fontSize: 16,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.12)";
                      e.currentTarget.style.color = "#ffffff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.72)";
                    }
                  }}
                >
                  <AppIcon name={item.icon} size={16} />
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {commandOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-20"
          style={{
            background: "rgba(2,6,23,0.5)",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setCommandOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{
              background: surfaceBg,
              border: `1px solid ${borderColor}`,
              boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor }}>
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredCommandItems.length > 0) {
                    activateSection(filteredCommandItems[0].id);
                  }
                }}
                placeholder="Jump to section... (type: content, inbox, research)"
                className="w-full text-sm bg-transparent border-none outline-none"
                style={{ color: titleColor }}
              />
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {filteredCommandItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => activateSection(item.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl border-none cursor-pointer transition-all"
                  style={{
                    background:
                      section === item.id ? surfaceAltBg : "transparent",
                    color: titleColor,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <AppIcon name={item.icon} size={16} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{item.label}</p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: mutedColor }}
                      >
                        {sectionDescriptions[item.id]}
                      </p>
                    </div>
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: mutedColor }}
                    >
                      {item.group}
                    </span>
                  </div>
                </button>
              ))}
              {filteredCommandItems.length === 0 && (
                <p
                  className="px-3 py-6 text-sm text-center"
                  style={{ color: mutedColor }}
                >
                  No matching admin section found.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <aside
        className="fixed top-0 left-0 h-full z-50 flex flex-col lg:hidden"
        style={{
          width: 260,
          background: "var(--color-primary)",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: mobileOpen ? "8px 0 32px rgba(0,0,0,0.2)" : "none",
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Main Content ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="sticky top-0 z-20 flex items-center gap-3 px-4 lg:px-6"
          style={{
            background: isDarkTheme
              ? "rgba(15,23,42,0.88)"
              : "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${borderColor}`,
            height: 56,
            boxShadow: "0 1px 12px rgba(0,0,0,0.06)",
          }}
        >
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle mobile menu"
            className="lg:hidden flex flex-col justify-center gap-1 w-8 h-8 bg-transparent border-none cursor-pointer"
          >
            <div
              className="w-5 h-0.5 rounded-full"
              style={{ background: "#374151" }}
            />
            <div
              className="w-4 h-0.5 rounded-full"
              style={{ background: "#374151" }}
            />
            <div
              className="w-5 h-0.5 rounded-full"
              style={{ background: "#374151" }}
            />
          </button>

          {/* Desktop collapse button */}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle desktop sidebar"
            className="hidden lg:flex flex-col justify-center gap-1 w-8 h-8 bg-transparent border-none cursor-pointer"
          >
            <div
              className="w-5 h-0.5 rounded-full"
              style={{ background: "#374151" }}
            />
            <div
              className="w-4 h-0.5 rounded-full"
              style={{ background: "#374151" }}
            />
            <div
              className="w-5 h-0.5 rounded-full"
              style={{ background: "#374151" }}
            />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <span
              className="text-sm hidden sm:block"
              style={{ color: isDarkTheme ? "#94a3b8" : "#9ca3af" }}
            >
              Dashboard
            </span>
            <span
              className="hidden sm:block"
              style={{ color: isDarkTheme ? "#64748b" : "#d1d5db" }}
            >
              ›
            </span>
            <div className="flex items-center gap-2">
              {currentItem && <AppIcon name={currentItem.icon} size={16} />}
              <h1 className="font-black text-sm" style={{ color: titleColor }}>
                {currentItem?.label}
              </h1>
            </div>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden md:flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border-none cursor-pointer"
              style={{
                color: titleColor,
                background: isDarkTheme ? "rgba(148,163,184,0.12)" : "#eef2ff",
              }}
            >
              <AppIcon name="menu" size={13} />
              <span>Quick Jump</span>
              <span style={{ opacity: 0.7 }}>Ctrl+K</span>
            </button>
            <a
              href="/"
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg no-underline transition-all"
              style={{
                color: "var(--color-primary)",
                background: "rgba(30,58,95,0.08)",
                border: "1px solid rgba(30,58,95,0.12)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--color-primary)";
                (e.currentTarget as HTMLElement).style.color = "white";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(30,58,95,0.08)";
                (e.currentTarget as HTMLElement).style.color =
                  "var(--color-primary)";
              }}
            >
              <AppIcon name="back" size={14} />
              <span>Website</span>
            </a>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-1"
          style={{
            background: isDarkTheme
              ? "rgba(15,23,42,0.95)"
              : "rgba(255,255,255,0.95)",
            backdropFilter: "blur(12px)",
            borderTop: `1px solid ${borderColor}`,
            boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
            height: 60,
          }}
        >
          {navItems.slice(0, 5).map((item) => {
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => activateSection(item.id)}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Open ${item.label}`}
                className="flex flex-col items-center gap-0.5 border-none bg-transparent cursor-pointer px-2 py-1 rounded-xl transition-all"
                style={{
                  color: isActive ? "var(--color-primary)" : "#9ca3af",
                  minWidth: 44,
                }}
              >
                <AppIcon name={item.icon} size={18} />
                <span
                  className="text-center font-semibold"
                  style={{
                    fontSize: 9,
                    letterSpacing: "-0.2px",
                    color: isActive
                      ? "var(--color-primary)"
                      : isDarkTheme
                        ? "#94a3b8"
                        : "#9ca3af",
                  }}
                >
                  {item.label.split(" ")[0]}
                </span>
                {isActive && (
                  <div
                    className="w-1 h-1 rounded-full"
                    style={{ background: "var(--color-accent)" }}
                  />
                )}
              </button>
            );
          })}
          {/* More button for remaining items */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center gap-0.5 border-none bg-transparent cursor-pointer px-2 py-1 rounded-xl"
            style={{ color: "#9ca3af", minWidth: 44 }}
          >
            <AppIcon name="more" size={18} />
            <span style={{ fontSize: 9, fontWeight: 600 }}>More</span>
          </button>
        </nav>

        {/* Page content */}
        <main
          ref={contentScrollRef}
          className="flex-1 overflow-y-auto"
          aria-label="Admin content"
          style={{ padding: "24px 16px 80px", maxWidth: "100%" }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            {/* Page header card */}
            {section === "overview" && <div
              className="rounded-2xl px-6 py-5 mb-6 flex items-center gap-4"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)",
                boxShadow: "0 8px 32px rgba(30,58,95,0.2)",
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {currentItem && <AppIcon name={currentItem.icon} size={24} />}
              </div>
              <div>
                <h2
                  className="text-white font-black text-lg leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {currentItem?.label}
                </h2>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  {sectionDescriptions[section]} · {progress.overall}% overall
                  progress
                </p>
              </div>
            </div>}

            {section === "overview" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
                  {quickActions.map((action) => (
                    <button
                      key={action.title}
                      onClick={() => activateSection(action.id)}
                      className="text-left p-3 rounded-xl border transition-all cursor-pointer"
                      style={{
                        borderColor,
                        background: surfaceAltBg,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span
                          className="inline-flex"
                          style={{ color: "var(--color-primary)" }}
                        >
                          <AppIcon name={action.icon} size={16} />
                        </span>
                        {action.highlight && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: action.highlight }}
                          />
                        )}
                      </div>
                      <p
                        className="text-xs font-black"
                        style={{ color: titleColor }}
                      >
                        {action.title}
                      </p>
                      <p
                        className="text-[11px] mt-1"
                        style={{ color: mutedColor }}
                      >
                        {action.note}
                      </p>
                    </button>
                  ))}
                </div>

                <div
                  className="rounded-2xl p-5 lg:p-6 mb-6"
                  style={{
                    background: surfaceBg,
                    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                    border: `1px solid ${panelBorderColor}`,
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                      <p
                        className="text-sm font-black"
                        style={{
                          color: "var(--color-primary)",
                          letterSpacing: 0.2,
                        }}
                      >
                        Website Progress Overview
                      </p>
                      <p className="text-xs mt-1" style={{ color: mutedColor }}>
                        Live completion status of site content and operations.
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-2xl font-black leading-none"
                        style={{ color: "var(--color-primary)" }}
                      >
                        {progress.overall}%
                      </p>
                      <p
                        className="text-[11px] mt-1"
                        style={{ color: mutedColor }}
                      >
                        overall readiness
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {progress.metrics.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => setSection(item.id)}
                        className="text-left p-3 rounded-xl border transition-all cursor-pointer"
                        style={{
                          borderColor,
                          background: surfaceAltBg,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            isDarkTheme ? "#1e293b" : "#f3f8ff";
                          (e.currentTarget as HTMLElement).style.borderColor =
                            isDarkTheme ? "#334155" : "#cbdcf4";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            surfaceAltBg;
                          (e.currentTarget as HTMLElement).style.borderColor =
                            borderColor;
                        }}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p
                            className="text-xs font-black"
                            style={{ color: titleColor }}
                          >
                            {item.label}
                          </p>
                          <span
                            className="text-xs font-bold"
                            style={{ color: mutedColor }}
                          >
                            {item.stat}
                          </span>
                        </div>
                        <div
                          className="w-full h-2 rounded-full overflow-hidden"
                          style={{ background: "#e8eef7" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${item.percent}%`,
                              background:
                                "linear-gradient(90deg, var(--color-secondary), var(--color-accent))",
                            }}
                          />
                        </div>
                        <p
                          className="text-[11px] mt-2"
                          style={{ color: mutedColor }}
                        >
                          {item.hint}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Section content */}
            {section !== "overview" && (
              <div
                className="rounded-2xl p-5 lg:p-7"
                style={{
                  background: surfaceBg,
                  boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                  border: `1px solid ${panelBorderColor}`,
                }}
              >
                {renderSection()}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
