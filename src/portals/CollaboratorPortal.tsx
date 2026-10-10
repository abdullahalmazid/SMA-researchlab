import React, { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import GalleryTab from "./collaborator/GalleryTab";
import IdeasTab from "./collaborator/IdeasTab";
import OverviewTab from "./collaborator/OverviewTab";
import ProfileTab from "./collaborator/ProfileTab";
import PublicationsTab from "./collaborator/PublicationsTab";
import SecurityTab from "./collaborator/SecurityTab";
import { PORTAL_TABS, isPortalTab, type PortalTab } from "./collaborator/tabs";
import { Avatar, EmptyState, Spinner, buttonClass } from "./collaborator/ui";
import { usePortalData } from "./collaborator/usePortalData";

/**
 * Collaborator portal: a compact header, one row of tabs and the active tab.
 * The tab lives in the URL (?tab=…) so it survives reloads and can be linked.
 * Data loads once in usePortalData and is shared by every tab.
 */
const CollaboratorPortal: React.FC = () => {
  const { appUser, logout, firebaseUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: PortalTab = isPortalTab(requested) ? requested : "overview";
  const data = usePortalData(appUser?.uid);
  const mainRef = useRef<HTMLDivElement>(null);

  const go = (next: PortalTab) => {
    setParams(next === "overview" ? {} : { tab: next });
  };

  /* A new tab starts at the top of the content, not wherever the last one was scrolled. */
  useEffect(() => {
    const top = mainRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 80, behavior: "smooth" });
  }, [tab]);

  if (data.profileLoading) return <Spinner label="Loading your portal" />;

  const profile = data.profile;
  const name = profile?.name || appUser?.name || "Collaborator";
  const counts: Partial<Record<PortalTab, number | undefined>> = {
    publications: data.papers?.length,
    ideas: data.ideas?.length,
    gallery: data.photos?.length,
  };

  return (
    <div className="bg-[color:var(--color-bg)]">
      {/* ── Header + tabs ── */}
      <div className="border-b border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center gap-3 py-3">
            <Avatar name={name} photo={profile?.photo} size={40} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-bold leading-tight text-[color:var(--site-heading)]" style={{ fontFamily: "var(--font-heading)" }}>
                {name}
              </h1>
              <p className="truncate text-[12px] text-[color:var(--site-muted)]">
                {[profile?.designation, profile?.affiliation].filter(Boolean).join(" · ") || "Collaborator portal"}
              </p>
            </div>
            <nav aria-label="Portal shortcuts" className="flex items-center gap-1.5">
              {profile && (
                <Link to={`/collaborators/${profile.uid}`} className={buttonClass("ghost", "no-underline")}>
                  <AppIcon name="user" size={14} />
                  <span className="hidden sm:inline">Public profile</span>
                </Link>
              )}
              <Link to="/chat" className={buttonClass("ghost", "no-underline")}>
                <AppIcon name="message" size={14} />
                <span className="hidden sm:inline">Messages</span>
              </Link>
              <Link to="/" className={buttonClass("quiet", "no-underline")} title="Back to the website">
                <AppIcon name="home" size={14} />
                <span className="hidden md:inline">Website</span>
              </Link>
            </nav>
          </div>

          <div role="tablist" aria-label="Portal sections" className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {PORTAL_TABS.map((item) => {
              const active = item.id === tab;
              const count = counts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`portal-tab-${item.id}`}
                  aria-selected={active}
                  aria-controls="portal-panel"
                  onClick={() => go(item.id)}
                  className={`flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[13px] font-semibold transition ${
                    active
                      ? "border-[color:var(--color-secondary)] text-[color:var(--site-heading)]"
                      : "border-transparent text-[color:var(--site-muted)] hover:text-[color:var(--site-heading)]"
                  }`}
                >
                  {item.label}
                  {typeof count === "number" && count > 0 && (
                    <span className="rounded-full bg-[color:var(--site-surface-alt)] px-1.5 text-[10.5px] font-bold tabular-nums text-[color:var(--site-muted)]">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Active tab ── */}
      <div ref={mainRef} id="portal-panel" role="tabpanel" aria-labelledby={`portal-tab-${tab}`} className="mx-auto max-w-6xl px-4 py-5">
        {!profile && tab !== "security" ? (
          <EmptyState
            title="Your collaborator profile isn't set up yet"
            text="Your account is active, but no profile is linked to it. Ask the lab administrator to approve or link your profile."
          />
        ) : tab === "overview" && profile ? (
          <OverviewTab profile={profile} papers={data.papers} ideas={data.ideas} photos={data.photos} go={go} />
        ) : tab === "profile" && profile ? (
          <ProfileTab profile={profile} onSaved={data.setProfile} />
        ) : tab === "publications" && profile ? (
          <PublicationsTab profile={profile} papers={data.papers} collaborators={data.collaborators} reload={data.reloadPapers} />
        ) : tab === "ideas" && appUser ? (
          <IdeasTab authorId={appUser.uid} authorName={name} authorPhoto={profile?.photo ?? ""} ideas={data.ideas} reload={data.reloadIdeas} />
        ) : tab === "gallery" && appUser ? (
          <GalleryTab
            firebaseUser={firebaseUser}
            uploaderName={name}
            uploaderEmail={appUser.email}
            photos={data.photos}
            reload={data.reloadPhotos}
          />
        ) : tab === "security" && firebaseUser ? (
          <SecurityTab firebaseUser={firebaseUser} email={appUser?.email ?? firebaseUser.email ?? ""} role={appUser?.role ?? "collaborator"} onSignOut={logout} />
        ) : null}
      </div>
    </div>
  );
};

export default CollaboratorPortal;
