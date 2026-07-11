import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import AppIcon, { type AppIconName } from "./AppIcon";
import EditableText from "./EditableText";
import { useSiteContent } from "../firebase/hooks";

// Persist navbar position in localStorage
const STORAGE_KEY = "rl_nav_position";
type NavPosition = "left" | "top" | "bottom";

const Navbar: React.FC = () => {
  const { role, logout, appUser } = useAuth();
  const hasAdminAccess = role === "admin" || appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator";
  const { content } = useSiteContent();
  const brandLogoUrl = content["branding.logoUrl"] ?? "";
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [positionPickerOpen, setPositionPickerOpen] = useState(false);
  const [collaboratorPhoto, setCollaboratorPhoto] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const [navPosition, setNavPosition] = useState<NavPosition>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as NavPosition | null;
    if (saved === "left" || saved === "top" || saved === "bottom") {
      return saved;
    }
    return window.innerWidth < 1024 ? "bottom" : "top";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarDropdownRef = useRef<HTMLDivElement>(null);
  const topbarDropdownRef = useRef<HTMLDivElement>(null);
  const sidebarPositionRef = useRef<HTMLDivElement>(null);
  const topbarPositionRef = useRef<HTMLDivElement>(null);
  const mobilePositionRef = useRef<HTMLDivElement>(null);
  const mobileMoreRef = useRef<HTMLDivElement>(null);

  const isLeft = navPosition === "left";
  const isTop = navPosition === "top";
  const isBottom = navPosition === "bottom";

  // Updated IDs to be simple strings (without collection prefix) to fix Firebase error
  const navLinks = [
    { to: "/", label: "Home", icon: "home" as AppIconName, id: "nav-home" },
    {
      to: "/about",
      label: "About",
      icon: "about" as AppIconName,
      id: "nav-about",
    },
    {
      to: "/lab-head",
      label: "Lab Head",
      icon: "admin" as AppIconName,
      id: "nav-lab-head",
    },
    {
      to: "/collaborators",
      label: "Collaborators",
      icon: "collaborators" as AppIconName,
      id: "nav-collaborators",
    },
    {
      to: "/publications",
      label: "Publications",
      icon: "publications" as AppIconName,
      id: "nav-publications",
    },
    {
      to: "/research-ideas",
      label: "Research Ideas",
      icon: "ideas" as AppIconName,
      id: "nav-research-ideas",
    },
    {
      to: "/gallery",
      label: "Gallery",
      icon: "gallery" as AppIconName,
      id: "nav-gallery",
    },
    {
      to: "/contact",
      label: "Contact",
      icon: "contact" as AppIconName,
      id: "nav-contact",
    },
  ];

  const isActive = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  const applyNavPosition = (next: NavPosition) => {
    setNavPosition(next);
    localStorage.setItem(STORAGE_KEY, next);
    setPositionPickerOpen(false);
    setMenuOpen(false);
    setMoreMenuOpen(false);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (role !== "collaborator" && role !== "lab_head" || !appUser?.uid) return;
    getDocs(
      query(collection(db, "collaborators"), where("uid", "==", appUser.uid)),
    )
      .then((snap) => {
        if (!snap.empty) setCollaboratorPhoto(snap.docs[0].data().photo ?? "");
      })
      .catch(() => {});
  }, [role, appUser?.uid]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !sidebarDropdownRef.current?.contains(target) &&
        !topbarDropdownRef.current?.contains(target)
      )
        setDropdownOpen(false);

      if (
        !sidebarPositionRef.current?.contains(target) &&
        !topbarPositionRef.current?.contains(target) &&
        !mobilePositionRef.current?.contains(target)
      ) {
        setPositionPickerOpen(false);
      }

      if (!mobileMoreRef.current?.contains(target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setDropdownOpen(false);
    setMenuOpen(false);
    setMoreMenuOpen(false);
    setPositionPickerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMoreMenuOpen(false);
        setDropdownOpen(false);
        setPositionPickerOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Keep global layout in sync so desktop content is pushed by sidebar width.
  useEffect(() => {
    const body = document.body;
    if (isLeft) {
      body.classList.add("nav-vertical");
      body.style.setProperty(
        "--app-sidebar-width",
        sidebarCollapsed ? "64px" : "220px",
      );
    } else {
      body.classList.remove("nav-vertical");
      body.style.setProperty("--app-sidebar-width", "0px");
    }

    if (isTop) {
      body.classList.add("nav-mobile-top");
    } else {
      body.classList.remove("nav-mobile-top");
    }

    if (isBottom) {
      body.classList.add("nav-bottom-mobile");
    } else {
      body.classList.remove("nav-bottom-mobile");
    }

    return () => {
      body.classList.remove("nav-vertical");
      body.classList.remove("nav-mobile-top");
      body.classList.remove("nav-bottom-mobile");
      body.style.setProperty("--app-sidebar-width", "0px");
    };
  }, [isLeft, isTop, isBottom, sidebarCollapsed]);

  const initials = appUser?.name
    ? appUser.name
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";
  const avatarPhoto = (role === "collaborator" || role === "lab_head") ? collaboratorPhoto : "";

  // ── LEFT SIDEBAR MODE ──────────────────────────────────────
  if (isLeft) {
    return (
      <>
        <style>{`
          @keyframes dropdownFade {
            from { opacity:0; transform:translateY(-8px) scale(0.97); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
          .sidebar-tooltip {
            position: absolute;
            left: 56px;
            background: #1e293b;
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 8px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s ease;
            z-index: 999;
          }
          .sidebar-icon-btn:hover .sidebar-tooltip { opacity: 1; }
        `}</style>

        {/* Fixed vertical sidebar */}
        <aside
          className="fixed top-0 left-0 h-screen z-50 flex flex-col hidden lg:flex"
          style={{
            width: sidebarCollapsed ? 64 : 220,
            background: "var(--color-navbar)",
            boxShadow: "4px 0 24px rgba(0,0,0,0.15)",
            transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
            overflow: "visible",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-4 flex-shrink-0"
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              minHeight: 64,
            }}
          >
            {!sidebarCollapsed && (
              <Link
                to="/"
                className="flex items-center gap-2 no-underline flex-1 min-w-0"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{
                    background: brandLogoUrl ? `white url(${brandLogoUrl}) center/contain no-repeat` : "linear-gradient(135deg, var(--color-accent), #f97316)",
                    color: "#1f2937",
                  }}
                >
                  {brandLogoUrl ? "" : "R"}
                </div>
                <span
                  style={{
                    color: "var(--color-accent)",
                    fontFamily: "var(--font-heading)",
                    fontSize: 15,
                  }}
                  className="font-black truncate"
                >
                  {/* Fixed ID: removed collection prefix */}
                  <EditableText
                    id="navbar.labTitle"
                    defaultValue="Syed's Lab"
                    className="inline"
                  />
                </span>
              </Link>
            )}
            {sidebarCollapsed && (
              <Link to="/" className="mx-auto no-underline">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
                  style={{
                    background: brandLogoUrl ? `white url(${brandLogoUrl}) center/contain no-repeat` : "linear-gradient(135deg, var(--color-accent), #f97316)",
                    color: "#1f2937",
                  }}
                >
                  {brandLogoUrl ? "" : "R"}
                </div>
              </Link>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer ml-2"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  fontSize: 13,
                }}
                title="Collapse sidebar"
              >
                ‹
              </button>
            )}
          </div>

          {/* Expand button when collapsed */}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="mx-auto mt-2 w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "white",
                fontSize: 13,
              }}
              title="Expand sidebar"
            >
              ›
            </button>
          )}

          {/* Nav links */}
          <nav
            className="flex-1 py-3 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {navLinks.map((l) => {
              const active = isActive(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className="sidebar-icon-btn relative flex items-center gap-3 mx-2 px-2 py-2.5 rounded-xl mb-1 no-underline transition-all"
                  style={{
                    background: active
                      ? "rgba(255,255,255,0.12)"
                      : "transparent",
                    color: active
                      ? "var(--color-accent)"
                      : "rgba(255,255,255,0.75)",
                    fontWeight: active ? 700 : 500,
                    fontSize: 13.5,
                    borderLeft: active
                      ? "3px solid var(--color-accent)"
                      : "3px solid transparent",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  }}
                >
                  <AppIcon name={l.icon} size={17} style={{ flexShrink: 0 }} />
                  {!sidebarCollapsed && (
                    <EditableText
                      id={l.label}
                      defaultValue={l.label}
                      className="truncate"
                    />
                  )}
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip">{l.label}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom: position picker + user */}
          <div
            className="flex-shrink-0 px-2 py-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="relative mb-2" ref={sidebarPositionRef}>
              <button
                onClick={() => setPositionPickerOpen((o) => !o)}
                className="sidebar-icon-btn relative w-full flex items-center gap-3 px-2 py-2.5 rounded-xl border-none cursor-pointer transition-all"
                style={{
                  background: positionPickerOpen
                    ? "rgba(255,255,255,0.14)"
                    : "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.82)",
                  fontSize: 13,
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
              >
                <AppIcon name="switch" size={15} style={{ flexShrink: 0 }} />
                {!sidebarCollapsed && <span>Navigation Position</span>}
                {sidebarCollapsed && (
                  <span className="sidebar-tooltip">Navigation Position</span>
                )}
              </button>
              {positionPickerOpen && (
                <div
                  className="absolute rounded-2xl overflow-hidden"
                  style={{
                    bottom: "100%",
                    left: sidebarCollapsed ? 68 : 0,
                    width: 250,
                    background: "white",
                    boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
                    border: "1px solid #e5e7eb",
                    animation: "dropdownFade 0.18s ease",
                    marginBottom: 8,
                    zIndex: 120,
                  }}
                >
                  <NavPositionPicker
                    navPosition={navPosition}
                    setNavPosition={applyNavPosition}
                  />
                </div>
              )}
            </div>

            {/* User / login */}
            {role === "admin" || role === "collaborator" || role === "lab_head" ? (
              <div className="relative" ref={sidebarDropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="sidebar-icon-btn relative w-full flex items-center gap-2 px-2 py-2 rounded-xl border-none cursor-pointer"
                  style={{
                    background: dropdownOpen
                      ? "rgba(255,255,255,0.12)"
                      : "transparent",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  }}
                >
                  <AvatarCircle
                    photo={avatarPhoto}
                    initials={initials}
                    size={30}
                  />
                  {!sidebarCollapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white text-xs font-black truncate">
                        {appUser?.name?.split(" ")[0]}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{
                          color: "rgba(255,255,255,0.45)",
                          fontSize: 10,
                        }}
                      >
                        {role}
                      </p>
                    </div>
                  )}
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip">{appUser?.name}</span>
                  )}
                </button>
                {dropdownOpen && (
                  <div
                    className="absolute rounded-2xl overflow-hidden"
                    style={{
                      bottom: "100%",
                      left: sidebarCollapsed ? 68 : 0,
                      width: 260,
                      background: "white",
                      boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
                      border: "1px solid #e5e7eb",
                      animation: "dropdownFade 0.18s ease",
                      marginBottom: 8,
                    }}
                  >
                    <UserDropdownContent
                      appUser={appUser}
                      role={role}
                      avatarPhoto={avatarPhoto}
                      initials={initials}
                      onClose={() => setDropdownOpen(false)}
                      onLogout={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="sidebar-icon-btn relative no-underline flex items-center gap-2 px-2 py-2.5 rounded-xl font-bold text-xs"
                style={{
                  background: "var(--color-accent)",
                  color: "#1f2937",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
              >
                <AppIcon name="login" size={15} />
                {!sidebarCollapsed && <span>Portal Login</span>}
                {sidebarCollapsed && (
                  <span className="sidebar-tooltip">Portal Login</span>
                )}
              </Link>
            )}
          </div>
        </aside>

        {/* Mobile navbar stays horizontal */}
        <HorizontalNav
          navLinks={navLinks}
          isActive={isActive}
          role={role}
          appUser={appUser}
          avatarPhoto={avatarPhoto}
          initials={initials}
          scrolled={scrolled}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          dropdownOpen={dropdownOpen}
          setDropdownOpen={setDropdownOpen}
          dropdownRef={topbarDropdownRef}
          positionPickerRef={topbarPositionRef}
          mobilePositionRef={mobilePositionRef}
          mobileMoreRef={mobileMoreRef}
          logout={logout}
          navPosition={navPosition}
          setNavPosition={applyNavPosition}
          moreMenuOpen={moreMenuOpen}
          setMoreMenuOpen={setMoreMenuOpen}
          positionPickerOpen={positionPickerOpen}
          setPositionPickerOpen={setPositionPickerOpen}
          className="lg:hidden"
        />
      </>
    );
  }

  // ── TOP/BOTTOM BAR MODES ───────────────────────────────────
  return (
    <HorizontalNav
      navLinks={navLinks}
      isActive={isActive}
      role={role}
      appUser={appUser}
      avatarPhoto={avatarPhoto}
      initials={initials}
      scrolled={scrolled}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      dropdownOpen={dropdownOpen}
      setDropdownOpen={setDropdownOpen}
      dropdownRef={topbarDropdownRef}
      positionPickerRef={topbarPositionRef}
      mobilePositionRef={mobilePositionRef}
      mobileMoreRef={mobileMoreRef}
      logout={logout}
      navPosition={navPosition}
      setNavPosition={applyNavPosition}
      moreMenuOpen={moreMenuOpen}
      setMoreMenuOpen={setMoreMenuOpen}
      positionPickerOpen={positionPickerOpen}
      setPositionPickerOpen={setPositionPickerOpen}
    />
  );
};

// ── Horizontal Navbar ──────────────────────────────────────────
const HorizontalNav: React.FC<{
  navLinks: { to: string; label: string; icon: AppIconName; id: string }[];
  isActive: (p: string) => boolean;
  role: any;
  appUser: any;
  avatarPhoto: string;
  initials: string;
  scrolled: boolean;
  menuOpen: boolean;
  setMenuOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  positionPickerRef: React.RefObject<HTMLDivElement>;
  mobilePositionRef: React.RefObject<HTMLDivElement>;
  mobileMoreRef: React.RefObject<HTMLDivElement>;
  logout: () => void;
  navPosition: NavPosition;
  setNavPosition: (v: NavPosition) => void;
  moreMenuOpen: boolean;
  setMoreMenuOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  positionPickerOpen: boolean;
  setPositionPickerOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  className?: string;
}> = ({
  navLinks,
  isActive,
  role,
  appUser,
  avatarPhoto,
  initials,
  scrolled,
  menuOpen,
  setMenuOpen,
  dropdownOpen,
  setDropdownOpen,
  dropdownRef,
  positionPickerRef,
  mobilePositionRef,
  mobileMoreRef,
  logout,
  navPosition,
  setNavPosition,
  moreMenuOpen,
  setMoreMenuOpen,
  positionPickerOpen,
  setPositionPickerOpen,
  className = "",
}) => {
  const { content } = useSiteContent();
  const brandLogoUrl = content["branding.logoUrl"] ?? "";
  const isIconMobileMode = navPosition === "top" || navPosition === "bottom";
  const mobileIconPlacement = navPosition === "bottom" ? "bottom" : "top";

  return (
    <>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes dropdownFade { from{opacity:0;transform:translateY(-8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .nav-link-pill { transition: color 0.15s, background 0.15s; }
        .nav-link-pill:hover { background: rgba(255,255,255,0.1) !important; }
        .hamburger-line { display:block; width:22px; height:2px; border-radius:99px; background:white; transition:transform 0.3s ease, opacity 0.3s ease, width 0.3s ease; transform-origin:center; }
      `}</style>

      <nav
        className={`${className} ${isIconMobileMode ? "hidden lg:block" : ""}`.trim()}
        style={{
          background: "var(--color-navbar)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: scrolled
            ? "0 4px 24px rgba(0,0,0,0.18)"
            : "0 2px 8px rgba(0,0,0,0.1)",
          transition: "box-shadow 0.3s ease",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex items-center gap-2 no-underline flex-shrink-0"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
                style={{
                  background: brandLogoUrl ? `white url(${brandLogoUrl}) center/contain no-repeat` : "linear-gradient(135deg, var(--color-accent), #f97316)",
                  color: "#1f2937",
                  boxShadow: "0 2px 8px rgba(245,158,11,0.4)",
                }}
              >
                {brandLogoUrl ? "" : "R"}
              </div>
              <span
                style={{
                  color: "var(--color-accent)",
                  fontFamily: "var(--font-heading)",
                }}
                className="text-xl font-black tracking-tight"
              >
                {/* Fixed ID: removed collection prefix */}
                <EditableText
                  id="navbar.labTitle"
                  defaultValue="Syed's Lab"
                  className="inline"
                />
              </span>
            </Link>

            <div className="hidden lg:flex items-center gap-1.5">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="nav-link-pill no-underline px-3 py-2 rounded-lg text-sm whitespace-nowrap"
                  style={{
                    color: isActive(l.to)
                      ? "var(--color-accent)"
                      : "rgba(255,255,255,0.82)",
                    fontWeight: isActive(l.to) ? 700 : 500,
                    background: isActive(l.to)
                      ? "rgba(255,255,255,0.1)"
                      : "transparent",
                    borderBottom: isActive(l.to)
                      ? "2px solid var(--color-accent)"
                      : "2px solid transparent",
                  }}
                >
                  <EditableText
                    id={l.label}
                    defaultValue={l.label}
                    className="inline"
                  />
                </Link>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-2">
              <div className="relative" ref={positionPickerRef}>
                <button
                  onClick={() => setPositionPickerOpen((o) => !o)}
                  title="Navigation Position"
                  aria-label="Navigation Position"
                  className="w-10 h-10 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all"
                  style={{
                    background: positionPickerOpen
                      ? "rgba(255,255,255,0.18)"
                      : "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 12,
                  }}
                >
                  <AppIcon name="switch" size={14} />
                </button>
                {positionPickerOpen && (
                  <div
                    className="absolute right-0 mt-2 rounded-2xl overflow-hidden"
                    style={{
                      width: 260,
                      background: "white",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                      border: "1px solid #e5e7eb",
                      zIndex: 220,
                      animation: "dropdownFade 0.18s ease",
                    }}
                  >
                    <NavPositionPicker
                      navPosition={navPosition}
                      setNavPosition={setNavPosition}
                    />
                  </div>
                )}
              </div>

              {!role && (
                <Link
                  to="/login"
                  className="no-underline text-sm font-semibold px-3.5 py-2 rounded-xl whitespace-nowrap flex items-center gap-2"
                  style={{
                    color: "#1f2937",
                    background: "var(--color-accent)",
                    boxShadow: "0 2px 8px rgba(245,158,11,0.35)",
                  }}
                >
                  <AppIcon name="login" size={14} /> Portal Login
                </Link>
              )}

              {(role === "admin" || role === "collaborator" || role === "lab_head") && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex items-center rounded-full border-none cursor-pointer p-1"
                    style={{
                      background: dropdownOpen
                        ? "rgba(255,255,255,0.18)"
                        : "rgba(255,255,255,0.08)",
                      border: "1.5px solid rgba(255,255,255,0.25)",
                    }}
                    title={appUser?.name ?? "Profile"}
                  >
                    <AvatarCircle
                      photo={avatarPhoto}
                      initials={initials}
                      size={32}
                    />
                  </button>
                  {dropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 rounded-2xl overflow-hidden"
                      style={{
                        width: 280,
                        background: "white",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                        border: "1px solid #e5e7eb",
                        zIndex: 200,
                        animation: "dropdownFade 0.18s ease",
                      }}
                    >
                      <UserDropdownContent
                        appUser={appUser}
                        role={role}
                        avatarPhoto={avatarPhoto}
                        initials={initials}
                        onClose={() => setDropdownOpen(false)}
                        onLogout={() => {
                          logout();
                          setDropdownOpen(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex lg:hidden items-center gap-2">
              {(role === "admin" || role === "collaborator" || role === "lab_head") && (
                <AvatarCircle
                  photo={avatarPhoto}
                  initials={initials}
                  size={32}
                />
              )}
              {!isIconMobileMode && (
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex flex-col items-center justify-center gap-1.5 w-10 h-10 rounded-xl border-none cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                >
                  <span
                    className="hamburger-line"
                    style={{
                      transform: menuOpen
                        ? "translateY(6px) rotate(45deg)"
                        : "none",
                    }}
                  />
                  <span
                    className="hamburger-line"
                    style={{
                      opacity: menuOpen ? 0 : 1,
                      width: menuOpen ? "0" : "22px",
                    }}
                  />
                  <span
                    className="hamburger-line"
                    style={{
                      transform: menuOpen
                        ? "translateY(-6px) rotate(-45deg)"
                        : "none",
                    }}
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {isIconMobileMode && (
        <MobileIconUnifiedBar
          navLinks={navLinks}
          isActive={isActive}
          placement={mobileIconPlacement}
          moreMenuOpen={moreMenuOpen}
          onToggleMore={() => setMoreMenuOpen((o) => !o)}
          moreRef={mobileMoreRef}
        />
      )}

      {menuOpen && !isIconMobileMode && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {isIconMobileMode && moreMenuOpen && (
        <div
          ref={mobileMoreRef}
          className="fixed right-3 z-50 lg:hidden rounded-2xl overflow-hidden"
          style={{
            width: 260,
            top: mobileIconPlacement === "top" ? 60 : undefined,
            bottom: mobileIconPlacement === "bottom" ? 74 : undefined,
            background: "white",
            boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
            border: "1px solid #e5e7eb",
            animation: "dropdownFade 0.18s ease",
          }}
        >
          <div className="p-2">
            {navLinks.map((l) => {
              const active = isActive(l.to);
              return (
                <Link
                  key={`more-${l.to}`}
                  to={l.to}
                  onClick={() => setMoreMenuOpen(false)}
                  className="no-underline w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    color: active ? "#065f46" : "#374151",
                    background: active ? "#ecfdf5" : "transparent",
                  }}
                >
                  <AppIcon name={l.icon} size={16} />
                  <EditableText
                    id={l.id}
                    defaultValue={l.label}
                    className="inline"
                  />
                </Link>
              );
            })}

            {(role === "admin" || role === "collaborator" || role === "lab_head") && (
              <Link
                to={(role === "admin" || appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator") ? "/admin" : "/collaborator-portal"}
                onClick={() => setMoreMenuOpen(false)}
                className="no-underline w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700"
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f3f4f6")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <AppIcon
                  name={(role === "admin" || appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator") ? "admin" : "portal"}
                  size={16}
                />
                Portal Dashboard
              </Link>
            )}

            {!role && (
              <Link
                to="/login"
                onClick={() => setMoreMenuOpen(false)}
                className="no-underline w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  color: "#1f2937",
                  background: "#fef3c7",
                }}
              >
                <AppIcon name="login" size={16} />
                Portal Login
              </Link>
            )}

            <div className="relative" ref={mobilePositionRef}>
              <button
                onClick={() => setPositionPickerOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-none cursor-pointer text-left"
                style={{
                  background: positionPickerOpen ? "#eff6ff" : "transparent",
                  color: positionPickerOpen ? "#1d4ed8" : "#374151",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <AppIcon name="switch" size={15} /> Navigation Position
              </button>
              {positionPickerOpen && (
                <div
                  className="mt-2 rounded-2xl overflow-hidden"
                  style={{
                    background: "white",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                    border: "1px solid #e5e7eb",
                    animation: "dropdownFade 0.18s ease",
                  }}
                >
                  <NavPositionPicker
                    navPosition={navPosition}
                    setNavPosition={setNavPosition}
                  />
                </div>
              )}
            </div>

            {(role === "admin" || role === "collaborator" || role === "lab_head") && (
              <button
                onClick={() => {
                  logout();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-none text-left"
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  marginTop: 6,
                }}
              >
                <AppIcon name="logout" size={15} /> Sign Out
              </button>
            )}
          </div>
        </div>
      )}

      {!isIconMobileMode && (
        <div
          className="fixed top-0 right-0 h-full z-50 lg:hidden flex flex-col"
          style={{
            width: "min(320px, 85vw)",
            background: "var(--color-primary)",
            transform: menuOpen ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
            overflowY: "auto",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Link
              to="/"
              className="flex items-center gap-2 no-underline"
              onClick={() => setMenuOpen(false)}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                style={{
                  background: brandLogoUrl ? `white url(${brandLogoUrl}) center/contain no-repeat` : "linear-gradient(135deg, var(--color-accent), #f97316)",
                  color: "#1f2937",
                }}
              >
                {brandLogoUrl ? "" : "R"}
              </div>
              <span
                style={{
                  color: "var(--color-accent)",
                  fontFamily: "var(--font-heading)",
                }}
                className="font-black"
              >
                {/* Fixed ID: removed collection prefix */}
                <EditableText
                  id="navbar.labTitle"
                  defaultValue="Syed's Lab"
                  className="inline"
                />
              </span>
            </Link>
            <button
              onClick={() => setMenuOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer text-white text-lg"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              ×
            </button>
          </div>

          {(role === "admin" || role === "collaborator" || role === "lab_head") && appUser && (
            <div
              className="mx-4 mt-4 rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-3">
                <AvatarCircle
                  photo={avatarPhoto}
                  initials={initials}
                  size={44}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-sm truncate">
                    {appUser.name}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    {appUser.email}
                  </p>
                  <span
                    className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        (role === "admin" || appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator")
                          ? "var(--color-accent)"
                          : "rgba(255,255,255,0.15)",
                      color: (role === "admin" || appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator") ? "#1f2937" : "white",
                    }}
                  >
                    {appUser?.adminLevel === "moderator" ? "Moderator Administrator" : role === "admin" || appUser?.adminLevel === "primary" ? "Primary Administrator" : role === "lab_head" ? "Lab Head" : "Collaborator"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 px-4 py-4">
            <p
              className="text-xs font-black uppercase tracking-widest mb-3 px-2"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Navigation
            </p>
            {navLinks.map((l) => {
              const active = isActive(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMenuOpen(false)}
                  className="no-underline flex items-center gap-3 px-3 py-3 rounded-xl mb-1"
                  style={{
                    background: active
                      ? "rgba(255,255,255,0.12)"
                      : "transparent",
                    color: active
                      ? "var(--color-accent)"
                      : "rgba(255,255,255,0.8)",
                    fontWeight: active ? 700 : 500,
                    fontSize: 14,
                    borderLeft: active
                      ? "3px solid var(--color-accent)"
                      : "3px solid transparent",
                  }}
                >
                  <AppIcon name={l.icon} size={16} />
                  <EditableText
                    id={l.id}
                    defaultValue={l.label}
                    className="inline"
                  />
                  {active && (
                    <span
                      className="ml-auto text-xs"
                      style={{ color: "var(--color-accent)" }}
                    >
                      ●
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="relative mt-3" ref={mobilePositionRef}>
              <button
                onClick={() => setPositionPickerOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border-none cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 13,
                }}
              >
                <AppIcon name="switch" size={15} /> Navigation Position
              </button>
              {positionPickerOpen && (
                <div
                  className="mt-2 rounded-2xl overflow-hidden"
                  style={{
                    background: "white",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                    border: "1px solid #e5e7eb",
                    animation: "dropdownFade 0.18s ease",
                  }}
                >
                  <NavPositionPicker
                    navPosition={navPosition}
                    setNavPosition={setNavPosition}
                  />
                </div>
              )}
            </div>

            {(role === "admin" || role === "collaborator" || role === "lab_head") && (
              <>
                <p
                  className="text-xs font-black uppercase tracking-widest mb-3 mt-5 px-2"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Portal
                </p>
                {(role === "admin" || appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator") && (
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="no-underline flex items-center gap-3 px-3 py-3 rounded-xl mb-1"
                    style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}
                  >
                    <AppIcon name="admin" size={15} /> Admin Dashboard
                  </Link>
                )}
                {(role === "collaborator" || role === "lab_head") && (
                  <Link
                    to="/collaborator-portal"
                    onClick={() => setMenuOpen(false)}
                    className="no-underline flex items-center gap-3 px-3 py-3 rounded-xl mb-1"
                    style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}
                  >
                    <AppIcon name="portal" size={15} /> My Portal
                  </Link>
                )}
              </>
            )}
          </div>

          <div
            className="px-4 pb-6 flex-shrink-0 flex flex-col gap-2"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 16,
            }}
          >
            {!role && (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="no-underline flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                style={{ background: "var(--color-accent)", color: "#1f2937" }}
              >
                <AppIcon name="login" size={15} /> Portal Login
              </Link>
            )}
            {(role === "admin" || role === "collaborator" || role === "lab_head") && (
              <button
                onClick={() => {
                  logout();
                  setMenuOpen(false);
                }}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-none cursor-pointer"
                style={{ background: "#fee2e2", color: "#991b1b" }}
              >
                <AppIcon name="logout" size={15} /> Sign Out
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const MobileIconUnifiedBar: React.FC<{
  navLinks: { to: string; label: string; icon: AppIconName; id: string }[];
  isActive: (p: string) => boolean;
  placement: "top" | "bottom";
  moreMenuOpen: boolean;
  onToggleMore: () => void;
  moreRef: React.RefObject<HTMLDivElement>;
}> = ({
  navLinks,
  isActive,
  placement,
  moreMenuOpen,
  onToggleMore,
  moreRef,
}) => (
  <div
    className="fixed left-0 right-0 z-50 lg:hidden"
    style={{
      top: placement === "top" ? 0 : undefined,
      bottom: placement === "bottom" ? 0 : undefined,
      background: "var(--color-navbar)",
      borderBottom:
        placement === "top" ? "1px solid rgba(255,255,255,0.12)" : undefined,
      borderTop:
        placement === "bottom" ? "1px solid rgba(255,255,255,0.12)" : undefined,
      boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
    }}
  >
    <div
      className="px-2 py-2"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${navLinks.length + 1}, minmax(0, 1fr))`,
        gap: 4,
      }}
    >
      {navLinks.map((l) => {
        const active = isActive(l.to);
        return (
          <Link
            key={`icon-${l.to}`}
            to={l.to}
            title={l.label}
            aria-label={l.label}
            className="no-underline flex flex-col items-center justify-center rounded-xl py-2"
            style={{
              color: active ? "var(--color-accent)" : "rgba(255,255,255,0.82)",
              background: active ? "rgba(255,255,255,0.12)" : "transparent",
            }}
          >
            <AppIcon name={l.icon} size={16} />
          </Link>
        );
      })}
      <div ref={moreRef} className="flex items-center justify-center">
        <button
          onClick={onToggleMore}
          className="w-full h-full min-h-[40px] rounded-xl border-none cursor-pointer text-white"
          style={{
            background: moreMenuOpen
              ? "rgba(255,255,255,0.16)"
              : "rgba(255,255,255,0.08)",
            fontSize: 22,
          }}
          title="More options"
        >
          ⋯
        </button>
      </div>
    </div>
  </div>
);

const NavPositionPicker: React.FC<{
  navPosition: NavPosition;
  setNavPosition: (v: NavPosition) => void;
}> = ({ navPosition, setNavPosition }) => {
  const options: { value: NavPosition; label: string; hint: string }[] = [
    { value: "left", label: "Left Sidebar", hint: "Desktop side panel" },
    { value: "top", label: "Top Bar", hint: "Icon bar under header" },
    { value: "bottom", label: "Bottom Bar", hint: "Mobile thumb navigation" },
  ];

  return (
    <div className="p-2">
      {options.map((opt) => {
        const active = navPosition === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setNavPosition(opt.value)}
            className="w-full text-left px-3 py-2.5 rounded-xl border-none cursor-pointer mb-1"
            style={{
              background: active ? "#eff6ff" : "transparent",
              color: active ? "#1d4ed8" : "#1f2937",
              fontWeight: active ? 700 : 600,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm">{opt.label}</p>
                <p
                  className="text-xs"
                  style={{ color: active ? "#3b82f6" : "#6b7280" }}
                >
                  {opt.hint}
                </p>
              </div>
              <span style={{ color: active ? "#2563eb" : "#d1d5db" }}>
                {active ? "●" : "○"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ── User Dropdown Content ──────────────────────────────────────
const UserDropdownContent: React.FC<{
  appUser: any;
  role: any;
  avatarPhoto: string;
  initials: string;
  onClose: () => void;
  onLogout: () => void;
}> = ({ appUser, role, avatarPhoto, initials, onClose, onLogout }) => {
  const hasAdminAccess = role === "admin" || appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator";
  return (
  <>
    <div
      className="px-5 pt-5 pb-4"
      style={{ background: "var(--color-primary)" }}
    >
      <div className="flex items-center gap-3">
        <AvatarCircle photo={avatarPhoto} initials={initials} size={48} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm truncate">
            {appUser?.name ?? "User"}
          </p>
          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {appUser?.email}
          </p>
          <span
            className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background:
                hasAdminAccess
                  ? "var(--color-accent)"
                  : "rgba(255,255,255,0.15)",
              color: hasAdminAccess ? "#1f2937" : "white",
            }}
          >
            {appUser?.adminLevel === "primary" ? "Primary Administrator" : appUser?.adminLevel === "moderator" ? "Moderator Administrator" : role === "admin" ? "Administrator" : role === "lab_head" ? "Lab Head" : "Collaborator"}
          </span>
        </div>
      </div>
    </div>
    <div className="py-2">
      {hasAdminAccess && (
        <DropdownItem
          to="/admin"
          icon="admin"
          label="Admin Dashboard"
          onClick={onClose}
        />
      )}
      {(role === "collaborator" || role === "lab_head") && (
        <DropdownItem
          to="/collaborator-portal"
          icon="portal"
          label="My Portal"
          onClick={onClose}
        />
      )}
      <DropdownItem
        to="/"
        icon="website"
        label="View Website"
        onClick={onClose}
      />
    </div>
    <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: "#f0f0f0" }}>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-none text-left"
        style={{ background: "#fee2e2", color: "#991b1b" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#fecaca")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#fee2e2")}
      >
        <AppIcon name="logout" size={15} /> Sign Out
      </button>
    </div>
  </>
  );
};

// ── Avatar Circle ──────────────────────────────────────────────
const AvatarCircle: React.FC<{
  photo: string;
  initials: string;
  size: number;
}> = ({ photo, initials, size }) => {
  const [err, setErr] = useState(false);
  if (photo && !err)
    return (
      <img
        src={photo}
        alt="avatar"
        onError={() => setErr(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
          flexShrink: 0,
        }}
      />
    );
  return (
    <div
      className="flex items-center justify-center text-white font-black flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background:
          "linear-gradient(135deg, var(--color-accent), var(--color-secondary))",
        fontSize: size * 0.36,
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
};

// ── Dropdown Item ──────────────────────────────────────────────
const DropdownItem: React.FC<{
  to: string;
  icon: AppIconName;
  label: string;
  onClick: () => void;
}> = ({ to, icon, label, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className="no-underline flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-700"
    onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
  >
    <AppIcon name={icon} size={16} />
    {label}
  </Link>
);

export default Navbar;
