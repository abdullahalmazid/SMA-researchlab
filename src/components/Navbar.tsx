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
 * Eight flat links became five entries. Eight is past the point where
 * people scan a bar and start hunting through it.
 *
 * NOTE ON CMS IDS: the old desktop bar used `id={l.label}` while the mobile
 * menus used `id={l.id}`, so editing a label in one place wrote to a different
 * Firestore document than the other and the two silently disagreed. Everything
 * now uses the stable `id`. Any label you previously edited on desktop lives
 * under its label string ("Research Ideas") and will need re-entering once.
 * ══════════════════════════════════════════════════════ */

interface NavChild {
  to: string;
  label: string;
  desc: string;
  icon: AppIconName;
  id: string;
}
interface NavGroup {
  label: string;
  id: string;
  to?: string;
  icon?: AppIconName;
  children?: NavChild[];
}

const NAV: NavGroup[] = [
  { label: "Home", id: "nav-home", to: "/", icon: "home" },
  {
    label: "About",
    id: "nav-about-group",
    children: [
      { to: "/about", label: "The lab", desc: "Mission, history and facilities", icon: "building", id: "nav-about" },
      { to: "/lab-head", label: "Lab head", desc: "Leadership and research direction", icon: "admin", id: "nav-lab-head" },
    ],
  },
  {
    label: "Research",
    id: "nav-research-group",
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

/* ══════════════════════════════════════════════════════
 * Shared pieces
 * ══════════════════════════════════════════════════════ */

const Brand: React.FC<{ logo: string; compact?: boolean }> = ({ logo, compact }) => (
  <Link to="/" className="flex shrink-0 items-center gap-2.5 no-underline">
    <span
      className={`grid shrink-0 place-items-center rounded-lg font-bold text-slate-900 ${compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm"}`}
      style={{
        background: logo
          ? `#fff url(${logo}) center/contain no-repeat`
          : "linear-gradient(135deg, var(--color-accent), #f97316)",
      }}
    >
      {logo ? "" : "S"}
    </span>
    <span
      className={`font-bold tracking-tight ${compact ? "text-sm" : "text-[17px]"}`}
      style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
    >
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
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: "linear-gradient(135deg, var(--color-accent), var(--color-secondary))",
      }}
    >
      {initials}
    </span>
  );
};

/**
 * Closes on outside click and on Escape, and returns focus to its trigger —
 * the old dropdowns did neither, so Escape left you stranded mid-page.
 */
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if ((role !== "collaborator" && role !== "lab_head") || !appUser?.uid) return;
    let live = true;
    getDocs(query(collection(db, "collaborators"), where("uid", "==", appUser.uid)))
      .then((snap) => {
        if (live && !snap.empty) setPhoto(snap.docs[0].data().photo ?? "");
      })
      .catch(() => { /* avatar falls back to initials */ });
    return () => { live = false; };
  }, [role, appUser?.uid]);

  // Close everything on navigation.
  useEffect(() => {
    setOpenGroup(null);
    setUserOpen(false);
    setSheetOpen(false);
  }, [location.pathname]);

  // Lock the page behind the mobile sheet only while it is open.
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

  return (
    <>
      <style>{CSS}</style>

      <a href="#main" className="nv-skip">Skip to content</a>

      {/* ══ desktop ══ */}
      <nav
        aria-label="Main"
        className="sticky top-0 z-[100] hidden lg:block"
        style={{
          background: "var(--color-navbar)",
          boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,.18)" : "0 1px 0 rgba(255,255,255,.06)",
          transition: "box-shadow .3s ease",
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6 lg:px-8">
          <Brand logo={logo} />

          <div className="flex flex-1 items-center gap-0.5" ref={groupBox.wrap}>
            {NAV.map((g) => {
              const active = groupActive(g);

              if (!g.children) {
                return (
                  <Link
                    key={g.id}
                    to={g.to!}
                    aria-current={active ? "page" : undefined}
                    className="nv-link"
                    data-active={active || undefined}
                  >
                    <EditableText id={g.id} defaultValue={g.label} className="inline" />
                  </Link>
                );
              }

              const open = openGroup === g.id;
              return (
                <div key={g.id} className="relative">
                  <button
                    type="button"
                    ref={open ? groupBox.trigger : undefined}
                    onClick={() => setOpenGroup(open ? null : g.id)}
                    aria-expanded={open}
                    aria-haspopup="true"
                    aria-controls={`${menuId}-${g.id}`}
                    className="nv-link nv-trigger"
                    data-active={active || undefined}
                  >
                    <EditableText id={g.id} defaultValue={g.label} className="inline" />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.5" aria-hidden="true"
                         style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {open && (
                    <div id={`${menuId}-${g.id}`} className="nv-panel" role="menu">
                      {g.children.map((c) => (
                        <Link key={c.id} to={c.to} role="menuitem" className="nv-panel-item">
                          <span className="nv-panel-icon"><AppIcon name={c.icon} size={16} /></span>
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-slate-900">
                              <EditableText id={c.id} defaultValue={c.label} className="inline" />
                            </span>
                            <span className="mt-0.5 block text-[12px] leading-5 text-slate-500">{c.desc}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!signedIn && (
              <Link to="/login" className="nv-cta">
                <AppIcon name="login" size={14} /> Portal login
              </Link>
            )}

            {signedIn && (
              <div className="relative" ref={userBox.wrap}>
                <button
                  type="button"
                  ref={userBox.trigger}
                  onClick={() => setUserOpen((o) => !o)}
                  aria-expanded={userOpen}
                  aria-haspopup="true"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/5 transition hover:bg-white/15"
                  aria-label={appUser?.name ? `Account menu for ${appUser.name}` : "Account menu"}
                >
                  <AvatarCircle photo={avatar} initials={initials} size={30} />
                </button>

                {userOpen && (
                  <div className="nv-user-panel" role="menu">
                    <div className="px-5 pb-4 pt-5" style={{ background: "var(--color-primary)" }}>
                      <div className="flex items-center gap-3">
                        <AvatarCircle photo={avatar} initials={initials} size={46} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{appUser?.name ?? "User"}</p>
                          <p className="mt-0.5 truncate text-xs text-white/60">{appUser?.email}</p>
                          <span
                            className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              background: isAdmin ? "var(--color-accent)" : "rgba(255,255,255,.15)",
                              color: isAdmin ? "#1f2937" : "#fff",
                            }}
                          >
                            {roleLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="py-2">
                      {isAdmin && <MenuLink to="/admin" icon="admin" label="Admin dashboard" />}
                      {(role === "collaborator" || role === "lab_head") && (
                        <MenuLink to="/collaborator-portal" icon="portal" label="My portal" />
                      )}
                      <MenuLink to="/" icon="website" label="View website" />
                    </div>

                    <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                      <button type="button" onClick={logout} className="nv-signout">
                        <AppIcon name="logout" size={15} /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ══ mobile: slim brand bar ══ */}
      <div
        className="sticky top-0 z-[100] flex h-14 items-center justify-between px-4 lg:hidden"
        style={{
          background: "var(--color-navbar)",
          boxShadow: scrolled ? "0 2px 14px rgba(0,0,0,.22)" : "none",
        }}
      >
        <Brand logo={logo} compact />
        {signedIn ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/20"
            aria-label="Account and more"
          >
            <AvatarCircle photo={avatar} initials={initials} size={26} />
          </button>
        ) : (
          <Link to="/login" className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-slate-900 no-underline"
                style={{ background: "var(--color-accent)" }}>
            Login
          </Link>
        )}
      </div>

      {/* ══ mobile: labelled tab bar ══ */}
      <nav aria-label="Main" className="nv-tabs lg:hidden">
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
        <button
          type="button"
          ref={sheetBox.trigger}
          onClick={() => setSheetOpen(true)}
          className="nv-tab"
          data-active={SECONDARY.some((s) => isActive(s.to)) || undefined}
          aria-expanded={sheetOpen}
        >
          <AppIcon name="switch" size={20} />
          <span>More</span>
        </button>
      </nav>

      {/* ══ mobile sheet ══
          Rendered only while open. The old drawer stayed in the DOM at
          translateX(100%), so its links kept receiving Tab focus off-screen. */}
      {sheetOpen && (
        <>
          <div className="nv-scrim lg:hidden" onClick={() => setSheetOpen(false)} />
          <div className="nv-sheet lg:hidden" role="dialog" aria-modal="true" aria-label="More" ref={sheetBox.wrap}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300" />

            {signedIn && appUser && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                <AvatarCircle photo={avatar} initials={initials} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{appUser.name}</p>
                  <p className="truncate text-xs text-slate-500">{appUser.email}</p>
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
                {isAdmin && (
                  <Link to="/admin" className="nv-sheet-item"><AppIcon name="admin" size={17} /> Admin dashboard</Link>
                )}
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
 * Styles — hover and focus in CSS, not inline handlers
 * ══════════════════════════════════════════════════════ */

const CSS = `
.nv-skip{position:absolute;left:-9999px}
.nv-skip:focus{left:50%;top:8px;transform:translateX(-50%);z-index:200;
  padding:10px 18px;border-radius:8px;background:var(--color-accent);color:#1f2937;
  font-size:13px;font-weight:700;text-decoration:none}

.nv-link{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;
  font-size:13.5px;font-weight:500;color:rgba(255,255,255,.85);text-decoration:none;
  background:transparent;border:0;cursor:pointer;transition:background .15s,color .15s}
.nv-link:hover{background:rgba(255,255,255,.1);color:#fff}
.nv-link:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.nv-link[data-active]{color:var(--color-accent);background:rgba(255,255,255,.1);font-weight:600}

.nv-panel{position:absolute;left:0;top:100%;margin-top:6px;z-index:120;width:300px;padding:8px;
  border-radius:14px;border:1px solid #e5e7eb;background:#fff;
  box-shadow:0 20px 50px rgba(15,23,42,.18);animation:nvIn .16s ease}
@keyframes nvIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.nv-panel-item{display:flex;gap:12px;padding:10px 12px;border-radius:10px;text-decoration:none;
  transition:background .15s}
.nv-panel-item:hover{background:#f8fafc}
.nv-panel-item:focus-visible{outline:2px solid var(--color-secondary);outline-offset:-2px}
.nv-panel-icon{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;
  border-radius:9px;background:#f1f5f9;color:#475569}

.nv-cta{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:10px;
  font-size:13px;font-weight:600;color:#1f2937;text-decoration:none;
  background:var(--color-accent);transition:opacity .2s}
.nv-cta:hover{opacity:.9}
.nv-cta:focus-visible{outline:2px solid #fff;outline-offset:2px}

.nv-user-panel{position:absolute;right:0;top:100%;margin-top:8px;z-index:120;width:284px;
  border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;background:#fff;
  box-shadow:0 20px 60px rgba(15,23,42,.2);animation:nvIn .16s ease}
.nv-menu-link{display:flex;align-items:center;gap:12px;margin:0 8px;padding:10px 12px;
  border-radius:10px;font-size:13.5px;font-weight:500;color:#374151;text-decoration:none;
  transition:background .15s}
.nv-menu-link:hover{background:#f3f4f6}
.nv-signout{display:flex;width:100%;align-items:center;gap:10px;padding:10px 12px;
  border:0;border-radius:10px;background:#fee2e2;color:#991b1b;font-size:13.5px;
  font-weight:600;cursor:pointer;transition:background .15s}
.nv-signout:hover{background:#fecaca}

/* mobile tabs */
.nv-tabs{position:fixed;left:0;right:0;bottom:0;z-index:100;display:grid;
  grid-template-columns:repeat(5,1fr);
  background:#fff;border-top:1px solid #e5e7eb;
  padding-bottom:env(safe-area-inset-bottom,0px);
  box-shadow:0 -2px 16px rgba(15,23,42,.08)}
.nv-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  min-height:56px;padding:8px 4px;border:0;background:transparent;cursor:pointer;
  color:#94a3b8;font-size:10.5px;font-weight:500;text-decoration:none}
.nv-tab[data-active]{color:var(--color-primary);font-weight:600}
.nv-tab:focus-visible{outline:2px solid var(--color-secondary);outline-offset:-3px}

/* the tab bar is fixed, so the page needs room underneath it */
@media (max-width:1023px){body{padding-bottom:calc(60px + env(safe-area-inset-bottom,0px))}}

.nv-scrim{position:fixed;inset:0;z-index:110;background:rgba(15,23,42,.5);
  backdrop-filter:blur(3px);animation:nvFade .2s ease}
@keyframes nvFade{from{opacity:0}to{opacity:1}}
.nv-sheet{position:fixed;left:0;right:0;bottom:0;z-index:111;max-height:82vh;overflow-y:auto;
  padding:12px 16px calc(20px + env(safe-area-inset-bottom,0px));
  border-radius:22px 22px 0 0;background:#fff;
  box-shadow:0 -12px 40px rgba(15,23,42,.25);animation:nvUp .28s cubic-bezier(.32,.72,0,1)}
@keyframes nvUp{from{transform:translateY(100%)}to{transform:none}}
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
