import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { useSiteContent } from "../firebase/hooks";
import AppIcon, { type AppIconName } from "./AppIcon";
import EditableText from "./EditableText";

/* ══════════════════════════════════════════════════════
 * Navigation model
 *
 * Eight flat links became five entries — eight is past the point where
 * people scan a bar and start hunting through it.
 *
 * CMS IDS: the old desktop bar keyed EditableText off the label string while
 * the mobile menus keyed off `id`, so the same link wrote to two different
 * Firestore documents. Everything below uses the stable `id`.
 * ══════════════════════════════════════════════════════ */

interface NavChild {
  to: string; label: string; desc: string; icon: AppIconName; id: string;
}
interface NavGroup {
  label: string; id: string; to?: string; icon?: AppIconName; children?: NavChild[];
}

const NAV: NavGroup[] = [
  { label: "Home", id: "nav-home", to: "/", icon: "home" },
  {
    label: "About", id: "nav-about-group",
    children: [
      { to: "/about", label: "The lab", desc: "Mission, history and facilities", icon: "building", id: "nav-about" },
      { to: "/lab-head", label: "Lab head", desc: "Leadership and research direction", icon: "admin", id: "nav-lab-head" },
    ],
  },
  {
    label: "Research", id: "nav-research-group",
    children: [
      { to: "/publications", label: "Publications", desc: "Published papers and ongoing work", icon: "publications", id: "nav-publications" },
      { to: "/research-ideas", label: "Research ideas", desc: "Open questions to collaborate on", icon: "ideas", id: "nav-research-ideas" },
      { to: "/gallery", label: "Gallery", desc: "Photographs from the lab", icon: "gallery", id: "nav-gallery" },
    ],
  },
  { label: "People", id: "nav-collaborators", to: "/collaborators", icon: "collaborators" },
  { label: "Contact", id: "nav-contact", to: "/contact", icon: "contact" },
];

/** Five labelled tabs at ~78px. The old bar squeezed nine icon-only cells into
 *  390px — about 43px each, with no text to tell them apart. */
const TABS: { to: string; label: string; icon: AppIconName; id: string }[] = [
  { to: "/", label: "Home", icon: "home", id: "nav-home" },
  { to: "/publications", label: "Papers", icon: "publications", id: "nav-publications" },
  { to: "/collaborators", label: "People", icon: "collaborators", id: "nav-collaborators" },
  { to: "/research-ideas", label: "Ideas", icon: "ideas", id: "nav-research-ideas" },
];

const SECONDARY: { to: string; label: string; icon: AppIconName; id: string }[] = [
  { to: "/about", label: "About the lab", icon: "building", id: "nav-about" },
  { to: "/lab-head", label: "Lab head", icon: "admin", id: "nav-lab-head" },
  { to: "/gallery", label: "Gallery", icon: "gallery", id: "nav-gallery" },
  { to: "/contact", label: "Contact", icon: "contact", id: "nav-contact" },
];

/* ── desktop layout preference ─────────────────────────
   Two states, not three, and desktop only. Mobile always gets the tab bar,
   so there is nothing to choose there. */
type DeskNav = "top" | "side";
const STORAGE_KEY = "rl_desk_nav";

const readPref = (): DeskNav => {
  if (typeof window === "undefined") return "top";
  try {
    return localStorage.getItem(STORAGE_KEY) === "side" ? "side" : "top";
  } catch {
    return "top";   // Safari private mode throws on access
  }
};

/* ══════════════════════════════════════════════════════
 * Shared pieces
 * ══════════════════════════════════════════════════════ */

const Brand: React.FC<{ logo: string; compact?: boolean }> = ({ logo, compact }) => (
  <Link to="/" className="nv-brand">
    <span
      className={compact ? "nv-mark nv-mark-sm" : "nv-mark"}
      style={{
        background: logo
          ? `#fff url(${logo}) center/contain no-repeat`
          : "linear-gradient(135deg, var(--color-accent), #f97316)",
      }}
    >
      {logo ? "" : "S"}
    </span>
    <span className={compact ? "nv-wordmark nv-wordmark-sm" : "nv-wordmark"}>
      <EditableText id="navbar.labTitle" defaultValue="Syed's Lab" className="inline" />
    </span>
  </Link>
);

const AvatarCircle: React.FC<{ photo: string; initials: string; size: number }> = ({
  photo, initials, size,
}) => {
  const [err, setErr] = useState(false);
  if (photo && !err) {
    return (
      <img
        src={photo}
        alt=""
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block", flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="nv-avatar"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: "linear-gradient(135deg, var(--color-accent), var(--color-secondary))",
      }}
    >
      {initials}
    </span>
  );
};

/** Closes on outside click and on Escape, returning focus to its trigger —
 *  the old dropdowns did neither, so Escape left you stranded mid-page. */
function useDismissable(open: boolean, close: () => void) {
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); trigger.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return { wrap, trigger };
}

/* ══════════════════════════════════════════════════════
 * Navbar
 * ══════════════════════════════════════════════════════ */

const Navbar: React.FC = () => {
  const { role, logout, appUser } = useAuth();
  const { content } = useSiteContent();
  const location = useLocation();
  const logo = content["branding.logoUrl"] ?? "";

  const [desk, setDesk] = useState<DeskNav>(readPref);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [photo, setPhoto] = useState("");

  const menuId = useId();
  const signedIn = role === "admin" || role === "collaborator" || role === "lab_head";
  const isAdmin =
    role === "admin" || appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator";

  const isActive = useCallback(
    (path: string) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)),
    [location.pathname],
  );
  const groupActive = (g: NavGroup) =>
    g.to ? isActive(g.to) : Boolean(g.children?.some((c) => isActive(c.to)));

  const switchDesk = () => {
    const next: DeskNav = desk === "top" ? "side" : "top";
    setDesk(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
    setOpenGroup(null);
    setUserOpen(false);
  };

  /* The rail is fixed, so the page needs a matching inset. Driving it from a
     data attribute keeps the rule in this component's stylesheet instead of
     leaking a class and a CSS variable into the global layout. */
  useEffect(() => {
    document.body.dataset.nav = desk;
    return () => { delete document.body.dataset.nav; };
  }, [desk]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if ((role !== "collaborator" && role !== "lab_head") || !appUser?.uid) return;
    let live = true;
    getDocs(query(collection(db, "collaborators"), where("uid", "==", appUser.uid)))
      .then((snap) => { if (live && !snap.empty) setPhoto(snap.docs[0].data().photo ?? ""); })
      .catch(() => { /* falls back to initials */ });
    return () => { live = false; };
  }, [role, appUser?.uid]);

  useEffect(() => {
    setOpenGroup(null);
    setUserOpen(false);
    setSheetOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheetOpen]);

  const groupBox = useDismissable(openGroup !== null, () => setOpenGroup(null));
  const userBox = useDismissable(userOpen, () => setUserOpen(false));
  const sheetBox = useDismissable(sheetOpen, () => setSheetOpen(false));

  const initials = appUser?.name
    ? appUser.name.split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
    : "?";
  const avatar = role === "collaborator" || role === "lab_head" ? photo : "";
  const roleLabel =
    appUser?.adminLevel === "primary" ? "Primary Administrator"
    : appUser?.adminLevel === "moderator" ? "Moderator Administrator"
    : role === "admin" ? "Administrator"
    : role === "lab_head" ? "Lab Head"
    : "Collaborator";

  const userPanel = (
    <div className="nv-user-panel" role="menu">
      <div className="nv-user-head">
        <AvatarCircle photo={avatar} initials={initials} size={46} />
        <div className="nv-user-meta">
          <p className="nv-user-name">{appUser?.name ?? "User"}</p>
          <p className="nv-user-mail">{appUser?.email}</p>
          <span
            className="nv-user-role"
            style={{
              background: isAdmin ? "var(--color-accent)" : "rgba(255,255,255,.15)",
              color: isAdmin ? "#1f2937" : "#fff",
            }}
          >
            {roleLabel}
          </span>
        </div>
      </div>
      <div className="nv-user-links">
        {isAdmin && <MenuLink to="/admin" icon="admin" label="Admin dashboard" />}
        {(role === "collaborator" || role === "lab_head") && (
          <MenuLink to="/collaborator-portal" icon="portal" label="My portal" />
        )}
        <MenuLink to="/" icon="website" label="View website" />
      </div>
      <div className="nv-user-foot">
        <button type="button" onClick={logout} className="nv-signout">
          <AppIcon name="logout" size={15} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>

      <a href="#main" className="nv-skip">Skip to content</a>

      {/* ══════════ DESKTOP: top bar ══════════ */}
      {desk === "top" && (
        <nav
          aria-label="Main"
          className="nv-desktop nv-topbar"
          style={{ boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,.18)" : "0 1px 0 rgba(255,255,255,.06)" }}
        >
          <div className="nv-topbar-inner">
            <Brand logo={logo} />

            <div className="nv-groups" ref={groupBox.wrap}>
              {NAV.map((g) => {
                const active = groupActive(g);
                if (!g.children) {
                  return (
                    <Link key={g.id} to={g.to!} className="nv-link"
                          data-active={active || undefined}
                          aria-current={active ? "page" : undefined}>
                      <EditableText id={g.id} defaultValue={g.label} className="inline" />
                    </Link>
                  );
                }
                const open = openGroup === g.id;
                return (
                  <div key={g.id} className="nv-rel">
                    <button
                      type="button"
                      ref={open ? groupBox.trigger : undefined}
                      onClick={() => setOpenGroup(open ? null : g.id)}
                      aria-expanded={open}
                      aria-haspopup="true"
                      aria-controls={`${menuId}-${g.id}`}
                      className="nv-link"
                      data-active={active || undefined}
                    >
                      <EditableText id={g.id} defaultValue={g.label} className="inline" />
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="2.5" aria-hidden="true" className="nv-caret"
                           style={{ transform: open ? "rotate(180deg)" : undefined }}>
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {open && (
                      <div id={`${menuId}-${g.id}`} className="nv-panel" role="menu">
                        {g.children.map((c) => (
                          <Link key={c.id} to={c.to} role="menuitem" className="nv-panel-item">
                            <span className="nv-panel-icon"><AppIcon name={c.icon} size={16} /></span>
                            <span className="nv-panel-text">
                              <span className="nv-panel-title">
                                <EditableText id={c.id} defaultValue={c.label} className="inline" />
                              </span>
                              <span className="nv-panel-desc">{c.desc}</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="nv-actions">
              <button type="button" onClick={switchDesk} className="nv-icon-btn"
                      title="Switch to sidebar navigation" aria-label="Switch to sidebar navigation">
                <AppIcon name="switch" size={15} />
              </button>

              {!signedIn && (
                <Link to="/login" className="nv-cta"><AppIcon name="login" size={14} /> Portal login</Link>
              )}

              {signedIn && (
                <div className="nv-rel" ref={userBox.wrap}>
                  <button
                    type="button"
                    ref={userBox.trigger}
                    onClick={() => setUserOpen((o) => !o)}
                    aria-expanded={userOpen}
                    aria-haspopup="true"
                    className="nv-avatar-btn"
                    aria-label={appUser?.name ? `Account menu for ${appUser.name}` : "Account menu"}
                  >
                    <AvatarCircle photo={avatar} initials={initials} size={30} />
                  </button>
                  {userOpen && userPanel}
                </div>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* ══════════ DESKTOP: sidebar ══════════ */}
      {desk === "side" && (
        <aside aria-label="Main" className="nv-desktop nv-rail">
          <div className="nv-rail-head"><Brand logo={logo} /></div>

          <nav className="nv-rail-nav">
            {NAV.map((g) =>
              g.children ? (
                <div key={g.id} className="nv-rail-section">
                  <p className="nv-rail-label">
                    <EditableText id={g.id} defaultValue={g.label} className="inline" />
                  </p>
                  {g.children.map((c) => {
                    const active = isActive(c.to);
                    return (
                      <Link key={c.id} to={c.to} className="nv-rail-link"
                            data-active={active || undefined}
                            aria-current={active ? "page" : undefined}>
                        <AppIcon name={c.icon} size={17} />
                        <EditableText id={c.id} defaultValue={c.label} className="inline" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <Link key={g.id} to={g.to!} className="nv-rail-link nv-rail-solo"
                      data-active={isActive(g.to!) || undefined}
                      aria-current={isActive(g.to!) ? "page" : undefined}>
                  <AppIcon name={g.icon!} size={17} />
                  <EditableText id={g.id} defaultValue={g.label} className="inline" />
                </Link>
              ),
            )}
          </nav>

          <div className="nv-rail-foot">
            <button type="button" onClick={switchDesk} className="nv-rail-switch">
              <AppIcon name="switch" size={15} /> Switch to top bar
            </button>

            {!signedIn ? (
              <Link to="/login" className="nv-cta nv-cta-block">
                <AppIcon name="login" size={14} /> Portal login
              </Link>
            ) : (
              <div className="nv-rel" ref={userBox.wrap}>
                <button
                  type="button"
                  ref={userBox.trigger}
                  onClick={() => setUserOpen((o) => !o)}
                  aria-expanded={userOpen}
                  aria-haspopup="true"
                  className="nv-rail-user"
                >
                  <AvatarCircle photo={avatar} initials={initials} size={30} />
                  <span className="nv-rail-user-text">
                    <span className="nv-rail-user-name">{appUser?.name?.split(" ")[0]}</span>
                    <span className="nv-rail-user-role">{role}</span>
                  </span>
                </button>
                {userOpen && <div className="nv-rail-user-panel">{userPanel}</div>}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ══════════ MOBILE: brand bar ══════════ */}
      <div className="nv-mobile nv-mobilebar"
           style={{ boxShadow: scrolled ? "0 2px 14px rgba(0,0,0,.22)" : "none" }}>
        <Brand logo={logo} compact />
        {signedIn ? (
          <button type="button" onClick={() => setSheetOpen(true)} className="nv-avatar-btn"
                  aria-label="Account and more">
            <AvatarCircle photo={avatar} initials={initials} size={26} />
          </button>
        ) : (
          <Link to="/login" className="nv-cta nv-cta-sm">Login</Link>
        )}
      </div>

      {/* ══════════ MOBILE: tab bar ══════════ */}
      <nav aria-label="Main" className="nv-mobile nv-tabs">
        {TABS.map((t) => {
          const active = isActive(t.to);
          return (
            <Link key={t.id} to={t.to} className="nv-tab" data-active={active || undefined}
                  aria-current={active ? "page" : undefined}>
              <AppIcon name={t.icon} size={20} />
              <span><EditableText id={t.id} defaultValue={t.label} className="inline" /></span>
            </Link>
          );
        })}
        <button type="button" ref={sheetBox.trigger} onClick={() => setSheetOpen(true)}
                className="nv-tab" aria-expanded={sheetOpen}
                data-active={SECONDARY.some((s) => isActive(s.to)) || undefined}>
          <AppIcon name="switch" size={20} />
          <span>More</span>
        </button>
      </nav>

      {/* Rendered only while open. The old drawer stayed in the DOM at
          translateX(100%), so its links kept receiving Tab focus off-screen. */}
      {sheetOpen && (
        <>
          <div className="nv-mobile nv-scrim" onClick={() => setSheetOpen(false)} />
          <div className="nv-mobile nv-sheet" role="dialog" aria-modal="true" aria-label="More" ref={sheetBox.wrap}>
            <div className="nv-grabber" />

            {signedIn && appUser && (
              <div className="nv-sheet-user">
                <AvatarCircle photo={avatar} initials={initials} size={42} />
                <div className="nv-sheet-user-text">
                  <p className="nv-sheet-user-name">{appUser.name}</p>
                  <p className="nv-sheet-user-mail">{appUser.email}</p>
                </div>
              </div>
            )}

            <p className="nv-sheet-label">Pages</p>
            {SECONDARY.map((s) => (
              <Link key={s.id} to={s.to} className="nv-sheet-item" data-active={isActive(s.to) || undefined}>
                <AppIcon name={s.icon} size={17} />
                <EditableText id={s.id} defaultValue={s.label} className="inline" />
              </Link>
            ))}

            {signedIn && (
              <>
                <p className="nv-sheet-label">Portal</p>
                {isAdmin && <Link to="/admin" className="nv-sheet-item"><AppIcon name="admin" size={17} /> Admin dashboard</Link>}
                {(role === "collaborator" || role === "lab_head") && (
                  <Link to="/collaborator-portal" className="nv-sheet-item"><AppIcon name="portal" size={17} /> My portal</Link>
                )}
                <button type="button" onClick={logout} className="nv-sheet-signout">
                  <AppIcon name="logout" size={16} /> Sign out
                </button>
              </>
            )}

            {!signedIn && (
              <Link to="/login" className="nv-sheet-cta"><AppIcon name="login" size={16} /> Portal login</Link>
            )}
          </div>
        </>
      )}
    </>
  );
};

const MenuLink: React.FC<{ to: string; icon: AppIconName; label: string }> = ({ to, icon, label }) => (
  <Link to={to} role="menuitem" className="nv-menu-link">
    <AppIcon name={icon} size={16} /> {label}
  </Link>
);

/* ══════════════════════════════════════════════════════
 * Styles
 *
 * Breakpoints are handled by media queries here rather than Tailwind's
 * lg:hidden. Both are specificity (0,1,0), and this <style> block renders
 * after the Tailwind sheet — so `.nv-tabs{display:grid}` was beating
 * `.lg\\:hidden{display:none}` on source order and the tab bar showed on
 * desktop. Owning both sides of the rule removes the race entirely.
 * ══════════════════════════════════════════════════════ */

const NV_DESKTOP = 1024;

const CSS = `
.nv-skip{position:absolute;left:-9999px}
.nv-skip:focus{left:50%;top:8px;transform:translateX(-50%);z-index:200;
  padding:10px 18px;border-radius:8px;background:var(--color-accent);color:#1f2937;
  font-size:13px;font-weight:700;text-decoration:none}

@media (max-width:${NV_DESKTOP - 1}px){ .nv-desktop{display:none!important} }
@media (min-width:${NV_DESKTOP}px){ .nv-mobile{display:none!important} }

/* ── brand ── */
.nv-brand{display:flex;align-items:center;gap:10px;flex-shrink:0;text-decoration:none}
.nv-mark{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;
  border-radius:9px;font-size:14px;font-weight:700;color:#1f2937}
.nv-mark-sm{width:28px;height:28px;font-size:12px;border-radius:8px}
.nv-wordmark{font-size:17px;font-weight:700;letter-spacing:-.01em;
  color:var(--color-accent);font-family:var(--font-heading)}
.nv-wordmark-sm{font-size:14px}

.nv-rel{position:relative}
.nv-avatar{display:grid;place-items:center;border-radius:50%;font-weight:700;color:#fff;flex-shrink:0}
.nv-avatar-btn{display:grid;place-items:center;width:40px;height:40px;padding:0;
  border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);
  cursor:pointer;transition:background .2s}
.nv-avatar-btn:hover{background:rgba(255,255,255,.15)}
.nv-avatar-btn:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}

/* ── desktop top bar ── */
.nv-topbar{position:sticky;top:0;z-index:100;background:var(--color-navbar);
  transition:box-shadow .3s ease}
.nv-topbar-inner{display:flex;align-items:center;gap:32px;height:64px;
  max-width:80rem;margin:0 auto;padding:0 24px}
.nv-groups{display:flex;flex:1;align-items:center;gap:2px}
.nv-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}

.nv-link{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;
  font-size:13.5px;font-weight:500;color:rgba(255,255,255,.85);text-decoration:none;
  background:transparent;border:0;cursor:pointer;transition:background .15s,color .15s}
.nv-link:hover{background:rgba(255,255,255,.1);color:#fff}
.nv-link:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.nv-link[data-active]{color:var(--color-accent);background:rgba(255,255,255,.1);font-weight:600}
.nv-caret{transition:transform .2s ease}

.nv-icon-btn{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:9px;
  background:rgba(255,255,255,.08);color:rgba(255,255,255,.85);cursor:pointer;transition:background .2s}
.nv-icon-btn:hover{background:rgba(255,255,255,.18);color:#fff}
.nv-icon-btn:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}

.nv-panel{position:absolute;left:0;top:100%;margin-top:6px;z-index:120;width:300px;padding:8px;
  border-radius:14px;border:1px solid #e5e7eb;background:#fff;
  box-shadow:0 20px 50px rgba(15,23,42,.18);animation:nvIn .16s ease}
@keyframes nvIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.nv-panel-item{display:flex;gap:12px;padding:10px 12px;border-radius:10px;
  text-decoration:none;transition:background .15s}
.nv-panel-item:hover{background:#f8fafc}
.nv-panel-item:focus-visible{outline:2px solid var(--color-secondary);outline-offset:-2px}
.nv-panel-icon{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;
  border-radius:9px;background:#f1f5f9;color:#475569}
.nv-panel-text{min-width:0}
.nv-panel-title{display:block;font-size:13.5px;font-weight:600;color:#0f172a}
.nv-panel-desc{display:block;margin-top:2px;font-size:12px;line-height:1.45;color:#64748b}

.nv-cta{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  padding:9px 15px;border-radius:10px;font-size:13px;font-weight:600;color:#1f2937;
  text-decoration:none;background:var(--color-accent);transition:opacity .2s}
.nv-cta:hover{opacity:.9}
.nv-cta:focus-visible{outline:2px solid #fff;outline-offset:2px}
.nv-cta-block{width:100%;margin-top:8px;padding:11px}
.nv-cta-sm{padding:7px 13px;font-size:12.5px}

/* ── desktop sidebar ── */
.nv-rail{position:fixed;top:0;left:0;bottom:0;width:240px;z-index:100;
  display:flex;flex-direction:column;background:var(--color-navbar);
  box-shadow:2px 0 20px rgba(0,0,0,.16)}
.nv-rail-head{display:flex;align-items:center;height:64px;padding:0 16px;
  border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}
.nv-rail-nav{flex:1;overflow-y:auto;padding:12px 10px;scrollbar-width:thin}
.nv-rail-section{margin-bottom:14px}
.nv-rail-label{margin:0 0 6px 10px;font-size:10px;font-weight:600;letter-spacing:.16em;
  text-transform:uppercase;color:rgba(255,255,255,.34)}
.nv-rail-link{display:flex;align-items:center;gap:11px;padding:9px 10px;margin-bottom:2px;
  border-radius:9px;border-left:3px solid transparent;font-size:13.5px;font-weight:500;
  color:rgba(255,255,255,.78);text-decoration:none;transition:background .15s,color .15s}
.nv-rail-link:hover{background:rgba(255,255,255,.09);color:#fff}
.nv-rail-link:focus-visible{outline:2px solid var(--color-accent);outline-offset:-2px}
.nv-rail-link[data-active]{background:rgba(255,255,255,.12);color:var(--color-accent);
  font-weight:600;border-left-color:var(--color-accent);padding-left:7px}
.nv-rail-solo{margin-bottom:14px}
.nv-rail-foot{flex-shrink:0;padding:12px 10px;border-top:1px solid rgba(255,255,255,.1)}
.nv-rail-switch{display:flex;width:100%;align-items:center;gap:10px;padding:9px 10px;
  border:0;border-radius:9px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);
  font-size:12.5px;font-weight:500;cursor:pointer;transition:background .2s}
.nv-rail-switch:hover{background:rgba(255,255,255,.14);color:#fff}
.nv-rail-switch:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.nv-rail-user{display:flex;width:100%;align-items:center;gap:10px;margin-top:8px;padding:8px 10px;
  border:0;border-radius:10px;background:transparent;cursor:pointer;text-align:left;
  transition:background .2s}
.nv-rail-user:hover{background:rgba(255,255,255,.1)}
.nv-rail-user-text{min-width:0;flex:1}
.nv-rail-user-name{display:block;font-size:12.5px;font-weight:600;color:#fff;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-rail-user-role{display:block;font-size:10.5px;color:rgba(255,255,255,.45)}
.nv-rail-user-panel{position:absolute;bottom:100%;left:0;margin-bottom:8px}
.nv-rail-user-panel .nv-user-panel{position:static;margin:0}

/* the rail is fixed, so the page needs a matching inset */
@media (min-width:${NV_DESKTOP}px){ body[data-nav="side"]{padding-left:240px} }

/* ── account panel ── */
.nv-user-panel{position:absolute;right:0;top:100%;margin-top:8px;z-index:120;width:284px;
  border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;background:#fff;
  box-shadow:0 20px 60px rgba(15,23,42,.2);animation:nvIn .16s ease}
.nv-user-head{display:flex;align-items:center;gap:12px;padding:20px 20px 16px;
  background:var(--color-primary)}
.nv-user-meta{min-width:0;flex:1}
.nv-user-name{margin:0;font-size:14px;font-weight:700;color:#fff;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-user-mail{margin:2px 0 0;font-size:12px;color:rgba(255,255,255,.6);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-user-role{display:inline-block;margin-top:6px;padding:2px 8px;border-radius:99px;
  font-size:11px;font-weight:600}
.nv-user-links{padding:8px 0}
.nv-user-foot{padding:8px 12px 12px;border-top:1px solid #f1f5f9}
.nv-menu-link{display:flex;align-items:center;gap:12px;margin:0 8px;padding:10px 12px;
  border-radius:10px;font-size:13.5px;font-weight:500;color:#374151;
  text-decoration:none;transition:background .15s}
.nv-menu-link:hover{background:#f3f4f6}
.nv-signout{display:flex;width:100%;align-items:center;gap:10px;padding:10px 12px;
  border:0;border-radius:10px;background:#fee2e2;color:#991b1b;font-size:13.5px;
  font-weight:600;cursor:pointer;transition:background .15s}
.nv-signout:hover{background:#fecaca}

/* ── mobile ── */
.nv-mobilebar{position:sticky;top:0;z-index:100;display:flex;align-items:center;
  justify-content:space-between;height:56px;padding:0 16px;background:var(--color-navbar)}

.nv-tabs{position:fixed;left:0;right:0;bottom:0;z-index:100;display:grid;
  grid-template-columns:repeat(5,1fr);background:#fff;border-top:1px solid #e5e7eb;
  padding-bottom:env(safe-area-inset-bottom,0px);box-shadow:0 -2px 16px rgba(15,23,42,.08)}
.nv-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  min-height:56px;padding:8px 4px;border:0;background:transparent;cursor:pointer;
  color:#94a3b8;font-size:10.5px;font-weight:500;text-decoration:none}
.nv-tab[data-active]{color:var(--color-primary);font-weight:600}
.nv-tab:focus-visible{outline:2px solid var(--color-secondary);outline-offset:-3px}

@media (max-width:${NV_DESKTOP - 1}px){
  body{padding-bottom:calc(60px + env(safe-area-inset-bottom,0px))}
}

.nv-scrim{position:fixed;inset:0;z-index:110;background:rgba(15,23,42,.5);
  backdrop-filter:blur(3px);animation:nvFade .2s ease}
@keyframes nvFade{from{opacity:0}to{opacity:1}}
.nv-sheet{position:fixed;left:0;right:0;bottom:0;z-index:111;max-height:82vh;overflow-y:auto;
  padding:12px 16px calc(20px + env(safe-area-inset-bottom,0px));
  border-radius:22px 22px 0 0;background:#fff;box-shadow:0 -12px 40px rgba(15,23,42,.25);
  animation:nvUp .28s cubic-bezier(.32,.72,0,1)}
@keyframes nvUp{from{transform:translateY(100%)}to{transform:none}}
.nv-grabber{width:40px;height:4px;margin:0 auto 16px;border-radius:99px;background:#cbd5e1}
.nv-sheet-user{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:14px;
  border-radius:16px;background:#f8fafc}
.nv-sheet-user-text{min-width:0;flex:1}
.nv-sheet-user-name{margin:0;font-size:14px;font-weight:700;color:#0f172a;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-sheet-user-mail{margin:1px 0 0;font-size:12px;color:#64748b;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-sheet-label{margin:14px 4px 6px;font-size:10.5px;font-weight:600;letter-spacing:.14em;
  text-transform:uppercase;color:#94a3b8}
.nv-sheet-item{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 12px;
  border-radius:12px;font-size:14px;font-weight:500;color:#334155;text-decoration:none}
.nv-sheet-item[data-active]{background:#f1f5f9;color:var(--color-primary);font-weight:600}
.nv-sheet-signout{display:flex;width:100%;align-items:center;gap:10px;min-height:48px;
  margin-top:10px;padding:0 12px;border:0;border-radius:12px;background:#fee2e2;
  color:#991b1b;font-size:14px;font-weight:600;cursor:pointer}
.nv-sheet-cta{display:flex;align-items:center;justify-content:center;gap:10px;min-height:50px;
  margin-top:14px;border-radius:12px;background:var(--color-accent);color:#1f2937;
  font-size:14px;font-weight:600;text-decoration:none}

@media (prefers-reduced-motion:reduce){
  .nv-panel,.nv-user-panel,.nv-sheet,.nv-scrim{animation:none}
}
`;

export default Navbar;
